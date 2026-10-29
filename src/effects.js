import { biome } from './biomes.js';
// Visual extras: distant mountains, glowing lava, dust and splashes.
import { G, parts } from './state.js';
import { AIR, COAL, GEM, GOLD, LAVA, ORE, W, WATER, mat, rnd } from './world.js';

// Far mountain range with snow caps, drawn behind the hills
function drawMountains(ctx, cx, cy, dark) {
  const night = dark > 0.3;
  const rock = night ? '#27324d' : biome().rock,
    snow = night ? '#8d9bb8' : '#f4f8fb';
  for (let sx = 0; sx < G.VW; sx += 2) {
    const wx = sx + cx * 0.12;
    const r = Math.abs(Math.sin(wx * 0.0065 + 1.7)) * 0.7 + Math.abs(Math.sin(wx * 0.017 + 0.4)) * 0.3;
    const y = Math.round(104 - r * 44 - cy * 0.8);
    if (y >= G.VH) continue;
    ctx.fillStyle = rock;
    ctx.fillRect(sx, y, 2, G.VH - y);
    const line = biome().snowLine;
    if (r > line) {
      ctx.fillStyle = snow;
      ctx.fillRect(sx, y, 2, Math.round((r - line) * 34));
    }
  }
}

// Lava pixels on screen, sampled on a coarse grid (reused for glow and night light)
const lavaSpots = [],
  waterSpots = [],
  gemSpots = [],
  oreSpots = [];
