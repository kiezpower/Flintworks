// Small details: grass tufts, flowers, dry bushes, pebbles on the surface, glowing mushrooms
// and crystals on cave floors deep down (they cut small holes into the dark, render.js), and on
// cave ceilings hanging roots near the surface, stalactites (icicles in winter) further down, some
// of them dripping.
// Purely visual. The caves' own random numbers come from the place (hash), not from rnd(), so the
// world, level previews and network rounds stay exactly as they were.
import { G, parts } from './state.js';
import { AIR, EARTH, GRANITE, H, LOAM, ROCK, SAND, W, mat, ri, rnd, surf } from './world.js';
import { topSolid } from './gen.js';

const decor = [];
const FLOWERS = ['#e8504a', '#f2c230', '#ffffff', '#b46ae0'];
function pickKind() {
  const r = rnd();
  if (G.biome === 'desert') return r < 0.4 ? 'bush' : r < 0.7 ? 'pebble' : null;
  if (G.biome === 'winter') return r < 0.3 ? 'stalks' : r < 0.5 ? 'pebble' : null;
  return r < 0.6 ? 'grass' : r < 0.85 ? 'flower' : 'pebble';
}
// saved: the cave glows of a saved game (so they do not turn up in tunnels dug since)
function scatterDecor(saved = null) {
  decor.length = 0;
  for (let x = 3; x < W - 3; x += ri(2, 6)) {
    const y = topSolid(x),
      m = mat[y * W + x];
    if (m !== EARTH && m !== SAND) continue;
    const kind = pickKind();
    if (kind) decor.push({ x, y, kind, c: FLOWERS[ri(0, 3)], h: ri(2, 3) });
  }
  hangDecor();
  if (saved) {
    for (const [x, y, k, h] of saved) decor.push({ x, y, kind: k ? 'shroom' : 'crystal', h, glow: 1 });
    return;
  }
  // cave floors more than 30 rows under the surface: now and then something that glows
  const FLOOR = { [EARTH]: 1, [LOAM]: 1, [ROCK]: 1 };
  for (let x = 4; x < W - 4; x += 3)
    for (let y = surf[x] + 30; y < H - 12; y++) {
      const i = y * W + x;
      if (!FLOOR[mat[i]] || mat[i - W] !== AIR || mat[i - 2 * W] !== AIR) continue;
      const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
      // (in a cave biome many more, all of its kind: zones.js)
      const z = (G.zones || []).find(z => ((x - z.x) / (z.rx * 1.2)) ** 2 + ((y - z.y) / (z.ry * 1.3)) ** 2 <= 1);
      if (z && h % 100 < 55) decor.push({ x, y, kind: z.kind === 'crystal' ? 'crystal' : 'shroom', h: 2 + (h & 1), glow: 1 });
      else if (!z && h % 100 < 7) decor.push({ x, y, kind: h & 128 ? 'shroom' : 'crystal', h: 2 + (h & 1), glow: 1 });
      y += 6;
    }
}
// cave ceilings: roots hang from earth close under the surface, stalactites from deeper ceilings
// (the place decides, like the cave glows: the same world gets the same ones)
const CEIL = { [EARTH]: 1, [LOAM]: 1, [ROCK]: 2, [GRANITE]: 2 };
function hangDecor() {
  for (let x = 4; x < W - 4; x += 3)
    for (let y = surf[x] + 4; y < H - 12; y++) {
      const i = y * W + x,
        c = CEIL[mat[i]];
      if (!c || mat[i + W] !== AIR || mat[i + 2 * W] !== AIR || mat[i + 3 * W] !== AIR) continue;
      const h = (Math.imul(x, 2654435761) ^ Math.imul(y, 40503)) >>> 0,
        d = y - surf[x];
      if (c === 1 && d < 45 && G.biome !== 'desert' && h % 100 < 30)
        decor.push({ x, y, kind: 'root', h: 4 + ((h >> 8) % 5), side: h & 64 ? 1 : -1, hang: 1 });
      else if (d >= 18 && h % 100 < (c === 2 ? 34 : 16))
        decor.push({
          x,
          y,
          kind: 'stal',
          h: 3 + ((h >> 9) % 5),
          drip: G.biome !== 'desert' && (h >> 12) % 3 === 0,
          t: (h >> 4) % 240,
          hang: 1,
        });
      y += 5;
    }
}
const STAL = {
  meadow: ['#8a847c', '#a8a29a', '#cfc9c0'],
  desert: ['#a08a68', '#bca684', '#d8c6a4'],
  winter: ['#9fc4dc', '#c6e2f2', '#f2faff'],
};
// a drop falls from a dripping stalactite and bursts into a splash where it lands
function drip(x, y) {
  if (parts.length < 1200) parts.push({ x, y, vx: 0, vy: 0.2, l: 80, c: '#b4d2f0', g: 0.06, drop: 1 });
}
// the cave glows, for the save (x, y, 1 = mushroom, height)
// (mushrooms picked for potions are gone, potions.js)
const glowList = () => decor.filter(d => d.glow && !d.picked).map(d => [d.x, d.y, d.kind === 'shroom' ? 1 : 0, d.h]);
// the glowing details in view, as screen positions for the light layer
function glowSpots(cx, cy, out) {
  out.length = 0;
  for (const d of decor)
    if (d.glow && !d.picked && d.x >= cx - 4 && d.x <= cx + G.VW + 4 && d.y >= cy - 4 && d.y <= cy + G.VH + 4)
      out.push(d.x - cx, d.y - cy - 2);
  return out;
}
// drop details whose ground was dug away or covered
function updDecor() {
  for (let k = decor.length - 1; k >= 0; k--) {
    const d = decor[k],
      i = d.y * W + d.x;
    // hanging ones need their ceiling, with air below it
    if (d.hang ? mat[i] === AIR || mat[i + W] !== AIR : mat[i] === AIR || mat[i - W] !== AIR) decor.splice(k, 1);
  }
}
function drawDecor(ctx, cx, cy) {
  for (const d of decor) {
    if (d.picked) continue;
    const x = d.x - cx,
      y = d.y - cy;
    if (x < -2 || x > G.VW + 2 || y < -8 || y > G.VH + 4) continue;
    if (d.kind === 'root') {
      // a dark root, wandering to one side halfway down, with a short hair off it
      for (let k = 1; k <= d.h; k++) {
        ctx.fillStyle = k === d.h ? '#7a5230' : '#5a3a22';
        ctx.fillRect(x + (k > d.h / 2 ? d.side : 0), y + k, 1, 1);
      }
      ctx.fillStyle = '#6a4526';
      ctx.fillRect(x - d.side, y + 2, 1, 1);
      continue;
    }
    if (d.kind === 'stal') {
      // three pixels wide at the ceiling, two in the middle, one at the tip; lit on its left,
      // the tip brightest
      const pal = STAL[G.biome] || STAL.meadow;
      for (let k = 1; k <= d.h; k++) {
        const w = k <= d.h / 3 ? 3 : k <= (d.h * 2) / 3 ? 2 : 1;
        ctx.fillStyle = k === d.h ? pal[2] : pal[0];
        ctx.fillRect(x - (w === 3 ? 1 : 0), y + k, w, 1);
        if (k < d.h && w > 1) {
          ctx.fillStyle = pal[1];
          ctx.fillRect(x - (w === 3 ? 1 : 0), y + k, 1, 1);
        }
      }
      if (d.drip && (G.frame + d.t) % 240 === 0) drip(x + 0.5, y + d.h + 1);
      continue;
    }
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
    } else if (d.kind === 'shroom') {
      // a pale stem, a glowing cap with a brighter top
      ctx.fillStyle = '#d8cfc0';
      ctx.fillRect(x, y - d.h, 1, d.h);
      ctx.fillStyle = '#3fb3a8';
      ctx.fillRect(x - 1, y - d.h - 1, 3, 1);
      ctx.fillStyle = '#9ff2e6';
      ctx.fillRect(x, y - d.h - 2, 1, 1);
    } else if (d.kind === 'crystal') {
      ctx.fillStyle = '#7a4fc4';
      ctx.fillRect(x, y - d.h - 1, 1, d.h + 1);
      ctx.fillRect(x + 1, y - 2, 1, 2);
      ctx.fillStyle = '#d6b8ff';
      ctx.fillRect(x, y - d.h - 1, 1, 1);
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

export { decor, drawDecor, glowList, glowSpots, scatterDecor, updDecor };
