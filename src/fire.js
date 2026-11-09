// Oil and fire (like Noita and Clonk): oil is a liquid that floats on water and burns. Lava, an
// explosion, a fire arrow or a burning Wühler set it alight; a burning cell spreads to the oil next
// to it, throws flames and smoke, sets alight what stands in it (Wühler, trees) and hurts monsters,
// then burns away. Wood next to the fire (bridges, stairs, beams) chars away, and water poured
// onto burning oil puts it out with a hiss. Only the host (or a single game) runs the fire; the others get the burning cells
// with the game values (net/sync.js) and show the flames.
import { G, animals, crew, parts, trees } from './state.js';
import { track } from './profile.js';
import { AIR, OIL, PLANK, WATER, W, H, activate, mat, paint, rnd } from './world.js';
import { sfx } from './sound.js';

const burning = new Map(); // cell → ticks left to burn
const MAX = 1500; // (a whole lake can burn, but not more cells than this at once)

let lit = 0; // cells set alight since the last report (an achievement, achievements.js)
function igniteCell(i) {
  if (G.netClient || i < 0 || i >= W * H || mat[i] !== OIL || burning.has(i) || burning.size >= MAX) return;
  burning.set(i, 70 + ((rnd() * 70) | 0));
  lit++;
}
// every oil cell within r of a spot catches fire
function igniteNear(x, y, r = 2) {
  if (G.netClient) return;
  x = Math.round(x);
  y = Math.round(y);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx,
        yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H && dx * dx + dy * dy <= r * r) igniteCell(yy * W + xx);
    }
}
const isBurning = i => burning.has(i);
// a plank cell burns away with a flame (fire next to it, or lava: sim.js)
function burnPlank(j) {
  if (G.netClient || mat[j] !== PLANK) return;
  mat[j] = AIR;
  paint(j);
  activate(j % W, (j / W) | 0);
  if (parts.length < 1400) flame(j % W, (j / W) | 0);
}
let hissT = 0;
// a burning cell somewhere in a box (for what stands in the fire)
function fireIn(x, y, w, h) {
  if (!burning.size) return false;
  const x0 = Math.max(0, Math.floor(x) - 1),
    y0 = Math.max(0, Math.floor(y) - 1);
  for (let yy = y0; yy < Math.min(H, y0 + h + 3); yy++)
    for (let xx = x0; xx < Math.min(W, x0 + w + 2); xx++) if (burning.has(yy * W + xx)) return true;
  return false;
}
function flame(x, y) {
  const l = 14 + rnd() * 14;
  parts.push({ x: x + rnd(), y, vx: (rnd() - 0.5) * 0.3 + G.wind * 0.2, vy: -0.4 - rnd() * 0.6, l, l0: l, pal: FLAME, g: -0.01, s: 1.5, grow: 1 });
}
const FLAME = ['#fff6c0', '#ffcf4a', '#ff7a2a', '#b8361e'];
const STEAMC = ['#ffffff', '#eef3f6', '#d6dee4', '#b9c3cb'];
const SMOKE = ['#7a5a48', '#5e5450', '#4a4846', '#3c3e46'];

// every tick (host or single game): spread, flames, what stands in it, and the oil burns away
function updFire() {
  if (G.netClient) return drawOnly();
  if (lit && G.frame % 60 === 0) {
    track('fire', lit);
    lit = 0;
  }
  if (hissT > 0) hissT--;
  if (!burning.size) return;
  const room = parts.length < 1400;
  for (const [i, t] of burning) {
    if (mat[i] !== OIL) {
      burning.delete(i); // (flowed on or was dug away)
      continue;
    }
    const x = i % W,
      y = (i / W) | 0;
    // water on top puts the fire out
    if (i >= W && mat[i - W] === WATER) {
      burning.delete(i);
      if (room && rnd() < 0.5) {
        const l = 40 + rnd() * 30;
        parts.push({ x, y: y - 2, vx: G.wind * 0.2, vy: -0.4, l, l0: l, pal: STEAMC, g: -0.003, s: 1.5, grow: 2.5 });
      }
      if (hissT <= 0) {
        sfx('hiss', x, y);
        hissT = 20;
      }
      continue;
    }
    if (rnd() < 0.2)
      for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1]) if (mat[j] === OIL && rnd() < 0.6) igniteCell(j);
    // wood in the flames chars away within a second or two: beside the fire, or up to three
    // cells above it (flames rise; a bridge over a burning pool burns)
    if (rnd() < 0.1) {
      const up = 1 + ((rnd() * 3) | 0),
        dx = ((rnd() * 3) | 0) - 1,
        j = rnd() < 0.25 ? i + (rnd() < 0.5 ? -1 : 1) : i - up * W + dx;
      if (j >= 0 && mat[j] === PLANK) burnPlank(j);
    }
    if (room && mat[i - W] !== OIL) {
      if (rnd() < 0.3) flame(x, y);
      if (rnd() < 0.03) {
        const l = 40 + rnd() * 30;
        parts.push({ x, y: y - 3, vx: G.wind * 0.3, vy: -0.3, l, l0: l, pal: SMOKE, g: -0.003, s: 2, grow: 2 });
      }
    }
    if (t <= 1) {
      burning.delete(i);
      mat[i] = AIR;
      paint(i);
      activate(x, y);
    } else burning.set(i, t - 1);
  }
  if (G.frame % 6) return;
  // what stands in the fire: Wühler and trees catch fire, monsters get hurt
  for (const c of crew) if (!c.dead && fireIn(c.x, c.y, 6, 10) && !(c.burn > 60)) c.burn = 200;
  for (const a of animals) if (a.kind !== 'slime' && fireIn(a.x, a.y, a.w, a.h)) {
    a.hp -= 9;
    a.hurt = 8;
  }
  for (const tr of trees) if (!tr.fall && !tr.burn && fireIn(tr.x - 3, tr.gy - 4, 6, 4)) G.igniteTree?.(tr);
}
// a guest: the burning cells the host sends, only for the flames
function drawOnly() {
  if (!burning.size || parts.length > 1400) return;
  for (const i of burning.keys()) if (mat[i - W] !== OIL && rnd() < 0.25) flame(i % W, (i / W) | 0);
}
// for the host's game values: the burning cells (at most some hundred, enough for the picture)
function fireCells() {
  if (!burning.size) return null;
  const out = [];
  for (const i of burning.keys()) {
    out.push(i);
    if (out.length >= 400) break;
  }
  return out;
}
function setFireCells(list) {
  burning.clear();
  for (const i of list || []) burning.set(i, 1);
}
// the burning cells on the screen, a few of them, for the light in the dark (render.js)
function fireSpots(cx, cy, out) {
  out.length = 0;
  let k = 0;
  for (const i of burning.keys()) {
    if (k++ % 6) continue;
    const x = (i % W) - cx,
      y = ((i / W) | 0) - cy;
    if (x > -20 && x < G.VW + 20 && y > -20 && y < G.VH + 20) out.push(x, y);
    if (out.length > 120) break;
  }
  return out;
}
const clearFire = () => burning.clear();

export { burnPlank, clearFire, fireCells, fireIn, fireSpots, igniteCell, igniteNear, isBurning, setFireCells, updFire };
