import { placeGas } from './hazards.js';
import { placeChests } from './treasure.js';
import { placeShrines } from './shrines.js';
import { placeHoards } from './hoards.js';
import { resetFog } from './fog.js';
import { endTeams, setupTeams } from './teams.js';
import { scatterDecor } from './decor.js';
import { clearFire } from './fire.js';
import { biome, setBiome } from './biomes.js';
import { arrows } from './buildings.js';
import { resetEvents } from './events.js';
import { GAME_MODES, applyModeSetup, treasureGoal } from './modes.js';
import { setupRound } from './versus.js';
import { genLevel } from './levels/loader.js';
import { addDigger, mkAnimal, newId, spawnItem } from './entities.js';
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
  OIL,
  LIQ,
  LOAM,
  ORE,
  ROCK,
  SAND,
  SOLID,
  W,
  W0,
  H0,
  WATER,
  activateAll,
  devSize,
  resizeWorld,
  resetSim,
  bg,
  clearFresh,
  flush,
  mat,
  paint,
  paintAll,
  free,
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
// r: the random numbers to use (Welt 2.0 has its own, so the rest of the world stays as it was)
function blob(cx, cy, rx, ry, m, cond, r = rnd) {
  const ph1 = r() * 9,
    ph2 = r() * 9;
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
// Counts in the generator are made for a 1400 × 400 world; other sizes get as many per area
// (or per width for things on the surface), at least one
const perArea = k => Math.max(1, Math.round((k * W * H) / (W0 * H0))),
  perWidth = k => Math.max(1, Math.round((k * W) / W0));
function gen() {
  endTeams();
  clearFire();
  G.wormDone = false; // (the giant worm comes once per world, boss.js)
  G.merchant = G.merchNext = null; // (the wandering trader, merchant.js)
  G.nights = null; // (the nights counted for the roaming monsters, nights.js)
  G.villagers = []; // (the settlers in the huts, villagers.js)
  G.villageNight = false;
  // a hand-built level (levels/) is loaded from its map instead of being generated
  const LP = GAME_MODES[G.nextMode]?.pkg;
  // the size of the new world: a level's own, otherwise 1400 × 400 (or ?size= in the dev server)
  resizeWorld(...((LP && LP.size) || G.nextSize || devSize || [W0, H0]));
  // multiplayer: everybody builds the same world from the host's seed
  if (G.nextSeed != null) setSeed(G.nextSeed);
  G.seed = getSeed();
  G.nextId = 0;
  // (a hand-built level or map has its own world type)
  setBiome((LP && LP.biome) || G.nextBiome || ['meadow', 'desert', 'winter'][ri(0, 2)]);
  G.earned = 0;
  G.tools = {};
  G.mode = G.nextMode || 'gold';
  // the round: how many players, together or against each other (see versus.js)
  // (vsMin: a shorter clock for quick play)
  G.mp = { np: G.nextNp || 1, vs: !!G.nextVersus, stats: {}, vsMin: G.nextVsMin || null };
  G.relaxed = G.nextDiff === 'relaxed';
  G.store = {};
  G.beams = [];
  G.mis = null;
  G.goldSold = 0;
  G.sold = {};
  G.lvl = null;
  G.mineMark = null;
  mat.fill(0);
  bg.fill(0);
  for (const a of [meteors, items, parts, flashes, builds, trees, crew, animals, lorries, birds, clouds, vehicles])
    a.length = 0;
  G.rails = [];
  G.meteorNext = 15000 + rnd() * 8000;
  G.goldDust = G.earthDug = G.loamDug = G.oreDug = G.coalDug = 0;
  // how many dug coal pixels give one lump (spawnFromDig, digger.js): more coal outside the
  // campaign, whose levels are tuned to the old amount
  G.coalStep = GAME_MODES[G.mode]?.campaign ? 45 : 30;
  clearFresh();
  G.hintsSeen = new Set();
  for (let i = 0; i < W * H; i++) shade[i] = (rnd() * 4) | 0;
  if (LP) return genLevel(LP);
  const p1 = rnd() * 6,
    p2 = rnd() * 6,
    p3 = rnd() * 6;
  // low worlds get flatter hills (1400 × 400: ground around row 120)
  const hy = Math.round(H * 0.3),
    ha = Math.min(1, H / H0);
  for (let x = 0; x < W; x++)
    surf[x] = Math.round(
      hy + ha * 26 * Math.sin(x * 0.0062 + p1) + ha * 12 * Math.sin(x * 0.019 + p2) + ha * 4 * Math.sin(x * 0.061 + p3),
    );
  // Welt 2.0 (free play): the big shapes of the Clonk worlds – plateaus with steep sides on the
  // surface, large rock massifs, caves joined by winding tunnels and a big cavern with a lake.
  // Campaign levels (and the tutorial) keep their tuned worlds; castles stand on flat ground.
  // (its own random numbers from the seed: resources, chests and creatures come out as before)
  const big = !GAME_MODES[G.mode]?.campaign,
    castles = castleXs(),
    clear = (x, r) => castles.every(cx => Math.abs(cx - x) > r);
  let ls = (G.seed * 2654435761 + 0x6d2b79f5) >>> 0;
  const lr = () => {
      ls = (ls + 0x6d2b79f5) >>> 0;
      let t = ls;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    lri = (a, b) => a + Math.floor(lr() * (b - a + 1));
  if (big)
    for (let k = 0, n = perWidth(2); k < n; k++) {
      // a plateau: 60–130 wide, 12–24 high, sides over 5–9 pixels (steep, but they can be dug)
      const w = lri(60, 130),
        h = Math.round(lri(12, 24) * ha),
        side = lri(5, 9);
      let c = lri(260, W - 120);
      for (let t = 0; t < 12 && !clear(c, w / 2 + 120); t++) c = lri(260, W - 120);
      if (!clear(c, w / 2 + 120)) continue;
      for (let x = Math.round(c - w / 2 - side); x <= c + w / 2 + side; x++) {
        if (x < 0 || x >= W) continue;
        const e = Math.min(x - (c - w / 2 - side), c + w / 2 + side - x) / side,
          f = e >= 1 ? 1 : e * e * (3 - 2 * e);
        surf[x] -= Math.round(h * f);
      }
    }
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
  for (let k = 0, n = perArea(38); k < n; k++) {
    const x = ri(150, W - 10);
    blob(x, deep(x, 8), ri(6, 18), ri(4, 11), ROCK);
  }
  for (let k = 0, n = perArea(14); k < n; k++) {
    const x = ri(150, W - 10);
    blob(x, deep(x, 5), ri(6, 13), ri(4, 9), SAND);
  }
  for (let k = 0, n = perArea(12); k < n; k++) {
    const x = ri(150, W - 10);
    blob(x, deep(x, 15), ri(8, 16), ri(3, 6), LOAM);
  }
  const caves = [];
  for (let k = 0, n = perArea(14); k < n; k++) {
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
  // (coal and ore feed the furnace, and metal is needed for a lot: tools, gear, vehicles,
  // castle levels. So there is plenty of both, ore not too deep, and a small vein of each
  // right by the castle: coal to the left of it, ore to the right. Campaign levels keep the
  // old, scarcer layout: their worlds and star times are tuned to it, tests/levels.spec.js)
  if (GAME_MODES[G.mode]?.campaign) {
    for (let k = 0, n = perArea(16); k < n; k++) {
      const x = spread(k, n, 150);
      blob(x, deep(x, 18), ri(5, 12), ri(3, 6), COAL);
    }
    for (let k = 0, n = perArea(14); k < n; k++) {
      const x = spread(k, n, 170);
      blob(x, deep(x, 40), ri(4, 9), ri(3, 6), ORE);
    }
  } else {
    for (let k = 0, n = perArea(28); k < n; k++) {
      const x = spread(k, n, 150);
      blob(x, deep(x, 18), ri(6, 13), ri(3, 7), COAL);
    }
    for (let k = 0, n = perArea(18); k < n; k++) {
      const x = spread(k, n, 170);
      // every other vein in a band not far under the surface, the rest anywhere down below
      const y = k % 2 ? deep(x, 22) : surf[x] + 22 + rnd() * Math.min(48, Math.max(4, H - 52 - surf[x]));
      blob(x, y, ri(5, 10), ri(3, 6), ORE);
    }
    const cx = ri(28, 52),
      ox = ri(125, 165);
    blob(cx, surf[cx] + ri(14, 20), ri(7, 9), ri(4, 5), COAL);
    blob(ox, surf[ox] + ri(18, 26), ri(5, 7), ri(3, 4), ORE);
  }
  for (let k = 0, n = perArea(26); k < n; k++) {
    const x = spread(k, n, 160);
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
  for (let k = 0, n = perArea(12); k < n; k++) {
    const x = spread(k, n, 220);
    blob(x, H - 30 - rnd() * 80, ri(2, 4), ri(2, 3), GEM);
  }
  // Welt 2.0, laid over the finished ground with its own random numbers; ore, coal, gold and gems
  // are never covered (TREASURE), so every world has the resources it had before
  if (big) {
    const keep = i => mat[i] !== ORE && mat[i] !== COAL && mat[i] !== GOLD && mat[i] !== GEM;
    // rock massifs: a few big grey masses in the middle depths (the pick gets through them)
    for (let k = 0, n = perArea(5); k < n; k++) {
      const x = lri(260, W - 40);
      if (!clear(x, 170)) continue;
      blob(x, surf[x] + 40 + lr() * Math.max(10, H * 0.45 - 40), lri(34, 56), lri(14, 24), ROCK, keep, lr);
    }
    // large caverns, the open halls of the Clonk worlds
    const halls = caves.slice();
    for (let k = 0, n = perArea(8); k < n; k++) {
      const x = lri(260, W - 40);
      if (!clear(x, 180)) continue;
      const cy = surf[x] + 36 + lr() * Math.max(4, H - 66 - surf[x]),
        rx = lri(22, 40),
        ry = lri(10, 17);
      blob(x, cy, rx, ry, AIR, keep, lr);
      halls.push({ x, y: cy, rx, ry });
      // every other hall holds a lake (it may run off into the tunnels before the round starts)
      if (k % 2 === 0)
        blob(x, cy + ry * 0.5, rx * 0.85, ry * 0.5, WATER, (i, xx, yy) => mat[i] === AIR && yy > cy + ry * 0.15, lr);
    }
    // winding tunnels join neighbouring caves into systems (gentle slopes: tunnels, not shafts)
    halls.sort((a, b) => a.x - b.x);
    for (let k = 1; k < halls.length; k++) {
      const a = halls[k - 1],
        b = halls[k];
      if (b.x - a.x > 240 || Math.abs(b.y - a.y) > (b.x - a.x) * 0.55 || lr() < 0.3) continue;
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3),
        ph = lr() * 6;
      for (let st = 0; st <= n; st++) {
        const t = st / n,
          x = a.x + (b.x - a.x) * t,
          y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI * 2 + ph) * 12;
        blob(x, y, 5.5, 4, AIR, keep, lr);
      }
    }
    // lava chambers near the bottom: glowing pools far from the castles
    for (let k = 0, n = perWidth(2); k < n; k++) {
      const x = lri(300, W - 60);
      if (!clear(x, 260)) continue;
      const y = H - 34 - lr() * 26,
        rx = lri(18, 30),
        ry = lri(6, 9);
      blob(x, y, rx, ry, AIR, keep, lr);
      blob(x, y + ry * 0.3, rx * 0.9, ry * 0.7, LAVA, (i, xx, yy) => mat[i] === AIR && yy > y - 1, lr);
    }
    // oil pockets deep in the earth (fire.js): dug open, the oil runs out and burns at a spark
    for (let k = 0, n = perWidth(1.5); k < n; k++) {
      const x = lri(200, W - 60);
      if (!clear(x, 200)) continue;
      const y = Math.round(surf[x] + (H - surf[x]) * (0.45 + lr() * 0.3));
      blob(x, y, lri(9, 16), lri(4, 6), OIL, keep, lr);
    }
    // one big cavern deep down, with a lake at its bottom
    const gx = lri(Math.floor(W * 0.3), Math.floor(W * 0.8));
    if (clear(gx, 200)) {
      const gy = Math.min(H - 40, surf[gx] + Math.round(H * 0.45)),
        rx = lri(40, 60),
        ry = lri(14, 20);
      blob(gx, gy, rx, ry, AIR, keep, lr);
      blob(gx, gy + ry * 0.55, rx * 0.8, ry * 0.45, WATER, (i, xx, yy) => mat[i] === AIR && yy > gy + 2, lr);
    }
  }
  // balancing: one shallow gold vein close to the base for the first sale
  const xs = castleXs();
  {
    const x = ri(135, 165);
    blob(x, surf[x] + 16, 5, 3, GOLD);
    // Versus: the same for the second castle on the right and the ones in between
    if (xs.length > 1) blob(W - x, surf[W - x] + 16, 5, 3, GOLD);
    for (const cx of xs.slice(2)) blob(cx + x - 90, surf[cx + x - 90] + 16, 5, 3, GOLD);
  }
  // fair worlds: every castle gets about the same treasure within the helpers' reach
  for (const cx of xs) balanceAround(cx);
  // surface pond (not where a castle stands)
  let x0 = ri(Math.floor(W * 0.45), Math.floor(W * 0.75));
  for (let k = 0; k < 20 && xs.some(cx => Math.abs(cx - x0) < 100); k++) x0 = ri(Math.floor(W * 0.2), Math.floor(W * 0.8));
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
  placeChests(Math.max(perWidth(6), treasureGoal() + 2));
  placeShrines(perWidth(3)); // (halls with a gift deep down, free modes: shrines.js)
  placeHoards(perWidth(2)); // (great hoards, found with a treasure map: hoards.js)
  placeGas(perArea(9));
  if (G.relaxed) G.gas = [];
  for (let x = 0; x < W; x++)
    for (let y = surf[x] + 1; y <= surf[x] + 3; y++) {
      const i = y * W + x;
      if (mat[i] === EARTH) shade[i] |= 4;
    }
  settle();
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
  while (trees.length < perWidth(biome().trees) && tries++ < 500) {
    const x = ri(10, W - 10);
    if (x > G.base.x - 8 && x < G.base.x + G.base.w + 8) continue;
    if (!canPlantAt(x)) continue;
    plantTree(x, ri(2, 4));
  }
  // items
  for (let k = 0, n = perWidth(8); k < n; k++) {
    const x = ri(170, W - 20);
    spawnItem('rock', x, topSolid(x) - 6, 0, 0);
  }
  for (let k = 0, n = perWidth(4); k < n; k++) {
    const x = ri(170, W - 20);
    spawnItem('flint', x, topSolid(x) - 6, 0, 0);
  }
  // crew
  G.money = 40;
  for (let k = 0; k < 3; k++) addDigger(G.base.x + 10 + k * 6, G.base.gy - 10);
  crew[0].pid = G.myId; // your own Wühler; the other two are helpers
  crew[0].inv = ['flint', 'rock'];
  crew[1].inv = ['loam'];
  crew[2].inv = ['rock'];
  for (let t = 1; t < xs.length; t++) genBase(t, xs[t]);
  if (xs.length > 1) setupTeams(builds.filter(b => b.type === 'base').sort((a, b) => (a.team || 0) - (b.team || 0)));
  // animals
  for (let k = 0, n = perWidth(6); k < n; k++) {
    const x = ri(200, W - 20);
    animals.push(mkAnimal('fluffel', x, topSolid(x) - 6));
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
  if (GAME_MODES[G.mode]?.campaign) {
    // (the campaign keeps its two cave monsters: its levels are tuned to them)
    for (let k = 0; k < 2 && k + 7 < caves.length && !G.relaxed; k++) {
      const c = caves[7 + k];
      animals.push(mkAnimal('monster', c.x - 6, c.y - 4));
    }
  } else if (!G.relaxed) {
    // the caves (deepest first: 0–1 lava, 2 acid, 3–6 water, then dry ones) get their
    // monsters: the stone golem in the deepest dry cave, two cave monsters, two poison spiders
    // a bit higher up, and a lava slime over each lava lake
    // a spot in the cave: from its middle (or a little to the side) down onto the floor or the
    // lava; false when it does not fit
    const put = (kind, c) => {
      if (!c) return false;
      const a = mkAnimal(kind, 0, 0);
      for (const dx of [0, -0.3, 0.3, -0.6, 0.6]) {
        const x = Math.round(c.x + dx * c.rx - a.w / 2),
          cx = Math.round(x + a.w / 2);
        let y = Math.round(c.y - a.h / 2);
        for (let u = 0; u < c.ry && !free(x, y, a.w, a.h); u++) y--;
        if (!free(x, y, a.w, a.h)) continue;
        const feet = yy => mat[Math.min(H - 1, yy + a.h) * W + cx];
        while (y < H - a.h - 2 && free(x, y + 1, a.w, a.h) && !LIQ[feet(y + 1)]) y++;
        a.x = x;
        a.y = y;
        animals.push(a);
        return true;
      }
      return false;
    };
    // (the golem is big: the deepest dry cave it fits into)
    for (let k = 7; k < caves.length && !put('golem', caves[k]); k++);
    put('monster', caves[8]);
    put('monster', caves[9]);
    // (two spiders: a cave whose floor is now under water – Welt 2.0 lakes – passes to the next)
    for (let k = 10, n = 2; k < caves.length && n > 0; k++) if (put('spider', caves[k])) n--;
    put('slime', caves[0]);
    put('slime', caves[1]);
  }
  finishWorld();
}
// sand and water settle before anybody looks. The simulation depends on the frame count (sand
// falls left or right on odd and even frames, lava moves every third, acid wakes every 30th), so
// it starts on a frame that is 1 modulo 30: the same seed always gives the same world
function settle() {
  G.frame += (31 - (G.frame % 30)) % 30;
  resetSim();
  paintAll();
  activateAll();
  for (let k = 0; k < 60; k++) simulate();
  flush();
  parts.length = 0;
}
// birds, clouds, weather, events and the mode's own start; the last part of every new world
function finishWorld() {
  for (let f = 0; f < 3; f++) {
    const bx = ri(0, W),
      by = ri(25, 60),
      dir = rnd() < 0.5 ? -1 : 1;
    for (let k = 0; k < ri(3, 5); k++)
      birds.push({ x: bx + k * 6, y: by + (k % 2) * 4, vx: dir * (0.5 + rnd() * 0.15), ph: rnd() * 6 });
  }
  for (let k = 0, n = perWidth(9); k < n; k++) clouds.push(mkCloud(rnd() * W));
  G.dayT = 0.02;
  G.dayN = 0; // (spring, seasons.js)
  G.picked = []; // (mushrooms picked for potions, potions.js)
  G.tombs = []; // (gravestones, tombs.js)
  // (the map knows only the sky and the surface, fog.js; not in campaign levels, maps, the Tagesschacht)
  const FM = GAME_MODES[G.mode];
  G.fogOn = !!FM && !FM.campaign && !FM.pkg && !FM.daily && !G.tut;
  resetFog();
  G.rainT = 0;
  G.rainNext = 9000 + rnd() * 4000;
  arrows.length = 0;
  resetEvents();
  G.kills = G.rescued = 0;
  applyModeSetup();
  setupRound();
  calcTerr();
  scatterDecor();
}
// where the castles stand (their middle): one; Versus a second at the right edge; "Jeder gegen
// jeden" (G.nextFfa: three or four teams) the others in between
function castleXs() {
  if (!G.nextVersus) return [90];
  const n = Math.max(2, Math.min(4, G.nextFfa || 2));
  return [90, W - 90, ...(n === 3 ? [W / 2] : n === 4 ? [W * 0.36, W * 0.64] : [])].map(Math.round);
}
// another castle (team t) with its own two helpers and trees
function genBase(t, cx) {
  const bx = cx - 18;
  const b = { id: newId(), type: 'base', x: bx, gy: surf[bx + 18] + 1, w: 36, h: 30, prog: 1, done: true, busy: 0 };
  Object.assign(b, { lvl: 1, team: t });
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
    const c = addDigger(b.x + 16 + k * 6, b.gy - 10);
    Object.assign(c, { team: t, inv: [k ? 'rock' : 'loam'] });
  }
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

export { blob, canPlantAt, clearFoot, finishWorld, gen, mkCloud, perArea, perWidth, plantTree, settle, topSolid };
