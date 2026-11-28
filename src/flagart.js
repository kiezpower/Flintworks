// A flag on a timber pole, waving (castles, flag posts; drawn by render.js)
import { shade } from './render.js';
import { G } from './state.js';

function drawFlag(ctx, x, y, pole, len, col = '#c8402c') {
  ctx.save(); ctx.lineCap = 'round';
  const timber = ctx.createLinearGradient(x - 0.3, 0, x + 0.7, 0); timber.addColorStop(0, '#d3ad6d'); timber.addColorStop(1, '#64452f');
  ctx.strokeStyle = timber; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x + 0.4, y + pole); ctx.lineTo(x + 0.4, y); ctx.stroke();
  const wave = G.reduceMotion ? 0 : Math.sin(G.frame * 0.12) * 0.7;
  const cloth = ctx.createLinearGradient(0, y, 0, y + 5); cloth.addColorStop(0, shade(col, 1.2)); cloth.addColorStop(1, col);
  ctx.fillStyle = cloth; ctx.beginPath(); ctx.moveTo(x + 1, y + 1);
  ctx.bezierCurveTo(x + len * 0.4, y - 0.2 + wave, x + len * 0.6, y + 3 - wave, x + len + 1, y + 1 + wave);
  ctx.lineTo(x + len, y + 4 + wave); ctx.bezierCurveTo(x + len * 0.6, y + 6 - wave, x + len * 0.4, y + 3.2 + wave, x + 1, y + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e1ba70'; ctx.beginPath(); ctx.arc(x + 0.4, y, 0.65, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

export { drawFlag };
