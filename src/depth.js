// The 2.5D look: depth that only the picture has, the game stays flat (docs/STYLE.md). The ground
// itself gets lit top edges, dark undersides and shadows on the back wall of dug galleries
// (terrainart.js, painted once per chunk). Here, every picture: soft contact shadows under
// everything standing on the ground, a haze where the far scenery meets the play field, and a
// near layer of dark grass and stones in front of the surface that scrolls faster than the world.
// Switched by the option "Tiefe (2,5D)" (settings.js, G.depth); with a struggling device the near
// layer goes first (G.depthLite, main.js).
import { G, animals, crew, items } from './state.js';
import { darkness } from './weather.js';
import { H, SOLID, W, mat, surf } from './world.js';

// how far below a point the ground is (cells), up to max; max when there is none
function dropTo(x, y, max) {
  const cx = Math.round(x);
  if (cx < 0 || cx >= W) return max;
  for (let d = 0; d < max; d++) {
    const yy = Math.round(y) + d;
    if (yy >= H) return max;
    if (yy >= 0 && SOLID[mat[yy * W + cx]] === 1) return d;
  }
  return max;
}
// a soft dark ellipse on the ground, smaller and fainter the higher above it the body is
function shadowAt(ctx, x, feet, w, cx, cy) {
  const d = dropTo(x, feet, 14);
  if (d >= 14) return;
  const k = 1 - d / 14,
    rx = (w / 2 + 1.5) * (0.55 + 0.45 * k),
    sx = x - cx,
    sy = feet + d - cy - 0.4;
  if (sx < -rx || sx > G.VW + rx || sy < -3 || sy > G.VH + 3) return;
  ctx.globalAlpha = 0.32 * k;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, Math.max(0.8, rx * 0.28), 0, 0, Math.PI * 2);
  ctx.fill();
}
function drawContactShadows(ctx, cx, cy) {
  if (!G.depth) return;
  ctx.save();
  ctx.fillStyle = '#140c06';
  for (const c of crew) if (!c.dead && c.ride == null) shadowAt(ctx, c.x + 3, c.y + 10, 6, cx, cy);
  for (const a of animals) if (a.kind !== 'worm' && !a.fly) shadowAt(ctx, a.x + (a.w || 6) / 2, a.y + (a.h || 6), a.w || 6, cx, cy);
  for (const it of items) shadowAt(ctx, it.x + (it.w || 3) / 2, it.y + (it.h || 3), it.w || 3, cx, cy);
  ctx.restore();
}

// the air between the far scenery and the play field: a light haze just above the ground line
// (bluish by day, dark at night), so the backdrop falls back behind the world
function drawHaze(ctx, cx, cy) {
  if (!G.depth) return;
  const x0 = Math.max(0, Math.floor(cx)),
    x1 = Math.min(W - 1, Math.ceil(cx + G.VW));
  let ground = Infinity;
  for (let x = x0; x <= x1; x += 8) ground = Math.min(ground, surf[x]);
  const y = ground - cy;
  if (!isFinite(y) || y < -10 || y > G.VH + 40) return;
  const n = darkness(),
    col = n > 0.4 ? '18,24,44' : '214,228,240',
    g = ctx.createLinearGradient(0, y - 46, 0, y + 2);
  g.addColorStop(0, `rgba(${col},0)`);
  g.addColorStop(1, `rgba(${col},${(n > 0.4 ? 0.32 : 0.3) * (1 - 0.4 * Math.min(1, n))})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.max(0, y - 46), G.VW, Math.min(G.VH, y + 2) - Math.max(0, y - 46));
}

// ---- the near layer: tufts and stones in front of the surface, scrolling at 1.3 ----
const NEAR = 1.3,
  STEP = 9;
const hash = n => {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
// players, their names and markers stay clear: the near layer fades out around them
function clearOf(sx, sy, cx, cy) {
  let a = 1;
  for (const c of crew) {
    if (c.dead) continue;
    const d = Math.hypot(c.x + 3 - cx - sx, c.y + 2 - cy - sy);
    a = Math.min(a, Math.max(0, (d - 10) / 22));
  }
  for (const p of G.pins || []) {
    const d = Math.hypot(p.x - cx - sx, p.y - cy - sy);
    a = Math.min(a, Math.max(0, (d - 8) / 18));
  }
  return a;
}
function drawNear(ctx, cx, cy) {
  if (!G.depth || G.depthLite || G.res !== 2) return;
  const n = darkness(),
    tone = n > 0.4 ? '6,8,14' : '24,20,12';
  // positions in the near layer: every STEP pixels a spot that may hold a tuft or a stone
  const k0 = Math.floor((cx * NEAR) / STEP) - 1,
    k1 = Math.ceil(((cx + G.VW) * NEAR) / STEP) + 1;
  ctx.save();
  for (let k = k0; k <= k1; k++) {
    const r = hash(k);
    if (r < 0.45) continue;
    const sx = k * STEP - cx * NEAR + r * 5,
      wx = Math.round(sx + cx);
    if (wx < 0 || wx >= W || sx < -8 || sx > G.VW + 8) continue;
    // a little below the ground line, so it stands in front of the ground's edge
    const sy = surf[wx] - cy + 3 + (cy * (NEAR - 1)) * 0.15;
    if (sy < -10 || sy > G.VH + 10) continue;
    const a = clearOf(sx, sy - 3, cx, cy) * (0.5 + 0.2 * r);
    if (a < 0.04) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = `rgb(${tone})`;
    if (r > 0.88) {
      // a stone
      ctx.beginPath();
      ctx.ellipse(sx, sy, 2.5 + r * 2, 1.6 + r, 0, Math.PI, 0);
      ctx.fill();
    } else {
      // a tuft of grass: a few blades, gently swaying
      const sway = Math.sin(G.frame * 0.03 + k) * 0.6,
        blades = 3 + Math.floor(r * 4);
      for (let b = 0; b < blades; b++) {
        const bx = sx + (b - blades / 2) * 1.1,
          h = 3 + hash(k * 7 + b) * 5;
        ctx.beginPath();
        ctx.moveTo(bx - 0.5, sy);
        ctx.lineTo(bx + sway + (b - blades / 2) * 0.4, sy - h);
        ctx.lineTo(bx + 0.6, sy);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

export { drawContactShadows, drawHaze, drawNear };
