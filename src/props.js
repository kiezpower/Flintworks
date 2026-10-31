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
  // the castle has a small yard from the start, so a new round does not open on an empty field
  if (b.type === 'base') {
    list.push({ kind: 'woodpile', dx: -9 }, { kind: 'barrel', dx: -14 }, { kind: 'cart', dx: b.w + 2 });
    list.push({ kind: 'sign', dx: b.w + 10 });
    cache.set(b.id, list);
    return list;
  }
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
const WIDE = { woodpile: 7, cart: 7 };
const visible = b => b.done && !SKIP[b.type] && !(b.hp <= 0);

// trodden paths on the ground between neighbouring buildings, and wires from wind wheels to the
// buildings that use power (pump, chemistry, lift) – both only pictures
const POWERED = { pump: 1, chem: 1, lift: 1 };
const row = [];
function drawPaths(ctx, cx, cy) {
  row.length = 0;
  for (const b of builds) if (visible(b) && b.type !== 'tower') row.push(b);
  row.sort((a, b) => a.x - b.x);
  for (let k = 1; k < row.length; k++) {
    const a = row[k - 1],
      b = row[k],
      x0 = a.x + a.w,
      x1 = b.x;
    if (x1 - x0 < 3 || x1 - x0 > 70 || Math.abs(a.gy - b.gy) > 2) continue;
    if (x1 - cx < 0 || x0 - cx > G.VW) continue;
    for (let x = x0; x < x1; x++) {
      const gy = Math.max(a.gy, b.gy);
      // (only on open ground: the row is solid and air is above it)
      let y = gy - 3;
      while (y < gy + 3 && mat[y * W + x] === AIR) y++;
      if (mat[y * W + x] === AIR || mat[(y - 1) * W + x] !== AIR) continue;
      ctx.fillStyle = x % 5 === 0 ? '#b8946a' : '#9c7a4e';
      ctx.fillRect(x - cx, y - cy, 1, 1);
    }
  }
}
function drawWires(ctx, cx, cy) {
  for (const w of builds) {
    if (w.type !== 'wind' || !w.done) continue;
    let best = null,
      bd = 140;
    for (const b of builds) {
      if (!POWERED[b.type] || !b.done) continue;
      const d = Math.abs(b.x - w.x);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (!best) continue;
    // from the top of the wind wheel's mast to the roof of the building, sagging a little
    const ax = w.x + w.w / 2,
      ay = w.gy - w.h + 3,
      bx = best.x + best.w / 2,
      by = best.gy - best.h + 1,
      n = Math.ceil(Math.abs(bx - ax));
    if (Math.max(ax, bx) - cx < 0 || Math.min(ax, bx) - cx > G.VW) continue;
    ctx.fillStyle = '#2a2420';
    for (let k = 0; k <= n; k++) {
      const t = k / n,
        x = ax + (bx - ax) * t,
        y = ay + (by - ay) * t + Math.sin(Math.PI * t) * Math.min(8, n / 10);
      ctx.fillRect(Math.round(x - cx), Math.round(y - cy), 1, 1);
    }
  }
}
function drawProps(ctx, cx, cy) {
  drawPaths(ctx, cx, cy);
  for (const b of builds) {
    if (!visible(b) || b.x - cx > G.VW + 20 || b.x + b.w - cx < -20) continue;
    for (const p of propsOf(b)) {
      const x = b.x + p.dx,
        gy = b.gy;
      if (!fits(x, gy, WIDE[p.kind] || 3)) continue;
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
  } else if (kind === 'woodpile') {
    // three logs below, two above, end grain light
    r(0, -4, 7, 4, '#24160c');
    for (const [lx, ly] of [[0, -2], [2, -2], [4, -2], [1, -4], [3, -4]]) {
      r(lx + 0, ly, 2, 2, '#8a5a2e');
      r(lx + 1, ly, 1, 1, '#d8b07a');
    }
  } else if (kind === 'cart') {
    r(0, -5, 6, 3, '#24160c');
    r(1, -4, 4, 1, '#a0703f');
    r(5, -6, 2, 1, '#6a4a2a');
    r(1, -2, 3, 2, '#24160c');
    r(2, -2, 1, 1, '#8a847c');
  } else if (kind === 'sign') {
    r(1, -7, 1, 7, '#5a3c22');
    r(0, -8, 5, 3, '#24160c');
    r(1, -7, 3, 1, '#c8a46a');
    r(4, -7, 1, 1, '#c8a46a');
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

export { drawProps, drawWires, lanternSpots };
