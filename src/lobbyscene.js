// Lobby backdrop in the style of the classic Clonk menus: a cut through the landscape with
// sky, mountains, the castle on a hill, tunnels and ore in the ground. The ground is a real
// little world: the lobby workers (lobbyworkers.js) dig through it and carry the ore home.
// The canvas fills the whole lobby; it has double resolution like the game view.
import { BIOMES } from './biomes.js';
import { drawPortrait } from './portrait.js';
import { SPR, drawDetailed, drawHi, treeSprite } from './sprites.js';
import { T, TEX, TUNNEL } from './tex.js';
import { drawWorkers, resetWorkers, updWorkers } from './lobbyworkers.js';

const EARTH = 1,
  GOLD = 3,
  ORE = 10,
  COAL = 11,
  GEM = 13;
// shared with the workers
const land = { LW: 200, LH: 110, cells: null, round: 0, castleX: 20, heroX: 72, groundY: null, dig: null };
let terrain = null, // ground with tunnels (repainted where the workers dig)
  overlay = null, // castle and trees
  img = null,
  px = null,
  terrainKey = '',
  biomeName = 'meadow',
  dirty = false,
  topCols = [];
const HERO = { x: 0.36 };
// where friends stand, in landscape pixels from the hero (landscape: both on the right,
// the menus cover the left side)
const friendDx = () => (HERO.x > 0.4 ? [-20, 20] : [20, 40]); // hero position as a fraction of the width

const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const groundY = x =>
  Math.round(
    land.LH * 0.6 - 7 * Math.exp(-(((x - land.LW * HERO.x) / (land.LW * 0.18)) ** 2)) + Math.sin(x * 0.07) * 2,
  );
land.groundY = groundY;

// tunnels at the start: from the hill down to a cave on the right
function tunnelAt(x, y) {
  const { LW, LH } = land;
  const x0 = LW * (HERO.x + 0.06),
    y0 = groundY(x0) + 4;
  if (x > x0 && x < LW * 0.62) {
    const ty = y0 + (x - x0) * 0.42;
    if (y > ty - 5 && y < ty + 6) return true;
  }
  const cx = LW * 0.66,
    cy = y0 + (LW * 0.62 - x0) * 0.42 + 2;
  return ((x - cx) / 13) ** 2 + ((y - cy) / 7) ** 2 < 1;
}
// ore blobs, new ones every round (the workers dig them out, then the ground is renewed)
function mkBlobs() {
  let s = (land.round * 9301 + 49297) % 233280;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const kinds = [GOLD, GOLD, COAL, ORE, GOLD, COAL, GEM];
  return kinds.map((m, k) => {
    // spread along the ground, not under the castle
    // (only where the menus do not cover the ground)
    const portrait = land.LH > land.LW;
    const x0 = land.castleX + 44,
      x1 = portrait ? land.LW - 8 : land.LW * 0.58,
      y1 = portrait ? land.LH * 0.66 : land.LH - 6;
    const x = x0 + ((k + 0.1 + r() * 0.8) / kinds.length) * (x1 - x0);
    const gy = groundY(Math.round(x));
    return [
      x,
      gy + 9 + r() * Math.max(4, y1 - gy - 12),
      m === GEM ? 3 : 4 + r() * 3,
      m === GEM ? 2 : 2.5 + r() * 1.5,
      m,
    ];
  });
}

