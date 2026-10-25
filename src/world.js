import { builds } from './state.js';
import { T, TEX, TUNNEL, setTopSoil, topTex, worldShade } from './tex.js';

// ---- World & materials ----
const W = 1400,
  H = 400,
  GOAL = 500;
const AIR = 0,
  EARTH = 1,
  ROCK = 2,
  GOLD = 3,
  SAND = 4,
  WATER = 5,
  GRANITE = 6,
  LAVA = 7,
  ACID = 8,
  LOAM = 9,
  ORE = 10,
  COAL = 11,
  PLANK = 12,
  GEM = 13;
const SOLID = [0, 1, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1];
const LIQ = [0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0];
const BLAST = [0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1];
const mat = new Uint8Array(W * H),
  bg = new Uint8Array(W * H),
  shade = new Uint8Array(W * H),
  stamp = new Uint32Array(W * H);
const surf = new Int16Array(W);
const rgba = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
const hex = (h, a = 255) =>
  rgba(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a);
const PAL = [
  [],
  ['#8a5a32', '#7d5230', '#94633a', '#71482a', '#5f9a3c', '#6fae4a', '#558a34', '#79b955'].map(c => hex(c)),
  ['#6f6a64', '#7b766f', '#625d58', '#888179'].map(c => hex(c)),
  ['#e8b923', '#f5cf3d', '#c99a16', '#ffe066'].map(c => hex(c)),
  ['#d9b56a', '#e3c27a', '#ccaa5e', '#d1ad66'].map(c => hex(c)),
  ['#3b7fc4', '#3a78ba', '#4688cc', '#3573b2'].map(c => hex(c, 225)),
  ['#3b3640', '#45404b', '#34303a', '#4f4955'].map(c => hex(c)),
  ['#ff6a1a', '#ff8a2a', '#e8501a', '#ffb03a'].map(c => hex(c)),
  ['#7ed957', '#6cc845', '#8fe066', '#5fb83c'].map(c => hex(c, 225)),
  ['#b07a45', '#a8703e', '#bb854f', '#9f6a3a'].map(c => hex(c)),
  ['#8a4a3a', '#9a5a46', '#7a3e30', '#c07658'].map(c => hex(c)),
  ['#2a2626', '#33302e', '#232020', '#3b3735'].map(c => hex(c)),
  ['#a0703f', '#8b5e34', '#b07a45', '#946436'].map(c => hex(c)),
  ['#3fb5d6', '#5fd3e8', '#2f8fb0', '#b6f6ff'].map(c => hex(c)),
];
const TUN = ['#3a2416', '#33200f', '#402a1a', '#2e1c10'].map(c => hex(c));
const MINI = [
  '',
  '#7d5230',
  '#77726b',
  '#f2c230',
  '#d9b56a',
  '#3b7fc4',
  '#3b3640',
  '#ff7a2a',
  '#7ed957',
  '#ad7642',
  '#9a5a46',
  '#2a2626',
  '#a0703f',
  '#5fd3e8',
];
// brighter / darker copies of a packed colour (alpha kept)
const tint = (c, f) => {
  const ch = s => Math.min(255, Math.round(((c >>> s) & 255) * f)) << s;
  return (((c >>> 24) << 24) | ch(16) | ch(8) | ch(0)) >>> 0;
};
// Soil changes character with depth: warm and reddish just below the grass, cooler and greyer
// further down, a blue-ish cast in the deepest layers. Only earth, loam and rock take part.
const mixf = (a, b, t) => a + (b - a) * t,
  cl01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
function layerTint(c, d) {
  if (d < 10) return c;
  const t1 = cl01((d - 10) / 30),
    t2 = cl01((d - 50) / 50),
    t3 = cl01((d - 110) / 60);
  let r = mixf(1, 1.05, t1),
    g = mixf(1, 0.96, t1),
    b = mixf(1, 0.88, t1);
  r = mixf(r, 0.88, t2);
  g = mixf(g, 0.9, t2);
  b = mixf(b, 1.0, t2);
  r = mixf(r, 0.8, t3);
  g = mixf(g, 0.82, t3);
  b = mixf(b, 0.98, t3);
  const ch = (s, k) => Math.min(255, Math.round(((c >>> s) & 255) * k)) << s;
  return (((c >>> 24) << 24) | ch(16, b) | ch(8, g) | ch(0, r)) >>> 0;
}
const PAL_LIT = PAL.map(a => a.map(c => tint(c, 1.2)));
const PAL_DARK = PAL.map(a => a.map(c => tint(c, 0.72)));
// the top layer of earth (shade 4-7) depends on the world type
function setGroundTop(cols) {
  cols.forEach((c, k) => {
    PAL[EARTH][4 + k] = hex(c);
    PAL_LIT[EARTH][4 + k] = tint(hex(c), 1.12);
    PAL_DARK[EARTH][4 + k] = tint(hex(c), 0.8);
  });
  setTopSoil(cols);
}

