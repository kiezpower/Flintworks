// Small surface details: grass tufts, flowers, dry bushes, pebbles. Purely visual.
import { G } from './state.js';
import { AIR, EARTH, SAND, W, mat, ri, rnd } from './world.js';
import { topSolid } from './gen.js';

const decor = [];
const FLOWERS = ['#e8504a', '#f2c230', '#ffffff', '#b46ae0'];
function pickKind() {
  const r = rnd();
  if (G.biome === 'desert') return r < 0.4 ? 'bush' : r < 0.7 ? 'pebble' : null;
  if (G.biome === 'winter') return r < 0.3 ? 'stalks' : r < 0.5 ? 'pebble' : null;
  return r < 0.6 ? 'grass' : r < 0.85 ? 'flower' : 'pebble';
}
function scatterDecor() {
  decor.length = 0;
  for (let x = 3; x < W - 3; x += ri(2, 6)) {
    const y = topSolid(x),
      m = mat[y * W + x];
    if (m !== EARTH && m !== SAND) continue;
    const kind = pickKind();
    if (kind) decor.push({ x, y, kind, c: FLOWERS[ri(0, 3)], h: ri(2, 3) });
  }
}
// drop details whose ground was dug away or covered
function updDecor() {
  for (let k = decor.length - 1; k >= 0; k--) {
    const d = decor[k],
      i = d.y * W + d.x;
    if (mat[i] === AIR || mat[i - W] !== AIR) decor.splice(k, 1);
  }
}
function drawDecor(ctx, cx, cy) {
  for (const d of decor) {
    const x = d.x - cx,
      y = d.y - cy;
    if (x < -2 || x > G.VW + 2 || y < 0 || y > G.VH + 4) continue;
    if (d.kind === 'grass') {
      ctx.fillStyle = '#4f8a34';
      ctx.fillRect(x - 1, y - d.h + 1, 1, d.h - 1);
      ctx.fillRect(x + 1, y - d.h + 1, 1, d.h - 1);
      ctx.fillStyle = '#6fae4a';
      ctx.fillRect(x, y - d.h, 1, d.h);
    } else if (d.kind === 'flower') {
      ctx.fillStyle = '#4f8a34';
      ctx.fillRect(x, y - 2, 1, 2);
      ctx.fillStyle = d.c;
      ctx.fillRect(x, y - 3, 1, 1);
    } else if (d.kind === 'bush') {
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(x, y - 2, 1, 2);
      ctx.fillRect(x - 1, y - 3, 1, 1);
      ctx.fillRect(x + 1, y - 3, 1, 1);
    } else if (d.kind === 'stalks') {
      ctx.fillStyle = '#9a8a6a';
      ctx.fillRect(x, y - d.h, 1, d.h);
      ctx.fillRect(x + 1, y - 1, 1, 1);
    } else {
      ctx.fillStyle = '#8a847c';
      ctx.fillRect(x, y - 1, 2, 1);
    }
  }
}

export { drawDecor, scatterDecor, updDecor };
