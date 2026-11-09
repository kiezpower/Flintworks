// Treasure maps (like SteamWorld Dig's and Terraria's): in the free modes two great hoards lie
// hidden deep down, far bigger than a chest. A treasure chest may hold a map to one of them (the
// first chest of a world always does, while a hoard is left unknown): then a red cross marks it on
// the map and a red arrow at the screen edge points the way. Digging down to it, the action button
// opens it: a heap of gold and gems. Made with the world (on every device, from the seed, with its
// own random numbers); which are known and opened goes with the game.
import { announce, announceBanner } from './announce.js';
import { celebrate } from './effects.js';
import { spawnItem } from './entities.js';
import { addFloat } from './floats.js';
import { GAME_MODES } from './modes.js';
import { track } from './profile.js';
import { buzz, sfx } from './sound.js';
import { sp, drawHi } from './sprites.js';
import { G } from './state.js';
import { AIR, GRANITE, H, ROCK, W, bg, mat, rnd, surf } from './world.js';

const HW = 12,
  HH = 8;
// a big iron-bound chest on a heap of gold
const HOARD = sp(HW + 4, HH + 2, R => {
  R(0, HH - 1, HW + 4, 3, '#c9a43a');
  R(1, HH - 2, 3, 2, '#f2c230');
  R(HW, HH - 2, 3, 2, '#f2c230');
  R(2, 1, HW, HH - 1, '#7a4a26');
  R(2, 0, HW, 3, '#9a6234');
  R(2, 3, HW, 1, '#4a2a14');
  R(2, 0, 1, HH, '#6e6a64');
  R(HW + 1, 0, 1, HH, '#6e6a64');
  R(7, 0, 1, HH, '#6e6a64');
  R(6, 3, 3, 2, '#f2c230');
  R(7, 4, 1, 1, '#2a1a10');
});
const OPENED = sp(HW + 4, HH + 2, R => {
  R(0, HH - 1, HW + 4, 3, '#8a7240');
  R(2, 0, HW, 3, '#9a6234');
  R(2, 3, HW, HH - 3, '#7a4a26');
  R(3, 3, HW - 2, 1, '#2a1a10');
  R(2, 0, 1, HH, '#6e6a64');
  R(HW + 1, 0, 1, HH, '#6e6a64');
});

function allowed() {
  const M = GAME_MODES[G.mode];
  return !!M && !M.campaign && !M.pkg && !M.daily && !G.tut;
}

// called by gen() after the shrines: a low hall with a rock floor for each hoard, deep down
function placeHoards(n) {
  G.hoards = [];
  if (!allowed() || H < 220) return;
  let s = (G.seed * 3266489917 + 0x85ebca6b) >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let k = 0; k < n; k++) {
    // (one in each half of the world, away from the edges)
    const x = Math.floor(W * (k + 0.2 + r() * 0.6) / n),
      cx = Math.max(60, Math.min(W - 60, x)),
      top = Math.max(surf[cx] + 150, Math.floor(H * 0.62)),
      y = Math.min(H - 10, Math.floor(top + r() * Math.max(1, H - 12 - top)));
    for (let yy = y - 11; yy < y; yy++)
      for (let xx = cx - 11; xx <= cx + 11; xx++) {
        const dx = (xx - cx) / 12,
          dy = (yy - y + 1) / 11;
        if (dx * dx + dy * dy > 1) continue;
        const i = yy * W + xx;
        if (mat[i] === GRANITE) continue;
        mat[i] = AIR;
        bg[i] = 1;
      }
    for (let yy = y; yy < y + 3; yy++) for (let xx = cx - 10; xx <= cx + 10; xx++) if (mat[yy * W + xx] !== GRANITE) mat[yy * W + xx] = ROCK;
    G.hoards.push({ x: cx, y, known: false, open: false });
  }
}

// a chest was opened (treasure.js): maybe a map to a hoard nobody knows of yet
function mapFromChest(x, y) {
  const left = (G.hoards || []).filter(h => !h.known && !h.open);
  if (!left.length) return false;
  const first = !(G.hoards || []).some(h => h.known);
  if (!first && rnd() > 0.4) return false;
  // (the nearest one)
  const h = left.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
  h.known = true;
  addFloat(x, y - 10, '🗺️', '#ffe066');
  // (a banner of its own: the line for short notes is often taken at once by a finished task)
  announceBanner('Eine Schatzkarte!', 'Ein großes Versteck ist auf der Karte mit einem roten Kreuz markiert.');
  return true;
}

const hoardNear = c => (G.hoards || []).find(h => !h.open && Math.abs(c.x + 3 - h.x) < 12 && Math.abs(c.y + 10 - h.y) < 8) || null;
function hoardContext(c) {
  const h = hoardNear(c);
  return h ? { label: 'Öffnen', fn: () => openHoard(h) } : null;
}
function openHoard(h) {
  if (h.open) return;
  h.open = true;
  h.known = true;
  const loot = [];
  for (let k = 0; k < 8; k++) loot.push('nug');
  loot.push('gem', 'gem');
  if (rnd() < 0.5) loot.push('gem');
  loot.forEach((t, k) => spawnItem(t, h.x - 1, h.y - HH - 2, (k - loot.length / 2) * 0.3, -1.8 - rnd(), 6));
  celebrate(h.x, h.y - HH, 60);
  sfx('fanfare');
  sfx('coin', h.x, h.y);
  buzz([40, 60, 90]);
  G.shake = Math.max(G.shake || 0, 3);
  announce('Das große Versteck ist gefunden!');
  track('hoard');
}

function drawHoards(ctx, cx, cy) {
  for (const h of G.hoards || []) {
    const x = Math.round(h.x - HW / 2 - 2 - cx),
      y = Math.round(h.y - HH - 2 - cy);
    if (x < -20 || y < -20 || x > G.VW + 4 || y > G.VH + 4) continue;
    drawHi(ctx, h.open ? OPENED : HOARD, x, y);
    if (!h.open && (G.frame + h.x * 5) % 90 < 10) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 8, y - 3, 1, 3);
      ctx.fillRect(x + 7, y - 2, 3, 1);
    }
  }
}
// a known hoard: a red arrow at the screen edge while it is out of sight
function drawHoardArrow(ctx, cx, cy) {
  for (const h of G.hoards || []) {
    if (!h.known || h.open) continue;
    const sx = h.x - cx,
      sy = h.y - 6 - cy,
      m = 10;
    if (sx > m && sx < G.VW - m && sy > m && sy < G.VH - m) continue;
    const x = Math.min(G.VW - m, Math.max(m, sx)),
      y = Math.min(G.VH - m, Math.max(m, sy)),
      ang = Math.atan2(sy - y, sx - x);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    ctx.fillStyle = '#1a120c';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.fill();
    ctx.fillStyle = '#e8483a';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-3, -3.5);
    ctx.lineTo(-3, 3.5);
    ctx.fill();
    ctx.restore();
  }
}
// on the map: a blinking red cross
function markHoards(mctx, MK, tick) {
  for (const h of G.hoards || []) {
    if (!h.known || h.open) continue;
    mctx.fillStyle = (tick >> 4) & 1 ? '#ff4a3a' : '#ffffff';
    const px = Math.floor(h.x / MK),
      py = Math.floor(h.y / MK);
    for (let d = -3; d <= 3; d++) {
      mctx.fillRect(px + d, py + d, 1, 1);
      mctx.fillRect(px + d, py - d, 1, 1);
    }
  }
}

export { drawHoardArrow, drawHoards, hoardContext, mapFromChest, markHoards, placeHoards };
