// Small things around finished buildings – barrels, crates, a bit of fence, a lantern post – so a
// row of buildings reads as a settlement (docs/ART_RUBRIC.md, "Welt und Siedlung"). Purely visual:
// no collision, nothing to pick up, not saved and not sent over the network. Which props a
// building gets and on which side follows from its id (a hash), so every device draws the same.
// Lanterns glow at night (render.js asks for lanternSpots).
import { G, builds } from './state.js';
import { darkness } from './weather.js';
import { AIR, W, mat } from './world.js';

const KINDS = ['barrel', 'crate', 'fence', 'lantern', 'barrel', 'crate'];
const SKIP = { flag: 1, gate: 1, stairs: 1, bridge: 1, mast: 1 };
const cache = new Map(); // building id → [{ dx, kind }] (dx relative to the building's left edge)
const hash = n => (Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ (n >>> 13)) >>> 0;

function propsOf(b) {
  let list = cache.get(b.id);
  if (list) return list;
  const h = hash(b.id || 1);
  list = [];
  const n = 2; // (each only where it fits: next to another building there is often room for one)
  for (let k = 0; k < n; k++) {
    const kind = KINDS[(h >>> (4 + k * 5)) % KINDS.length];
    const right = ((h >>> (2 + k)) & 1) === 1;
    list.push({ kind, dx: right ? b.w + 1 + k * 5 : -5 - k * 5 });
  }
  cache.set(b.id, list);
  return list;
}
// is there flat ground for a prop at x (its foot on row gy), clear of other buildings
function fits(x, gy, w) {
  for (let k = 0; k < w; k++) {
    const i = gy * W + x + k;
    if (x + k < 0 || x + k >= W || mat[i] === AIR || mat[i - W] !== AIR || mat[i - 4 * W] !== AIR) return false;
  }
  for (const o of builds) if (x + w > o.x && x < o.x + o.w && gy > o.gy - o.h && gy <= o.gy + 1) return false;
  return true;
}
const visible = b => b.done && !SKIP[b.type] && !(b.hp <= 0);

function drawProps(ctx, cx, cy) {
  for (const b of builds) {
    if (!visible(b) || b.x - cx > G.VW + 20 || b.x + b.w - cx < -20) continue;
    for (const p of propsOf(b)) {
      const x = b.x + p.dx,
        gy = b.gy;
      if (!fits(x, gy, 3)) continue;
      const sx = x - cx,
        sy = gy - cy;
      drawProp(ctx, p.kind, sx, sy);
    }
  }
}
// one prop standing on row sy (the first solid row), drawn in landscape pixels, outline #24160c
function drawProp(ctx, kind, x, y) {
  const r = (dx, dy, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  if (kind === 'barrel') {
    r(0, -5, 4, 5, '#24160c');
    r(1, -4, 2, 3, '#9a6a3a');
    r(1, -4, 2, 1, '#b8824a');
    r(0, -3, 4, 1, '#5a5650');
  } else if (kind === 'crate') {
    r(0, -4, 4, 4, '#24160c');
    r(1, -3, 2, 2, '#b08a52');
    r(1, -3, 2, 1, '#caa46a');
  } else if (kind === 'fence') {
    r(0, -4, 1, 4, '#6a4a2a');
    r(3, -4, 1, 4, '#6a4a2a');
    r(0, -3, 4, 1, '#8a643a');
  } else {
    // lantern post: a pole, an arm, a lamp that is warm at night
    r(1, -8, 1, 8, '#4a3a2a');
    r(1, -8, 3, 1, '#4a3a2a');
    r(3, -7, 1, 2, darkness() > 0.2 ? '#ffd27a' : '#c8b07a');
  }
}
// screen positions of the lanterns in view (for night light, render.js)
function lanternSpots(cx, cy, out) {
  out.length = 0;
  for (const b of builds) {
    if (!visible(b) || b.x - cx > G.VW + 20 || b.x + b.w - cx < -20) continue;
    for (const p of propsOf(b))
      if (p.kind === 'lantern' && fits(b.x + p.dx, b.gy, 3)) out.push(b.x + p.dx + 3 - cx, b.gy - 6 - cy);
  }
  return out;
}

export { drawProps, lanternSpots };
