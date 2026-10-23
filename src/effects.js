import { biome } from './biomes.js';
// Visual extras: distant mountains, glowing lava, dust and splashes.
import { G, parts } from './state.js';
import { AIR, GEM, LAVA, W, WATER, mat, rnd } from './world.js';

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
  gemSpots = [];
function scanLava(cx, cy) {
  lavaSpots.length = 0;
  waterSpots.length = 0;
  gemSpots.length = 0;
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

export { drawGemSparkles, drawLavaGlow, drawMountains, drawWaterGlints, dust, scanLava, splash };
