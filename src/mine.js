// Mining infrastructure: wooden support beams that helpers put up in their tunnels (they keep
// the ceiling from caving in), the "dig here" marker and the little job bubbles over the helpers.
import { sfx } from './sound.js';
import { drawItemBig } from './sprites.js';
import { G, crew } from './state.js';
import { takeStock } from './store.js';
import { toast } from './ui.js';
import { SOLID, W, mat, surf } from './world.js';

// is there a beam close to this spot?
function beamNear(x, y, r = 28) {
  if (!G.beams) return false;
  for (const b of G.beams) if (Math.abs(b.x - x) < r && y > b.y0 - r / 2 && y < b.y1 + r / 2) return true;
  return false;
}

// called while a helper digs underground: every few metres of tunnel gets a beam (1 wood)
function tryBeam(c) {
  const x = Math.floor(c.x + 3);
  if (x < 2 || x >= W - 2 || c.y - surf[x] < 14 || beamNear(x, c.y + 5, 24)) return;
  // ceiling just above the head, floor under the feet
  let y0 = -1;
  for (let y = Math.floor(c.y) - 1; y > c.y - 16; y--)
    if (SOLID[mat[y * W + x]] === 1) {
      y0 = y + 1;
      break;
    }
  const y1 = Math.floor(c.y) + 10;
  if (y0 < 0 || SOLID[mat[y1 * W + x]] !== 1) return;
  if (!takeStock('wood', 1)) {
    if (G.frame - (G.noBeamT || -9999) > 3600) {
      G.noBeamT = G.frame;
      toast('Kein Holz für Stützbalken – Einsturzgefahr in den Stollen!');
    }
    return;
  }
  (G.beams ||= []).push({ x, y0, y1 });
  if (G.beams.length > 300) G.beams.shift();
  sfx('hammer', c.x, c.y);
}

// beams whose rock was blasted or dug away fall down
function updBeams() {
  if (!G.beams || G.frame % 60) return;
  G.beams = G.beams.filter(b => SOLID[mat[b.y1 * W + b.x]] === 1 || SOLID[mat[b.y1 * W + b.x + 1]] === 1);
}

function drawBeams(ctx, cx, cy) {
  if (!G.beams) return;
  for (const b of G.beams) {
    const x = b.x - cx,
      y = b.y0 - cy,
      h = b.y1 - b.y0;
    if (x < -8 || x > G.VW + 8 || y > G.VH || y + h < 0) continue;
    // two posts and a cross beam, outlined like everything else
    ctx.fillStyle = '#24160c';
    ctx.fillRect(x - 5, y - 0.5, 11, 2.5);
    ctx.fillRect(x - 4.5, y, 2, h);
    ctx.fillRect(x + 3.5, y, 2, h);
    ctx.fillStyle = '#a06a35';
    ctx.fillRect(x - 4.5, y, 10, 1.5);
    ctx.fillRect(x - 4, y + 1.5, 1, h - 1.5);
    ctx.fillRect(x + 4, y + 1.5, 1, h - 1.5);
    ctx.fillStyle = '#6e4420';
    ctx.fillRect(x - 4.5, y + 1, 10, 0.5);
  }
}

// marker for the mining area
function drawMark(ctx, cx, cy) {
  const m = G.mineMark;
  if (!m) return;
  const x = Math.round(m.x - cx),
    y = Math.round(m.y - cy);
  if (x < -10 || x > G.VW + 10 || y < -14 || y > G.VH + 4) return;
  ctx.fillStyle = '#24160c';
  ctx.fillRect(x - 0.5, y - 12, 2, 13);
  ctx.fillRect(x + 1, y - 12.5, 7, 6);
  ctx.fillStyle = '#e07a2a';
  ctx.fillRect(x + 1, y - 12, 6, 5);
  // a tiny pick on the pennant
  ctx.fillStyle = '#e8e8ee';
  ctx.fillRect(x + 2, y - 11, 4, 1);
  ctx.fillRect(x + 3.5, y - 10, 1, 3);
  ctx.fillStyle = '#c9a26a';
  ctx.fillRect(x, y - 12, 1, 12);
}

// what a helper is up to, shown for a moment when it starts a new job
const BUB = { mine: 'nug', chop: 'wood', build: 'plank', collect: 'rock', deliver: 'nug', train: 'nug' };
function jobBubble(c, type) {
  if (type === 'rest' || type === 'follow' || BUB[type]) c.bub = { t: type, l: 100 };
}
function drawBubbles(ctx, cx, cy) {
  for (const c of crew) {
    const b = c.bub;
    if (!b || c.dead) continue;
    if (--b.l <= 0) {
      c.bub = null;
      continue;
    }
    const x = Math.round(c.x - cx) - 1,
      y = Math.round(c.y - cy) - 12 + (b.l > 90 ? (b.l - 90) * 0.3 : 0);
    ctx.globalAlpha = Math.min(1, b.l / 20);
    ctx.fillStyle = '#24160c';
    ctx.fillRect(x - 0.5, y - 0.5, 9, 8);
    ctx.fillStyle = '#fbf3dc';
    ctx.fillRect(x, y, 8, 7);
    ctx.fillRect(x + 2, y + 7, 2, 1);
    if (b.t === 'rest') {
      ctx.fillStyle = '#3a2414';
      ctx.fillRect(x + 2, y + 1.5, 4, 1);
      ctx.fillRect(x + 4, y + 2.5, 1, 1);
      ctx.fillRect(x + 3, y + 3.5, 1, 1);
      ctx.fillRect(x + 2, y + 4.5, 4, 1);
    } else if (b.t === 'follow') {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(x + 2, y + 2, 2, 2);
      ctx.fillRect(x + 4, y + 2, 2, 2);
      ctx.fillRect(x + 3, y + 4, 2, 1);
    } else drawItemBig(ctx, BUB[b.t], x + 1, y + 1, 6, 5);
    ctx.globalAlpha = 1;
  }
}

export { beamNear, drawBeams, drawBubbles, drawMark, jobBubble, tryBeam, updBeams };
