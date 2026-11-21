// Compact, cosmetic world feedback. Storage deposits at one location coalesce;
// damage, item types and rewards keep their separate meaning and wire format.
import { itemIcon } from './sprites.js';
import { paintedIcon } from './itemart.js';
import { G } from './state.js';

const floats = [];
function addFloat(x, y, text, col = '#ffffff', item = null) {
  if (G.netHost) G.netEvent(['f', x | 0, y | 0, text, col, item]);
  const storage = /^\+(\d+)\s*▣$/.exec(String(text));
  if (storage) {
    const nearby = floats.find(f => f.storage && f.l > 35 && Math.abs(f.x - x) < 18 && Math.abs(f.originY - y) < 12);
    if (nearby) { nearby.amount += +storage[1]; nearby.text = '+' + nearby.amount; nearby.l = 65; return; }
  }
  const n = Math.min(3, floats.filter(f => f.l > 45 && Math.abs(f.x - x) < 14 && Math.abs(f.originY - y) < 20).length);
  floats.push({ x, y: y - n * 5, originY: y, text: storage ? '+' + storage[1] : text, storage: !!storage, amount: storage ? +storage[1] : 0, c: col, item, l: 70 });
  if (floats.length > 24) floats.shift();
}
function updFloats() {
  for (let k = floats.length - 1; k >= 0; k--) {
    const f = floats[k]; f.y -= G.reduceMotion ? 0 : f.l > 50 ? 0.2 : 0.08;
    if (--f.l <= 0) floats.splice(k, 1);
  }
}
function drawFloats(ctx, cx, cy) {
  if (!floats.length) return;
  ctx.save(); ctx.font = '600 5px "Nunito Sans", sans-serif'; ctx.textBaseline = 'middle';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, f.l / 20);
    const art = f.storage ? paintedIcon('ui:chest') : f.item ? itemIcon(f.item) : null;
    const iw = art || f.storage ? 5 : 0;
    const tw = Math.ceil(ctx.measureText(f.text).width);
    let x = f.x - cx - (tw + iw) / 2; const y = f.y - cy;
    if (art) { ctx.imageSmoothingEnabled = true; ctx.drawImage(art, x, y - 2, 4, 4); }
    else if (f.storage) {
      ctx.fillStyle = '#c6a26a'; ctx.beginPath(); ctx.roundRect(x, y - 1.6, 3.8, 3.2, 0.4); ctx.fill();
      ctx.strokeStyle = '#65523b'; ctx.lineWidth = 0.3; ctx.stroke();
    }
    x += iw;
    ctx.strokeStyle = '#24160c'; ctx.lineWidth = 0.65; ctx.lineJoin = 'round'; ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.c; ctx.fillText(f.text, x, y);
  }
  ctx.restore();
}
const clearFloats = () => (floats.length = 0);
export { addFloat, clearFloats, drawFloats, updFloats };
