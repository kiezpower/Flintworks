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
  // a rounded golden arrowhead with a dark-brown contour and a lit upper edge
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(4.2, 0);
  ctx.lineTo(-3.4, -4);
  ctx.lineTo(-1.6, 0);
  ctx.lineTo(-3.4, 4);
  ctx.closePath();
  ctx.strokeStyle = '#24160c';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const gold = ctx.createLinearGradient(0, -4, 0, 4);
  gold.addColorStop(0, '#ffe27a');
  gold.addColorStop(1, '#e0a020');
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.restore();
}

export { drawArrow };