// colour of one landscape cell (2×2 texels)
function paintCell(x, y) {
  const { LW, LH, cells } = land;
  if (x < 0 || y < 0 || x >= LW || y >= LH) return;
  const gy = groundY(x),
    m = cells[y * LW + x],
    W2 = LW * 2;
  const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const shade = (v, k) =>
    pack(
      Math.min(255, (v & 255) * k) | 0,
      Math.min(255, ((v >> 8) & 255) * k) | 0,
      Math.min(255, ((v >> 16) & 255) * k) | 0,
    );
  const solid = (a, b) => b >= gy && b < LH && a >= 0 && a < LW && cells[b * LW + a] !== 0;
  for (let Y = y * 2; Y < y * 2 + 2; Y++)
    for (let X = x * 2; X < x * 2 + 2; X++) {
      let col = 0;
      if (y >= gy) {
        const ti = (Y & (T - 1)) * T + (X & (T - 1));
        if (!m) {
          // tunnel back wall, darker along the edges
          const edge = solid(x, y - 2) || solid(x, y + 2) || solid(x - 2, y) || solid(x + 2, y);
          col = shade(TUNNEL[ti], edge ? 0.6 : 0.85);
        } else {
          if (y - gy < 3 && m === EARTH) {
            const k = topCols[(X * 7 + Y * 3) % 4];
            col = pack(k[0], k[1], k[2]);
          } else col = (TEX[m === EARTH && biomeName === 'desert' && y - gy < 9 ? 4 : m] || TEX[1])[ti] >>> 0;
          // rim light on the surface, shadow under tunnel ceilings
          if (Y === gy * 2) col = shade(col, 1.3);
          else if (y + 1 < LH && !cells[(y + 1) * LW + x] && Y & 1) col = shade(col, 0.6);
        }
      }
      px[Y * W2 + X] = col;
    }
}
function dig(x, y) {
  const { LW, LH, cells } = land;
  if (x < 0 || y < 0 || x >= LW || y >= LH) return 0;
  const m = cells[y * LW + x];
  if (!m) return 0;
  cells[y * LW + x] = 0;
  for (let b = y - 2; b <= y + 2; b++) for (let a = x - 2; a <= x + 2; a++) paintCell(a, b);
  dirty = true;
  return m;
}
land.dig = dig;

// the ground is built once per size, world type and round
function buildTerrain() {
  const { LW, LH } = land;
  land.castleX = Math.round(LW * (HERO.x > 0.4 ? 0.04 : 0.1));
  land.heroX = Math.round(LW * HERO.x);
  land.cells = new Uint8Array(LW * LH);
  const blobs = mkBlobs();
  for (let y = 0; y < LH; y++)
    for (let x = 0; x < LW; x++) {
      if (y < groundY(x) || tunnelAt(x, y)) continue;
      let m = EARTH;
      for (const [bx, by, rx, ry, k] of blobs) if (((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 < 1) m = k;
      land.cells[y * LW + x] = m;
    }
  paintTerrain();
}
// colours and surface objects; a new world type only repaints, the dug tunnels stay
function paintTerrain() {
  const { LW, LH } = land;
  topCols = (BIOMES[biomeName] || BIOMES.meadow).top.map(rgb);
  terrain = document.createElement('canvas');
  terrain.width = LW * 2;
  terrain.height = LH * 2;
  const g = terrain.getContext('2d');
  img = g.createImageData(LW * 2, LH * 2);
  px = new Uint32Array(img.data.buffer);
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) paintCell(x, y);
  g.putImageData(img, 0, 0);
  // surface objects at landscape scale
  overlay = document.createElement('canvas');
  overlay.width = LW * 2;
  overlay.height = LH * 2;
  const o = overlay.getContext('2d');
  o.setTransform(2, 0, 0, 2, 0, 0);
  o.imageSmoothingEnabled = false;
  drawDetailed(o, SPR.base, land.castleX, groundY(land.castleX + 18) - SPR.base.height + 1);
  const treeType = biomeName === 'desert' ? 'cactus' : biomeName === 'winter' ? 'snowpine' : 'oak';
  for (const [fx, stage, type] of [
    [0.5, 3, treeType],
    [0.56, 2, treeType === 'oak' ? 'pine' : treeType],
    [0.86, 4, treeType === 'oak' ? 'pine' : treeType],
    [0.93, 2, treeType],
  ]) {
    if (Math.abs(fx - HERO.x) < 0.12) continue; // keep the hero free
    const s = treeSprite(type, stage),
      x = Math.round(LW * fx);
    drawHi(o, s, x - (s.width >> 1), groundY(x) - s.height + 1);
  }
}
// all ore dug out: new ground for the next round
function renewGround() {
  land.round++;
  buildTerrain();
}
land.renew = renewGround;

// mountains and hills far away, gently drifting
function drawSky(g, b, t) {
  const { LW, LH } = land;
  const sk = g.createLinearGradient(0, 0, 0, LH * 0.6);
  sk.addColorStop(0, `rgb(${b.sky[0]})`);
  sk.addColorStop(1, `rgb(${b.sky[1]})`);
  g.fillStyle = sk;
  g.fillRect(0, 0, LW, LH);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let k = 0; k < 4; k++) {
    const x = ((t * (0.03 + k * 0.01) + k * 61) % (LW + 40)) - 20,
      y = 6 + k * 7;
    g.fillRect(Math.round(x), y, 14, 3);
    g.fillRect(Math.round(x) + 3, y - 2, 8, 2);
  }
  const layers = [
    [b.rock, 0.36, 18, 0.05],
    [b.hills[0], 0.48, 8, 0.11],
    [b.hills[1], 0.54, 5, 0.19],
  ];
  layers.forEach(([col, base, amp, f], k) => {
    g.fillStyle = col;
    for (let x = 0; x < LW; x++) {
      const wx = x + t * f * 0.2;
      const h =
        k === 0
          ? amp * (Math.abs(Math.sin(wx * 0.045)) * 0.7 + Math.abs(Math.sin(wx * 0.11 + 1)) * 0.3)
          : amp * (Math.sin(wx * 0.06 + k) * 0.5 + 0.5);
      const y = Math.round(LH * base - h);
      g.fillRect(x, y, 1, LH - y);
      if (k === 0 && h > amp * 0.75) {
        g.fillStyle = '#f4f8fb';
        g.fillRect(x, y, 1, 2);
        g.fillStyle = col;
      }
    }
  });
}

