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
    ctx.save(); ctx.strokeStyle = '#302e29'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(ax - cx, ay - cy);
    ctx.quadraticCurveTo((ax + bx) / 2 - cx, (ay + by) / 2 - cy + Math.min(16, n / 5), bx - cx, by - cy);
    ctx.stroke(); ctx.restore();
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
function drawProp(g, kind, x, y) {
  g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round';
  const wood = g.createLinearGradient(0, -6, 5, 0); wood.addColorStop(0, '#c4975e'); wood.addColorStop(1, '#62482f');
  const box = (x, y, w, h, radius = 0.3) => { g.beginPath(); g.roundRect(x, y, w, h, radius); g.fill(); };
  const line = (x1, y1, x2, y2, color, width = 0.4) => { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  g.fillStyle = wood;
  if (kind === 'barrel') {
    box(0, -4, 3, 4, 0.7); g.fillStyle = '#dfba7d'; g.beginPath(); g.ellipse(1.5, -3.8, 1.4, 0.45, 0, 0, Math.PI * 2); g.fill();
    for (const dy of [-3, -1]) line(0.15, dy, 2.85, dy, '#687171', 0.4);
  } else if (kind === 'crate') {
    box(0, -3.8, 3.5, 3.8); line(0.3, -3.5, 3.2, -0.3, '#e5bc7c'); line(0.3, -0.3, 3.2, -3.5, '#e5bc7c');
    g.strokeStyle = '#4d3b2b'; g.lineWidth = 0.2; g.strokeRect(0, -3.8, 3.5, 3.8);
  } else if (kind === 'woodpile') {
    for (let k = 0; k < 5; k++) { const px = (k % 3) * 2.1, py = -1.1 - Math.floor(k / 3) * 1.7; g.fillStyle = wood; box(px, py - 1, 2, 1.8, 0.65); g.fillStyle = '#e2bf84'; g.beginPath(); g.ellipse(px + 1.5, py - 0.1, 0.6, 0.8, 0, 0, Math.PI * 2); g.fill(); }
  } else if (kind === 'cart') {
    for (const px of [1.3, 4.7]) { g.fillStyle = '#444b49'; g.beginPath(); g.arc(px, -0.7, 0.9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#aab0a5'; g.beginPath(); g.arc(px, -0.7, 0.3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = wood; box(0, -4.8, 6, 3, 0.5); line(1, -2, 1, -4.6, '#797c70'); line(5, -2, 5, -4.6, '#797c70'); line(5, -5, 7, -5.8, '#a38353');
  } else if (kind === 'sign') {
    const d = G.signDir || 1;
    box(1, -7, 0.7, 7); g.beginPath(); g.moveTo(d > 0 ? 0 : -2, -8); g.lineTo(d > 0 ? 4 : 2, -8); g.lineTo(d > 0 ? 5 : 3, -6.5); g.lineTo(d > 0 ? 4 : 2, -5); g.lineTo(d > 0 ? 0 : -2, -5); g.closePath(); g.fill();
    line(d > 0 ? 1 : 2, -6.5, d > 0 ? 3.6 : -0.8, -6.5, '#efcf8a', 0.35);
  } else if (kind === 'fence') {
    box(0, -4, 0.7, 4); box(3.3, -4, 0.7, 4); line(0, -2.8, 4, -2.8, '#bb9461', 0.7);
  } else {
    box(1, -8, 0.6, 8); line(1, -8, 3.5, -8, '#705a3a');
    g.fillStyle = '#4a4f46'; box(2.7, -7.6, 1.6, 2.5);
    g.fillStyle = darkness() > 0.2 ? '#ffe3a0' : '#ceb77d'; box(3, -7.2, 1, 1.7, 0.2);
  }
  g.restore();
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
