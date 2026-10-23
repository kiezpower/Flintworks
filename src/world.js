import { builds } from './state.js';

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
  PLANK = 12;
const SOLID = [0, 1, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 1];
const LIQ = [0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0];
const BLAST = [0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1];
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
];
const colorOf = i => {
  const m = mat[i];
  if (m === AIR) return bg[i] ? TUN[shade[i] & 3] : 0;
  return m === EARTH ? PAL[1][shade[i]] : PAL[m][shade[i] & 3];
};

const wc = document.createElement('canvas');
wc.width = W;
wc.height = H;
const wctx = wc.getContext('2d');
const img = wctx.createImageData(W, H);
const px = new Uint32Array(img.data.buffer);
// dirty rectangle of the world image, flushed once per frame
let dx0 = W,
  dy0 = H,
  dx1 = -1,
  dy1 = -1;
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
  px[i] = colorOf(i);
  const x = i % W,
    y = (i / W) | 0;
  if (x < dx0) dx0 = x;
  if (x > dx1) dx1 = x;
  if (y < dy0) dy0 = y;
  if (y > dy1) dy1 = y;
  activate(x, y);
}
function flush() {
  if (dx1 < 0) return;
  wctx.putImageData(img, 0, 0, dx0, dy0, dx1 - dx0 + 1, dy1 - dy0 + 1);
  dx0 = W;
  dy0 = H;
  dx1 = -1;
  dy1 = -1;
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
const rnd = Math.random,
  ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export {
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
  setMat,
  shade,
  solid,
  stamp,
  surf,
  wc,
  wctx,
};
