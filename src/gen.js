import { placeGas } from './hazards.js';
import { placeChests } from './treasure.js';
import { endTeams, setupTeams } from './teams.js';
import { scatterDecor } from './decor.js';
import { biome, setBiome } from './biomes.js';
import { arrows } from './buildings.js';
import { addClonk, mkAnimal, newId, spawnItem } from './entities.js';
import { calcTerr } from './render.js';
import { simulate } from './sim.js';
import { sp, treeSprite } from './sprites.js';
import {
  G,
  animals,
  birds,
  builds,
  clouds,
  crew,
  flashes,
  items,
  lorries,
  meteors,
  parts,
  trees,
  vehicles,
} from './state.js';
import {
  ACID,
  AIR,
  COAL,
  EARTH,
  GEM,
  GOLD,
  GRANITE,
  H,
  LAVA,
  LIQ,
  LOAM,
  ORE,
  ROCK,
  SAND,
  SOLID,
  W,
  WATER,
  activateAll,
  bg,
  flush,
  mat,
  paint,
  paintAll,
  ri,
  rnd,
  shade,
  solid,
  surf,
  getSeed,
  setSeed,
} from './world.js';

// ---- Generation ----
// how much of a treasure lies around a castle (x = castle centre), from dy0 to dy1 below the
// surface: too much is turned back into earth (far side first), too little gets extra veins
const TREASURE = [
  [GOLD, 0, 130, 230],
  [GOLD, 130, 240, 170],
  [GEM, 60, 240, 45],
];
function balanceAround(cx) {
  const x0 = Math.max(4, cx - 300),
    x1 = Math.min(W - 4, cx + 300);
  for (const [m, dy0, dy1, target] of TREASURE) {
    const cells = [];
    const scan = () => {
      cells.length = 0;
      for (let x = x0; x < x1; x++)
        for (let y = surf[x] + dy0; y < Math.min(H - 8, surf[x] + dy1); y++)
          if (mat[y * W + x] === m) cells.push(y * W + x);
    };
    scan();
    for (let tries = 0; cells.length < target && tries < 40; tries++) {
      const side = rnd() < 0.5 ? -1 : 1,
        x = Math.round(cx + side * (60 + rnd() * 230));
      if (x < x0 || x >= x1) continue;
      const small = m === GEM;
      blob(x, surf[x] + dy0 + 6 + rnd() * (dy1 - dy0 - 12), small ? ri(2, 3) : ri(3, 6), small ? 2 : ri(2, 4), m);
      scan();
    }
    if (cells.length > target) {
      cells.sort((a, b) => Math.abs((b % W) - cx) - Math.abs((a % W) - cx));
      for (let k = 0; k < cells.length - target; k++) mat[cells[k]] = EARTH;
    }
  }
}
function blob(cx, cy, rx, ry, m, cond) {
  const ph1 = rnd() * 9,
    ph2 = rnd() * 9;
  for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
      if (x < 0 || x >= W) continue;
      const dx = (x - cx) / rx,
        dy = (y - cy) / ry;
      const n = Math.sin(x * 0.45 + ph1) * 0.14 + Math.sin(y * 0.55 + ph2) * 0.14;
      if (dx * dx + dy * dy + n >= 1) continue;
      if (y <= surf[x] + 2) continue;
      const i = y * W + x;
      if (mat[i] === GRANITE) continue;
      if (cond && !cond(i, x, y)) continue;
      mat[i] = m;
      bg[i] = 1;
    }
  }
}
function topSolid(x) {
  for (let y = 0; y < H; y++) if (SOLID[mat[y * W + x]] || LIQ[mat[y * W + x]]) return y;
  return H;
}
function gen() {
  endTeams();
  // multiplayer: everybody builds the same world from the host's seed
  if (G.nextSeed != null) setSeed(G.nextSeed);
  G.seed = getSeed();
  G.nextId = 0;
  setBiome(G.nextBiome || ['meadow', 'desert', 'winter'][ri(0, 2)]);
  G.earned = 0;
  G.tools = {};
  G.mode = G.nextMode || 'gold';
  G.relaxed = G.nextDiff === 'relaxed';
  G.store = {};
  G.beams = [];
  G.mis = null;
  G.goldSold = 0;
  G.mineMark = null;
  mat.fill(0);
  bg.fill(0);
  for (const a of [meteors, items, parts, flashes, builds, trees, crew, animals, lorries, birds, clouds, vehicles])
    a.length = 0;
  G.rails = [];
  G.meteorNext = 15000 + rnd() * 8000;
  G.goldDust = G.earthDug = G.loamDug = G.oreDug = G.coalDug = 0;
  G.hintsSeen = new Set();
  for (let i = 0; i < W * H; i++) shade[i] = (rnd() * 4) | 0;
  const p1 = rnd() * 6,
    p2 = rnd() * 6,
    p3 = rnd() * 6;
  for (let x = 0; x < W; x++)
    surf[x] = Math.round(
      120 + 26 * Math.sin(x * 0.0062 + p1) + 12 * Math.sin(x * 0.019 + p2) + 4 * Math.sin(x * 0.061 + p3),
    );
  const bh = surf[90];
  for (let x = 0; x < 160; x++) {
    const t = x < 120 ? 0 : (x - 120) / 40;
    surf[x] = Math.round(bh * (1 - t) + surf[x] * t);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        gr = H - 9 + Math.round(Math.sin(x * 0.13) * 1.5 + Math.sin(x * 0.051) * 2);
      if (y >= gr) {
        mat[i] = GRANITE;
        bg[i] = 1;
      } else if (y > surf[x]) {
        mat[i] = EARTH;
        bg[i] = 1;
      }
    }
  const deep = (x, min) => surf[x] + min + rnd() * Math.max(4, H - 30 - surf[x] - min);
  for (let k = 0; k < 38; k++) {
    const x = ri(150, W - 10);
    blob(x, deep(x, 8), ri(6, 18), ri(4, 11), ROCK);
  }
  for (let k = 0; k < 14; k++) {
    const x = ri(150, W - 10);
    blob(x, deep(x, 5), ri(6, 13), ri(4, 9), SAND);
  }
  for (let k = 0; k < 12; k++) {
    const x = ri(150, W - 10);
    blob(x, deep(x, 15), ri(8, 16), ri(3, 6), LOAM);
  }
  const caves = [];
  for (let k = 0; k < 14; k++) {
    const x = ri(180, W - 30),
      cy = deep(x, 30),
      rx = ri(10, 24),
      ry = ri(6, 12);
    blob(x, cy, rx, ry, AIR);
    caves.push({ x, y: cy, rx, ry });
  }
  caves.sort((a, b) => b.y - a.y);
  // deepest caves: lava, one acid, some water
  caves.forEach((c, k) => {
    const liquid = k < 2 ? LAVA : k === 2 ? ACID : k < 7 ? WATER : 0;
    if (liquid)
      blob(c.x, c.y, c.rx, c.ry, liquid, (i, xx, yy) => mat[i] === AIR && yy > c.y - (liquid === WATER ? 1 : 3));
  });
  // resources spread evenly along the world (random within each stretch), so every world
  // has about as much close to the base – no lucky or empty starts
  const spread = (k, n, x0) => Math.floor(x0 + (k + 0.15 + rnd() * 0.7) * ((W - 15 - x0) / n));
  for (let k = 0; k < 16; k++) {
    const x = spread(k, 16, 150);
    blob(x, deep(x, 18), ri(5, 12), ri(3, 6), COAL);
  }
  for (let k = 0; k < 14; k++) {
    const x = spread(k, 14, 170);
    blob(x, deep(x, 40), ri(4, 9), ri(3, 6), ORE);
  }
  for (let k = 0; k < 26; k++) {
    const x = spread(k, 26, 160);
    blob(x, deep(x, 22), ri(3, 7), ri(2, 5), GOLD);
  }
  // desert: thick sand cover (not under the home base)
  if (G.biome === 'desert')
    for (let x = 0; x < W; x++) {
      if (x > 55 && x < 125) continue;
      const d = 6 + Math.round(3 * Math.sin(x * 0.05) + 3);
      for (let y = surf[x] + 1; y <= surf[x] + d; y++) if (mat[y * W + x] === EARTH) mat[y * W + x] = SAND;
    }
  // gems: small, rare pockets deep down
  for (let k = 0; k < 12; k++) {
    const x = spread(k, 12, 220);
    blob(x, H - 30 - rnd() * 80, ri(2, 4), ri(2, 3), GEM);
  }
  // balancing: one shallow gold vein close to the base for the first sale
  {
    const x = ri(135, 165);
    blob(x, surf[x] + 16, 5, 3, GOLD);
    // Versus: the same for the second castle on the right
    if (G.nextVersus) blob(W - x, surf[W - x] + 16, 5, 3, GOLD);
  }
  // fair worlds: every castle gets about the same treasure within the helpers' reach
  balanceAround(90);
  if (G.nextVersus) balanceAround(W - 90);
  // surface pond
  const x0 = ri(Math.floor(W * 0.45), Math.floor(W * 0.75));
  for (let x = x0 - 50; x <= x0 + 50; x++) {
    const t = (x - x0) / 50,
      dep = Math.floor(16 * (1 - t * t));
    for (let y = surf[x] + 1; y <= surf[x] + dep; y++) {
      const i = y * W + x;
      if (mat[i] !== GRANITE) {
        mat[i] = WATER;
        bg[i] = 1;
      }
    }
  }
  placeChests();
  placeGas();
  if (G.relaxed) G.gas = [];
  for (let x = 0; x < W; x++)
    for (let y = surf[x] + 1; y <= surf[x] + 3; y++) {
      const i = y * W + x;
      if (mat[i] === EARTH) shade[i] |= 4;
    }
  paintAll();
  activateAll();
  for (let k = 0; k < 60; k++) simulate();
  flush();
  parts.length = 0;
  // home base
  G.base = { id: newId(), type: 'base', x: 72, gy: surf[90] + 1, w: 36, h: 30, prog: 1, done: true, busy: 0, lvl: 1 };
  G.base.gy = surf[90] + 1;
  clearFoot(G.base.x, G.base.gy, G.base.w, G.base.h);
  builds.push(G.base);
  // trees: two big ones right next to the base, so the first hut is quick
  for (let x = 125, n = 0; x < 200 && n < 2; x += 3)
    if (canPlantAt(x)) {
      plantTree(x, 4);
      n++;
    }
  let tries = 0;
  while (trees.length < biome().trees && tries++ < 500) {
    const x = ri(10, W - 10);
    if (x > G.base.x - 8 && x < G.base.x + G.base.w + 8) continue;
    if (!canPlantAt(x)) continue;
    plantTree(x, ri(2, 4));
  }
  // items
  for (let k = 0; k < 8; k++) {
    const x = ri(170, W - 20);
    spawnItem('rock', x, topSolid(x) - 6, 0, 0);
  }
  for (let k = 0; k < 4; k++) {
    const x = ri(170, W - 20);
    spawnItem('flint', x, topSolid(x) - 6, 0, 0);
  }
  // crew
  G.money = 40;
  for (let k = 0; k < 3; k++) addClonk(G.base.x + 10 + k * 6, G.base.gy - 10);
  crew[0].pid = G.myId; // your own Wühler; the other two are helpers
  crew[0].inv = ['flint', 'rock'];
  crew[1].inv = ['loam'];
  crew[2].inv = ['rock'];
  if (G.nextVersus) genSecondBase();
  // animals
  for (let k = 0; k < 6; k++) {
    const x = ri(200, W - 20);
    animals.push(mkAnimal('wipf', x, topSolid(x) - 6));
  }
  let fish = 0;
  for (let tr = 0; tr < 4000 && fish < 10; tr++) {
    const x = ri(0, W - 1),
      y = ri(0, H - 1);
    if (mat[y * W + x] === WATER && mat[(y + 1) * W + x] === WATER && mat[(y - 1) * W + x] === WATER) {
      animals.push(mkAnimal('fish', x, y));
      fish++;
    }
  }
  // relaxed worlds have no creatures that hurt you
  if (!G.relaxed) for (const c of caves.slice(2, 10)) animals.push(mkAnimal('bat', c.x, c.y - 2));
  for (let k = 0; k < 2 && k + 7 < caves.length && !G.relaxed; k++) {
    const c = caves[7 + k];
    animals.push(mkAnimal('monster', c.x - 6, c.y - 4));
  }
  for (let f = 0; f < 3; f++) {
    const bx = ri(0, W),
      by = ri(25, 60),
      dir = rnd() < 0.5 ? -1 : 1;
    for (let k = 0; k < ri(3, 5); k++)
      birds.push({ x: bx + k * 6, y: by + (k % 2) * 4, vx: dir * (0.5 + rnd() * 0.15), ph: rnd() * 6 });
  }
  for (let k = 0; k < 9; k++) clouds.push(mkCloud(rnd() * W));
  G.dayT = 0.02;
  G.rainT = 0;
  G.rainNext = 9000 + rnd() * 4000;
  arrows.length = 0;
  calcTerr();
  scatterDecor();
}
// Versus: a second castle at the right edge with its own two helpers and trees
function genSecondBase() {
  const bx = W - 72 - 36;
  const b = { id: newId(), type: 'base', x: bx, gy: surf[bx + 18] + 1, w: 36, h: 30, prog: 1, done: true, busy: 0 };
  Object.assign(b, { lvl: 1, team: 1 });
  clearFoot(b.x, b.gy, b.w, b.h);
  for (let k = trees.length - 1; k >= 0; k--)
    if (trees[k].x > b.x - 8 && trees[k].x < b.x + b.w + 8) trees.splice(k, 1);
  builds.push(b);
  for (let x = bx - 20, n = 0; x > bx - 95 && n < 2; x -= 3)
    if (canPlantAt(x)) {
      plantTree(x, 4);
      n++;
    }
  for (let k = 0; k < 2; k++) {
    const c = addClonk(b.x + 16 + k * 6, b.gy - 10);
    Object.assign(c, { team: 1, inv: [k ? 'rock' : 'loam'] });
  }
  setupTeams([G.base, b]);
}
function clearFoot(bx, gy, w, h) {
  for (let y = gy - h; y < gy; y++)
    for (let x = bx; x < bx + w; x++) {
      if (y < 0) continue;
      const i = y * W + x,
        m = mat[i];
      if (m !== AIR && m !== GRANITE) {
        mat[i] = AIR;
        paint(i);
      }
    }
  for (let y = gy; y < gy + 5 && y < H; y++)
    for (let x = bx; x < bx + w; x++) {
      const i = y * W + x,
        m = mat[i];
      if (m === AIR || LIQ[m]) {
        mat[i] = EARTH;
        bg[i] = 1;
        shade[i] = (rnd() * 4) | 0;
        paint(i);
      }
    }
}
function canPlantAt(x) {
  const y = topSolid(x);
  if (y >= H - 20 || (mat[y * W + x] !== EARTH && mat[y * W + x] !== SAND)) return false;
  for (let k = -2; k <= 2; k++) if (!solid(x + k, y) || solid(x + k, y - 1)) return false;
  for (const t of trees) if (Math.abs(t.x - x) < 11) return false;
  for (const b of builds) if (x > b.x - 4 && x < b.x + b.w + 4) return false;
  return true;
}
function plantTree(x, stage) {
  const type = G.biome === 'desert' ? 'cactus' : G.biome === 'winter' ? 'snowpine' : rnd() < 0.5 ? 'pine' : 'oak';
  trees.push({
    id: newId(),
    x,
    gy: topSolid(x),
    type,
    stage,
    hp: 40 + stage * 25,
    fall: 0,
    ang: 0,
    grow: ri(0, 1500),
    spr: treeSprite(type, stage),
  });
}
function mkCloud(x) {
  const w = ri(18, 40),
    h = ri(6, 11);
  const spr = sp(w, h, R => {
    for (let y = 0; y < h; y++)
      for (let xx = 0; xx < w; xx++) {
        const dx = (xx + 0.5 - w / 2) / (w / 2),
          dy = (y + 0.5 - h * 0.6) / (h * 0.6),
          n = ((xx * 11 + y * 7) % 5) * 0.05;
        if (dx * dx + dy * dy * 1.4 + n < 1) R(xx, y, 1, 1, y < h * 0.45 ? '#ffffff' : '#e6eef4');
      }
  });
  return { x, y: ri(10, 48), w, h, vx: 0.04 + rnd() * 0.06, spr };
}

export { blob, canPlantAt, clearFoot, gen, mkCloud, plantTree, topSolid };
