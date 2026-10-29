// Weather in pixels: rain in three layers of depth, wet ground and roofs, drips from the eaves,
// snow piling up on the roofs and a crisp lightning bolt. Cold colours, so the warm windows and
// fires stand out against them. Purely visual: nothing here is synced or changes the world.
import { roofTops } from './bfx.js';
import { FX_PAL, pixelLine, px } from './effects.js';
import { surfTops } from './light.js';
import { G, builds, parts } from './state.js';
import { AIR, W, WATER, bg, clamp, mat, rnd } from './world.js';

G.wet = 0; // 0 dry … 1 soaked; the ground darkens and glints while it rains
G.snowAcc = 0; // how thick the snow lies on the roofs, in landscape pixels

const raining = () => G.rainT > 0 && G.biome !== 'winter',
  snowing = () => G.rainT > 0 && G.biome === 'winter';

// every simulation step
function updRainFx() {
  G.wet = clamp(G.wet + (raining() ? 1 / 600 : -1 / 2400), 0, 1);
  G.snowAcc = clamp(G.snowAcc + (snowing() ? 1 / 700 : G.biome === 'winter' ? -1 / 9000 : -1 / 600), 0, 2);
  if (!raining() || parts.length > 1700) return;
  // water runs off the roofs and drips from the eaves
  for (const b of builds) {
    if (!b.done || rnd() > 0.05 * G.wet) continue;
    const t = roofTops(b.type);
    if (!t.length) continue;
    const left = rnd() < 0.5,
      col = left ? 0 : t.length - 1;
    if (t[col] >= b.h) continue;
    parts.push({ x: b.x + col + (left ? -0.5 : 0.5), y: b.gy - b.h + t[col] + 1, vx: 0, vy: 0.3, l: 200, rain: true });
  }
}

// grey-blue haze in hard bands, thicker towards the top (drawn over the sky, behind the hills)
function drawRainHaze(ctx) {
  const n = 4,
    h = Math.ceil(G.VH / n);
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = `rgba(62,76,104,${0.28 - k * 0.05})`;
    ctx.fillRect(0, k * h, G.VW, h);
  }
}
// far layer: thin, slow, short streaks behind the hills
function drawRainFar(ctx) {
  const u = px();
  ctx.fillStyle = FX_PAL.rainFar;
  for (let k = 0; k < 48; k++) {
    const rx = ((k * 53 + G.frame * (0.3 + G.wind * 0.5)) % (G.VW + 20)) - 10,
      ry = ((k * 91 + G.frame * 2.2) % (G.VH + 10)) - 5;
    ctx.fillRect(Math.round(rx / u) * u, Math.round(ry), u, 2);
  }
}
// near layer: a few long, fast, bright drops right in front, only where there is open sky
function drawRainNear(ctx, cx, cy) {
  const u = px(),
    sl = G.wind * 0.3;
  for (let k = 0; k < 18; k++) {
    const x = Math.round(((k * 97 + G.frame * (G.wind * 1.4)) % (G.VW + 30)) - 15),
      y = Math.round(((k * 467 + G.frame * 4.6) % (G.VH + 30)) - 15),
      i = (cy + y) * W + cx + x;
    if (cy + y < 0 || cx + x < 0 || cx + x >= W || mat[i] !== AIR || bg[i]) continue;
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = j < 2 ? FX_PAL.rainNear : FX_PAL.rainHead;
      ctx.fillRect(x - Math.round((sl * j) / u) * u, y - j, u, 1);
    }
  }
}

// wet ground: the top edge darkens a little and catches glints of light
function drawWet(ctx, cx, cy) {
  if (G.wet < 0.02) return;
  const tops = surfTops(cx),
    u = px(),
    t = G.frame >> 4;
  ctx.fillStyle = `rgba(18,28,56,${0.3 * G.wet})`;
  for (let sx = 0; sx < G.VW; sx++) {
    const top = tops[cx + sx];
    if (top < 0 || top - cy < 0 || top - cy >= G.VH || mat[top * W + cx + sx] === WATER) continue;
    ctx.fillRect(sx, top - cy, 1, 1);
  }
  if (G.wet < 0.4) return;
  ctx.fillStyle = '#dfeeff';
  for (let sx = 0; sx < G.VW; sx++) {
    const top = tops[cx + sx];
    if (top < 0 || (Math.imul(cx + sx, 0x9e3779b1) ^ Math.imul(t, 0x85ebca6b)) >>> 27 !== 0) continue;
    if (top - cy >= 0 && top - cy < G.VH) ctx.fillRect(sx, top - cy, u, u);
  }
}

// roofs in the weather: a cold sheen along the top while it rains, snow piling up in winter
function drawRoofWeather(ctx, b, sx, sy) {
  const t = roofTops(b.type);
  if (!t.length) return;
  const u = px();
  if (G.wet > 0.05 && G.biome !== 'winter') {
    ctx.fillStyle = `rgba(170,198,230,${0.6 * G.wet})`;
    for (let x = 0; x < t.length; x++) if (t[x] < b.h) ctx.fillRect(sx + x, sy + t[x], 1, u);
  }
  const d = Math.round(G.snowAcc / u) * u;
  if (d > 0 && G.biome === 'winter') {
    for (let x = 0; x < t.length; x++) {
      if (t[x] >= b.h) continue;
      ctx.fillStyle = '#f4f8fc';
      ctx.fillRect(sx + x, sy + t[x] - d, 1, d);
      ctx.fillStyle = '#c6d4e4';
      ctx.fillRect(sx + x, sy + t[x] - u, 1, u);
    }
  }
}

// the bolt: a white core with a cold blue rim, side branches, and a flash in three steps
function drawBolt(ctx, cx, cy) {
  const B = G.bolt,
    st = B.l >= 6 ? 0 : B.l >= 3 ? 1 : 2;
  if (st < 2) {
    ctx.fillStyle = st ? 'rgba(170,196,255,0.14)' : 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, 0, G.VW, G.VH);
  }
  const strand = (pts, w) => {
    const o = (w - 1) / 2;
    for (let k = 1; k < pts.length; k++)
      pixelLine(ctx, pts[k - 1][0] - cx - o, pts[k - 1][1] - cy, pts[k][0] - cx - o, pts[k][1] - cy, w);
  };
  const all = [B.pts, ...(B.br || [])];
  ctx.fillStyle = '#8fb0ff';
  for (const p of all) strand(p, 3);
  if (st < 2) {
    ctx.fillStyle = st ? '#dce8ff' : '#ffffff';
    for (const p of all) strand(p, 1);
  }
}

export { drawBolt, drawRainFar, drawRainHaze, drawRainNear, drawRoofWeather, drawWet, updRainFx };