// The world image has double resolution: every landscape cell is painted as 2×2 texels taken
// from the material texture, with a one-texel rim light on top edges and shade under ceilings.
const RES = 2,
  PW = W * RES;
const WSH = worldShade(W, H);
const solidAt = j => j >= 0 && j < W * H && SOLID[mat[j]] === 1;
function texel(i, sx, sy) {
  const m = mat[i];
  const x = (i % W) * 2 + sx,
    y = ((i / W) | 0) * 2 + sy,
    ti = (y & (T - 1)) * T + (x & (T - 1));
  if (m === AIR) {
    if (!bg[i]) return 0;
    // tunnel back wall, darker the more rock surrounds it (soft ambient occlusion)
    let n = 0;
    if (solidAt(i - 1)) n += 2;
    if (solidAt(i + 1)) n += 2;
    if (solidAt(i - W)) n += 2;
    if (solidAt(i + W)) n += 2;
    if (solidAt(i - 2)) n++;
    if (solidAt(i + 2)) n++;
    if (solidAt(i - 2 * W)) n++;
    if (solidAt(i + 2 * W)) n++;
    let k = 1 - n * 0.055;
    if ((sx === 0 && solidAt(i - 1)) || (sx === 1 && solidAt(i + 1)) || (sy === 0 && solidAt(i - W))) k *= 0.72;
    return tint(TUNNEL[ti], k * WSH[i]);
  }
  const tex = m === EARTH && shade[i] & 4 ? topTex() : TEX[m];
  let c = tex ? tex[ti] : PAL[m][shade[i] & 3];
  if (tex) c = tint(c, WSH[i]);
  if ((m === EARTH && !(shade[i] & 4)) || m === LOAM || m === ROCK) c = layerTint(c, ((i / W) | 0) - surf[i % W]);
  if (LIQ[m]) {
    // a bright line on open liquid surfaces
    if (sy === 0 && i >= W && mat[i - W] === AIR) c = tint(c, 1.35);
    return c;
  }
  const up = i >= W ? mat[i - W] : AIR;
  if (sy === 0 && (up === AIR || LIQ[up])) return tint(c, 1.3);
  if (sy === 1 && i < W * (H - 1) && !SOLID[mat[i + W]]) return tint(c, 0.62);
  if (sx === 0 && i % W > 0 && mat[i - 1] === AIR) return tint(c, 1.1);
  if (sx === 1 && i % W < W - 1 && mat[i + 1] === AIR) return tint(c, 0.82);
  return c;
}
function paintCell(i) {
  const x = (i % W) * 2,
    y = ((i / W) | 0) * 2,
    o = y * PW + x;
  px[o] = texel(i, 0, 0);
  px[o + 1] = texel(i, 1, 0);
  px[o + PW] = texel(i, 0, 1);
  px[o + PW + 1] = texel(i, 1, 1);
}
// old single-colour lookup, still used for flat previews
const colorOf = i => {
  const m = mat[i];
  if (m === AIR) return bg[i] ? TUN[shade[i] & 3] : 0;
  return PAL[m][m === EARTH ? shade[i] : shade[i] & 3];
};

const wc = document.createElement('canvas');
wc.width = PW;
wc.height = H * RES;
const wctx = wc.getContext('2d');
const img = wctx.createImageData(PW, H * RES);
const px = new Uint32Array(img.data.buffer);
function paintAll() {
  for (let i = 0; i < W * H; i++) paintCell(i);
  wctx.putImageData(img, 0, 0);
}
// changed chunks of the world image, uploaded once per frame
const CS = 32,
  CWn = Math.ceil(W / CS),
  CHn = Math.ceil(H / CS);
// chunks that changed and must be simulated next frame
let act = new Uint8Array(CWn * CHn),
  actNext = new Uint8Array(CWn * CHn);
function swapActive() {
  const t = act;
  act = actNext;
  actNext = t;
  actNext.fill(0);
  return act;
}
const activateAll = () => actNext.fill(1);
const markActive = c => (actNext[c] = 1);
const acidChunk = new Uint8Array(CWn * CHn);
const dirty = new Uint8Array(CWn * CHn),
  dirtyList = new Int32Array(CWn * CHn);