function scanLava(cx, cy) {
  lavaSpots.length = 0;
  waterSpots.length = 0;
  gemSpots.length = 0;
  oreSpots.length = 0;
  for (let y = 1; y < G.VH && lavaSpots.length < 160; y += 3)
    for (let x = 1; x < G.VW; x += 3) {
      const i = (cy + y) * W + cx + x;
      if (mat[i] === WATER && waterSpots.length < 200) {
        // walk up to the surface; glints only sit on open water
        let j = i,
          k = 0;
        while (k < 3 && mat[j - W] === WATER) {
          j -= W;
          k++;
        }
        if (mat[j - W] === AIR) waterSpots.push(x, y - k);
      }
      if (mat[i] === GEM && rnd() < 0.08) gemSpots.push(x, y);
      // gold, gems, ore and coal stay readable in the dimmed underground: how much light each gets
      if (oreSpots.length < 360) {
        const m = mat[i],
          a = m === GOLD ? 0.65 : m === GEM ? 0.75 : m === ORE ? 0.5 : m === COAL ? 0.45 : 0;
        if (a) oreSpots.push(x, y, a);
      }
      if (mat[i] !== LAVA) continue;
      lavaSpots.push(x, y);
      if (mat[i - W] !== LAVA && rnd() < 0.004)
        parts.push({ x: cx + x, y: cy + y - 1, vx: 0, vy: -0.4, l: 25, c: '#ffcf4a', g: -0.004 });
    }
  return lavaSpots;
}
function drawGemSparkles(ctx) {
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < gemSpots.length; k += 2) {
    ctx.fillRect(gemSpots[k], gemSpots[k + 1] - 1, 1, 3);
    ctx.fillRect(gemSpots[k] - 1, gemSpots[k + 1], 3, 1);
  }
}
function drawWaterGlints(ctx) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const t = G.frame >> 3;
  for (let k = 0; k < waterSpots.length; k += 2)
    if ((waterSpots[k] + t * 3) % 17 < 2) ctx.fillRect(waterSpots[k], waterSpots[k + 1], 2, 1);
}
function drawLavaGlow(ctx) {
  const pulse = 0.09 + Math.sin(G.frame * 0.08) * 0.03;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,110,30,${pulse})`;
  for (let k = 0; k < lavaSpots.length; k += 2) ctx.fillRect(lavaSpots[k] - 3, lavaSpots[k + 1] - 3, 7, 7);
  ctx.fillStyle = '#ffe08a';
  for (let k = 0; k < 4 && lavaSpots.length; k++) {
    const j = (Math.floor(rnd() * lavaSpots.length) >> 1) << 1;
    ctx.fillRect(lavaSpots[j], lavaSpots[j + 1], 1, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
}

// Fireflies drift over the meadows on warm nights (no state: positions come from sine waves)
function drawFireflies(ctx, cx, cy, dark) {
  if (dark < 0.3 || biome().name === 'Winter') return;
  const t = G.frame * 0.02;
  for (let k = 0; k < 14; k++) {
    const wx = ((k * 211 + 40 + Math.sin(t * 0.7 + k) * 14) % G.VW) | 0,
      wy = Math.round(G.VH * 0.36 + ((k * 53) % 40) + Math.sin(t + k * 2.1) * 6);
    // only above ground: skip when the spot is inside the soil
    if (mat[(cy + wy) * W + cx + wx] !== AIR) continue;
    const a = (0.5 + 0.5 * Math.sin(t * 3 + k * 1.7)) * Math.min(1, (dark - 0.3) * 3);
    if (a < 0.15) continue;
    ctx.fillStyle = `rgba(255,236,120,${a * 0.35})`;
    ctx.fillRect(wx - 1, wy - 1, 3, 3);
    ctx.fillStyle = `rgba(255,248,190,${a})`;
    ctx.fillRect(wx, wy, 1, 1);
  }
}

// A burst of golden sparks for finished buildings, chests, jobs and castle levels
function celebrate(x, y, n = 22) {
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2,
      v = 0.5 + rnd() * 1.4;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 0.6,
      l: 28 + rnd() * 18,
      c: rnd() < 0.3 ? '#ffffff' : rnd() < 0.6 ? '#ffe066' : '#f2c230',
      g: 0.03,
      s: rnd() < 0.25 ? 2 : 1,
    });
  }
}
// small glint when the pick strikes gold or a gem
function glint(x, y) {
  for (let k = 0; k < 3; k++)
    parts.push({
      x,
      y,
      vx: (rnd() - 0.5) * 1.2,
      vy: -rnd() * 1.1,
      l: 14,
      c: rnd() < 0.5 ? '#ffffff' : '#ffe066',
      g: 0.02,
    });
}

const dust = (x, y, n, col) => {
  for (let k = 0; k < n; k++)
    parts.push({
      x: x + rnd() * 6,
      y,
      vx: (rnd() - 0.5) * 0.8,
      vy: -rnd() * 0.6,
      l: 14 + rnd() * 8,
      c: col,
      g: 0.02,
    });
};
// ---- Pixel effects: a fixed palette, cold against warm, and no soft alpha ramps ----
const FX_PAL = {
  // cold: rain, haze, snow
  rainHead: '#c4dcf4',
  rainTail: '#7e9cc0',
  rainNear: '#dcecff',
  rainFar: '#8ea4c2',
  splash: ['#e6f4ff', '#b4d2f0', '#7e9cc0'],
  ripple: ['#e6f4ff', '#b4d2f0', '#8fb4da'],
  // warm: sparks and embers age from white-hot to dark red
  spark: ['#fff6c0', '#ffcf4a', '#ff7a2a', '#b8361e'],
  // smoke: lit warm right above the fire, cooling to a blue grey as it drifts off
  smoke: ['#d8cfc4', '#c2bdb6', '#a9a8a6', '#8e939c'],
  smokeDark: ['#7a5a48', '#5e5450', '#4a4846', '#3c3e46'],
};
// the finest step on screen: one texel (half a landscape pixel) when drawn at double resolution
const px = () => (G.res === 2 ? 0.5 : 1);
const hash3 = n => (Math.imul(n | 0, 0x9e3779b1) >>> 28) % 3;
// lamp and window light jumps between three brightness steps a few times per second (no smooth wave)
const flicker = seed => [0.84, 0.93, 1][hash3(((G.frame / 7) | 0) * 31 + Math.round(seed) * 17)];

// embers fly up from fires, drift with the wind and cool down in steps
function sparks(x, y, n = 1, up = 1) {
  for (let k = 0; k < n; k++) {
    const l = 18 + rnd() * 22;
    parts.push({
      x: x + (rnd() - 0.5) * 3,
      y,
      vx: G.wind * 0.25 + (rnd() - 0.5) * 0.5,
      vy: -(0.4 + rnd() * 0.7) * up,
      l,
      l0: l,
      pal: FX_PAL.spark,
      g: -0.006,
      s: px(),
    });
  }
}
// a raindrop hitting the ground: dot, crown, two droplets (three frames)
const rainSplash = (x, y) => parts.push({ x, y, vx: 0, vy: 0, g: 0, l: 9, l0: 9, fx: 'splash' });
// a raindrop hitting open water: a ring that widens and fades
const ripple = (x, y) => parts.push({ x, y, vx: 0, vy: 0, g: 0, l: 12, l0: 12, fx: 'ripple' });

// draws one particle at its screen position
function drawPart(ctx, p, x, y) {
  const u = px();
  if (p.fx) {
    const st = Math.min(2, (((1 - p.l / p.l0) * 3) | 0)),
      pal = FX_PAL[p.fx];
    ctx.fillStyle = pal[st];
    if (p.fx === 'ripple') {
      const w = 1 + st * 2;
      ctx.fillRect(x - st, y, w, u);
      return;
    }
    if (st === 0) ctx.fillRect(x, y - u, u, u);
    else if (st === 1) {
      ctx.fillRect(x - 1, y - 1, u, u);
      ctx.fillRect(x + 1, y - 1, u, u);
      ctx.fillRect(x, y - u, u, u);
    } else {
      ctx.fillRect(x - 2, y - u, u, u);
      ctx.fillRect(x + 2, y - u, u, u);
    }
    return;
  }
  if (p.rain && !p.snow) {
    // a slanted streak along its motion: bright head, darker tail, every texel on the grid
    const sl = p.vy > 0.3 ? p.vx / p.vy : 0,
      n = p.vy > 1.6 ? 3 : 2,
      fx = p.x - Math.floor(p.x);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i ? FX_PAL.rainTail : FX_PAL.rainHead;
      ctx.fillRect(x + Math.round((fx - sl * i) / u) * u, y - i, u, 1);
    }
    return;
  }
  if (p.snow) {
    ctx.fillStyle = p.c;
    if (p.big && u < 1) {
      ctx.fillRect(x, y - u, u, u * 3);
      ctx.fillRect(x - u, y, u * 3, u);
    } else ctx.fillRect(x, y, 1, 1);
    return;
  }
  let s = p.s || 1;
  if (p.grow) s += Math.round((1 - p.l / p.l0) * p.grow * 2) / 2;
  ctx.fillStyle = p.pal ? p.pal[Math.min(p.pal.length - 1, ((1 - p.l / p.l0) * p.pal.length) | 0)] : p.c;
  if (p.grow) ctx.fillRect(x - Math.floor(s / 2), y - Math.floor(s / 2), s, s);
  else ctx.fillRect(x, y, s, s);
}

// a pixel disc, row by row (no anti-aliased arc)
function pixelDisc(ctx, x, y, r) {
  x = Math.round(x);
  y = Math.round(y);
  r = Math.round(r);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3);
    ctx.fillRect(x - w, y + dy, w * 2 + 1, 1);
  }
}

// a crisp line from point to point (Bresenham), dot by dot
function pixelLine(ctx, x0, y0, x1, y1, w = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, w, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y0 += sy;
    }
  }
}

const splash = (x, y, n) => {
  for (let k = 0; k < n; k++)
    parts.push({
      x: x + rnd() * 4,
      y,
      vx: (rnd() - 0.5) * 1.6,
      vy: -0.8 - rnd() * 1.4,
      l: 22,
      c: rnd() < 0.5 ? '#9fd0ff' : '#e6f4ff',
    });
};

export {
  FX_PAL,
  drawPart,
  flicker,
  pixelDisc,
  pixelLine,
  px,
  rainSplash,
  ripple,
  sparks,
  oreSpots,
  celebrate,
  glint,
  drawFireflies,
  drawGemSparkles,
  drawLavaGlow,
  drawMountains,
  drawWaterGlints,
  dust,
  scanLava,
  splash,
};
