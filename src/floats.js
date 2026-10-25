// Floating text in the world: "+1" on pickups, coins on sales, damage on hits.
import { itemIcon } from './sprites.js';
import { G } from './state.js';

const floats = [];
function addFloat(x, y, text, col = '#ffffff', item = null) {
  if (G.netHost) G.netEvent(['f', x | 0, y | 0, text, col, item]);
  // stack on top of fresh floats at the same spot
  const n = floats.filter(f => f.l > 45 && Math.abs(f.x - x) < 14 && Math.abs(f.y - y) < 20).length;
  floats.push({ x, y: y - n * 9, text, col, item, l: 70 });
  if (floats.length > 24) floats.shift();
}
function updFloats() {
  for (let k = floats.length - 1; k >= 0; k--) {
    const f = floats[k];
    f.y -= f.l > 50 ? 0.5 : 0.15;
    if (--f.l <= 0) floats.splice(k, 1);
  }
}
function drawFloats(ctx, cx, cy) {
  if (!floats.length) return;
  ctx.font = '8px Silkscreen, monospace';
  ctx.textBaseline = 'middle';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, f.l / 20);
    const tw = Math.ceil(ctx.measureText(f.text).width),
      iw = f.item ? 11 : 0;
    let x = Math.round(f.x - cx - (tw + iw) / 2);
    const y = Math.round(f.y - cy);
    if (f.item) {
      ctx.drawImage(itemIcon(f.item), x, y - 5);
      x += iw;
    }
    ctx.fillStyle = '#24160c';
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      ctx.fillText(f.text, x + dx, y + dy);
    ctx.fillStyle = f.col;
    ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
}

// (staged pictures start without leftover texts)
const clearFloats = () => (floats.length = 0);

export { addFloat, clearFloats, drawFloats, updFloats };
