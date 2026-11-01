// The yellow goal arrow: above a goal on screen, or at the screen edge pointing towards it. Used by
// the tutorial (tutorial.js) and at the start of a round (startcue.js). Kept apart, without other
// game modules, so importing it never creates a cycle.
import { G } from './state.js';

function drawArrow(ctx, tx, ty) {
  const sx = tx,
    sy = ty - 6 + (G.reduceMotion ? 0 : Math.sin(G.frame * 0.15) * 2);
  const m = 8,
    inside = sx > m && sx < G.VW - m && sy > m && sy < G.VH - m;
  const x = Math.min(G.VW - m, Math.max(m, sx)),
    y = Math.min(G.VH - m, Math.max(m, sy));
  const ang = inside ? Math.PI / 2 : Math.atan2(sy - y, sx - x);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(ang);
  ctx.fillStyle = '#1a120c';
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.fill();
  ctx.fillStyle = '#f2c230';
  ctx.beginPath();
  ctx.moveTo(3.5, 0);
  ctx.lineTo(-3, -3.5);
  ctx.lineTo(-3, 3.5);
  ctx.fill();
  ctx.restore();
}

export { drawArrow };