// chunks changed since the host last sent them to the other players (multiplayer)
const netDirty = new Uint8Array(CWn * CHn);
let dirtyN = 0;
function markDirty(x, y, r) {
  const cx0 = Math.max(0, (x - r) >> 5),
    cx1 = Math.min(CWn - 1, (x + r) >> 5),
    cy0 = Math.max(0, (y - r) >> 5),
    cy1 = Math.min(CHn - 1, (y + r) >> 5);
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * CWn + cx;
      netDirty[c] = 1;
      if (!dirty[c]) {
        dirty[c] = 1;
        dirtyList[dirtyN++] = c;
      }
    }
}
function activate(x, y) {
  const cx = x >> 5,
    cy = y >> 5;
  for (let j = cy - 1; j <= cy + 1; j++) {
    if (j < 0 || j >= CHn) continue;
    for (let k = cx - 1; k <= cx + 1; k++) {
      if (k < 0 || k >= CWn) continue;
      actNext[j * CWn + k] = 1;
    }
  }
}
function paint(i) {
  // neighbours change their lighting too
  const x = i % W,
    y = (i / W) | 0;
  paintCell(i);
  if (y > 0) paintCell(i - W);
  if (y > 1) paintCell(i - 2 * W);
  if (y < H - 1) paintCell(i + W);
  if (y < H - 2) paintCell(i + 2 * W);
  if (x > 0) paintCell(i - 1);
  if (x > 1) paintCell(i - 2);
  if (x < W - 1) paintCell(i + 1);
  if (x < W - 2) paintCell(i + 2);
  markDirty(x, y, 2);
  activate(x, y);
}
// cheaper repaint when solidity did not change (liquid flowing through air): the tunnel
// shading only depends on solid cells, so the direct neighbours are enough
function paintNear(i) {
  const x = i % W,
    y = (i / W) | 0;
  paintCell(i);
  if (y > 0) paintCell(i - W);
  if (y < H - 1) paintCell(i + W);
  if (x > 0) paintCell(i - 1);
  if (x < W - 1) paintCell(i + 1);
  markDirty(x, y, 1);
  activate(x, y);
}
function flush() {
  // upload only the 32×32 chunks that changed: scattered changes stay cheap
  for (let k = 0; k < dirtyN; k++) {
    const c = dirtyList[k];
    dirty[c] = 0;
    const cx = c % CWn,
      cy = (c / CWn) | 0;
    wctx.putImageData(img, 0, 0, cx * CS * RES, cy * CS * RES, CS * RES, CS * RES);
  }
  dirtyN = 0;
}
const matAt = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? AIR : mat[y * W + x]);
const solid = (x, y) => {
  if (x < 0 || x >= W || y >= H) return true;
  if (y < 0) return false;
  return SOLID[mat[y * W + x]] === 1;
};
function setMat(x, y, m) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = y * W + x;
  mat[i] = m;
  paint(i);
}
function boxFree(x, y, w, h) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) if (solid(xx, yy)) return false;
  return true;
}
// collision incl. elevator cases
function free(x, y, w, h) {
  if (!boxFree(x, y, w, h)) return false;
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  for (const b of builds) {
    if (b.type === 'gate' && b.done && (b.open || 0) < 0.6) {
      const gx = b.x + 2,
        gy0 = b.gy - b.h + 2;
      if (x0 < gx + 4 && x0 + w > gx && y0 < b.gy && y0 + h > gy0) return false;
      continue;
    }
    if (!b.cs || !b.done) continue;
    const c = b.cs,
      cy = Math.floor(c.y);
    if (x0 < c.x + 12 && x0 + w > c.x && y0 < cy + 2 && y0 + h > cy) return false;
  }
  return true;
}
// ?seed=123 in the address makes worlds reproducible (used by the tests)
const seedParam = new URLSearchParams(location.search).get('seed');
// (otherwise a random start; multiplayer sets the host's seed with setSeed before gen)
let seed = seedParam === null ? (Math.random() * 4294967296) >>> 0 : Number(seedParam) >>> 0;
const setSeed = n => (seed = n >>> 0);
const getSeed = () => seed;
const seeded = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = seeded,
  ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export {
  paintNear,
  netDirty,
  paintCell,
  RES,
  paintAll,
  GEM,
  setGroundTop,
  activateAll,
  markActive,
  swapActive,
  ACID,
  AIR,
  BLAST,
  CHn,
  COAL,
  CS,
  CWn,
  EARTH,
  GOAL,
  GOLD,
  GRANITE,
  H,
  LAVA,
  LIQ,
  LOAM,
  MINI,
  ORE,
  PAL,
  PLANK,
  ROCK,
  SAND,
  SOLID,
  TUN,
  W,
  WATER,
  acidChunk,
  activate,
  bg,
  boxFree,
  clamp,
  colorOf,
  flush,
  free,
  hex,
  img,
  mat,
  matAt,
  paint,
  px,
  rgba,
  ri,
  rnd,
  getSeed,
  setSeed,
  setMat,
  shade,
  solid,
  stamp,
  surf,
  wc,
  wctx,
};