function drawScene(g, opts) {
  const { t, biome, cap, hat, jumpY, spin, sparks, friends = [] } = opts;
  const b = BIOMES[biome] || BIOMES.meadow;
  const key = `${land.LW}|${land.LH}`;
  if (key !== terrainKey) {
    biomeName = biome;
    buildTerrain();
    resetWorkers(land);
    terrainKey = key;
  } else if (biome !== biomeName) {
    biomeName = biome;
    paintTerrain();
  }
  updWorkers(land, t);
  if (dirty) {
    terrain.getContext('2d').putImageData(img, 0, 0);
    dirty = false;
  }
  const { LW, LH } = land;
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.imageSmoothingEnabled = false;
  drawSky(g, b, t);
  g.drawImage(terrain, 0, 0, LW, LH);
  g.drawImage(overlay, 0, 0, LW, LH);
  drawWorkers(g, land);
  // the hero on the hill: twice as big as in the game, bobbing and turning now and then
  const hx = land.heroX,
    hy = groundY(hx);
  const bob = jumpY < 0 ? 0 : Math.floor(t / 30) % 2;
  const f = spin > 0 ? (Math.floor(spin / 6) % 2 ? 1 : -1) : 1;
  // portrait texels at one landscape pixel each: 16×20, double the in-game size
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(hx - 6, hy - 1, 12, 1);
  drawPortrait(g, hx - 8, hy - 20 + bob + Math.round(jumpY), f, cap, hat, t % 240 < 6);
  // friends in the room stand left and right of the hero, facing it
  friends.slice(0, 2).forEach((p, k) => {
    const fx = hx + friendDx()[k],
      fy = groundY(Math.round(fx));
    g.globalAlpha = p.online ? 1 : 0.45;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(fx - 6, fy - 1, 12, 1);
    drawPortrait(
      g,
      fx - 8,
      fy - 20 + (Math.floor(t / 30 + k) % 2),
      friendDx()[k] > 0 ? -1 : 1,
      p.cap,
      p.hat,
      (t + k * 90) % 240 < 6,
    );
    g.globalAlpha = 1;
  });
  for (let k = sparks.length - 1; k >= 0; k--) {
    const s = sparks[k];
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.03;
    if (--s.l <= 0) sparks.splice(k, 1);
    g.fillStyle = s.c;
    g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
  }
}

// canvas size follows the screen: about 5 screen pixels per landscape pixel
function sizeScene(cv) {
  const r = cv.getBoundingClientRect();
  if (!r.width) return false;
  const w = Math.max(150, Math.min(260, Math.round(r.width / 5)));
  const h = Math.round((w * r.height) / r.width);
  HERO.x = h > w ? 0.5 : 0.36;
  if (w === land.LW && h === land.LH) return false;
  land.LW = w;
  land.LH = h;
  cv.width = w * 2;
  cv.height = h * 2;
  return true;
}
// where the hero stands, in screen pixels relative to the canvas (for the invite slots and the name tag)
function heroScreen(cv) {
  const r = cv.getBoundingClientRect(),
    k = r.width / land.LW;
  const x = land.LW * HERO.x;
  return { x: x * k, y: groundY(Math.round(x)) * k, k };
}
const heroOrigin = () => ({ x: land.LW * HERO.x, y: groundY(Math.round(land.LW * HERO.x)) - 14 });

export { COAL, EARTH, GEM, GOLD, ORE, drawScene, friendDx, heroOrigin, heroScreen, sizeScene };
