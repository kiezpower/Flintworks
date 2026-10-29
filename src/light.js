// Mood lighting: the world dims with depth below the surface, lamps and lava glow warm through it,
// and a soft vignette frames the picture. Everything is drawn in landscape pixels.
import { G } from './state.js';
import { H, LIQ, SOLID, W, mat, onResize } from './world.js';

const AMB_MAX = 0.58, // darkest the deep underground gets (lamps and lava cut holes into it)
  AMB_LEN = 60, // rows over which the dimming fades in below the surface
  AMB_GAP = 5; // first rows under the surface stay bright
const TINT = '14,8,22';

// first solid or liquid cell of a column; refreshed a few times per second for the visible columns
let colTop = new Int16Array(W).fill(-1);
onResize(() => (colTop = new Int16Array(W).fill(-1)));
function refreshTops(cx) {
  const x1 = Math.min(W, cx + G.VW + 1);
  for (let x = Math.max(0, cx); x < x1; x++) {
    let y = 0;
    while (y < H && !SOLID[mat[y * W + x]] && !LIQ[mat[y * W + x]]) y++;
    colTop[x] = y;
  }
}

const ramp = document.createElement('canvas');
ramp.width = 1;
ramp.height = AMB_LEN;
{
  const g = ramp.getContext('2d'),
    gr = g.createLinearGradient(0, 0, 0, AMB_LEN);
  gr.addColorStop(0, `rgba(${TINT},0)`);
  gr.addColorStop(0.45, `rgba(${TINT},${AMB_MAX * 0.4})`);
  gr.addColorStop(1, `rgba(${TINT},${AMB_MAX})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 1, AMB_LEN);
}

// Paints the depth dimming into the light layer; false when the view is all above ground.
function depthShade(lctx, cx, cy) {
  if (G.frame % 15 === 0 || colTop[Math.min(W - 1, cx + (G.VW >> 1))] < 0) refreshTops(cx);
  lctx.fillStyle = `rgba(${TINT},${AMB_MAX})`;
  let any = false;
  for (let sx = 0; sx < G.VW; sx++) {
    const top = colTop[cx + sx] - cy + AMB_GAP;
    if (top >= G.VH) continue;
    any = true;
    if (top > -AMB_LEN) lctx.drawImage(ramp, sx, top);
    const rest = Math.max(0, top + AMB_LEN);
    if (rest < G.VH) lctx.fillRect(sx, rest, 1, G.VH - rest);
  }
  return any;
}
// the surface row of every visible column (for wet ground); kept fresh without the mood lighting too
function surfTops(cx) {
  if (G.frame % 15 === 7 || colTop[Math.min(W - 1, cx + (G.VW >> 1))] < 0) refreshTops(cx);
  return colTop;
}
// how far below the surface a world position is, 0 (above) to 1 (deep)
function depthAt(x, y) {
  const t = colTop[Math.max(0, Math.min(W - 1, x | 0))];
  return t < 0 ? 0 : Math.max(0, Math.min(1, (y - t - AMB_GAP) / AMB_LEN));
}

// small soft hole in the dimming layer, cached as a sprite; makes ore readable in the dark
const holeSpr = document.createElement('canvas');
holeSpr.width = holeSpr.height = 16;
{
  const g = holeSpr.getContext('2d'),
    gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 16, 16);
}
// lctx must be in 'destination-out' mode
function lightHole(lctx, x, y, r, a) {
  lctx.globalAlpha = a;
  lctx.drawImage(holeSpr, x - r, y - r, r * 2, r * 2);
  lctx.globalAlpha = 1;
}

// warm light that adds up on top of the dimmed picture: three hard rings, from a yellow core to a
// faint orange rim (pixel-art light pools instead of a smooth blur; drawn without smoothing)
const glowSpr = document.createElement('canvas');
glowSpr.width = glowSpr.height = 64;
{
  const g = glowSpr.getContext('2d'),
    rings = [
      [32, 'rgba(255,120,40,0.16)'],
      [22, 'rgba(255,150,70,0.34)'],
      [12, 'rgba(255,200,120,0.7)'],
    ];
  for (const [r, c] of rings) {
    g.fillStyle = c;
    for (let dy = -r; dy < r; dy++) {
      const w = Math.floor(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5)));
      g.fillRect(32 - w, 32 + dy, w * 2, 1);
    }
  }
}
function warmGlow(ctx, x, y, r, a) {
  if (x < -r || x > G.VW + r || y < -r || y > G.VH + r) return;
  ctx.globalAlpha = a;
  ctx.drawImage(glowSpr, x - r, y - r, r * 2, r * 2);
}
function beginGlow(ctx) {
  ctx.globalCompositeOperation = 'lighter';
}
function endGlow(ctx) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
}

// vignette, rebuilt when the view size changes
const vig = document.createElement('canvas');
function drawVignette(ctx) {
  if (vig.width !== G.VW || vig.height !== G.VH) {
    vig.width = G.VW;
    vig.height = G.VH;
    const g = vig.getContext('2d'),
      r = Math.hypot(G.VW, G.VH) / 2,
      gr = g.createRadialGradient(G.VW / 2, G.VH / 2, r * 0.55, G.VW / 2, G.VH / 2, r);
    gr.addColorStop(0, 'rgba(10,6,16,0)');
    gr.addColorStop(1, 'rgba(10,6,16,0.45)');
    g.fillStyle = gr;
    g.fillRect(0, 0, G.VW, G.VH);
  }
  ctx.drawImage(vig, 0, 0);
}

// soft glow around the sun and moon, drawn into the sky
const skyGlows = {};
function skyGlow(ctx, x, y, kind, a) {
  let spr = skyGlows[kind];
  if (!spr) {
    spr = skyGlows[kind] = document.createElement('canvas');
    spr.width = spr.height = 96;
    const g = spr.getContext('2d'),
      gr = g.createRadialGradient(48, 48, 2, 48, 48, 48),
      c = kind === 'sun' ? '255,230,150' : '190,210,255';
    gr.addColorStop(0, `rgba(${c},0.85)`);
    gr.addColorStop(0.3, `rgba(${c},0.25)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 96, 96);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = a;
  ctx.drawImage(spr, x - 36, y - 36, 72, 72);
  endGlow(ctx);
}
// warm tint over the whole picture while the sun is low (sunrise and sunset)
function duskGrade(ctx, sunAlt) {
  const k = Math.max(0, 1 - Math.abs(sunAlt - 0.2) / 0.3);
  if (k < 0.02) return;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(255,170,110,${0.42 * k})`;
  ctx.fillRect(0, 0, G.VW, G.VH);
  ctx.globalCompositeOperation = 'source-over';
}

export { lightHole, duskGrade, surfTops, skyGlow, beginGlow, depthAt, depthShade, drawVignette, endGlow, warmGlow };
