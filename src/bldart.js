// Buildings at double resolution with real material detail. The 1× sprites (sprites.js, recoloured
// for building styles in skins.js) say WHAT is where; here every source pixel is read as a
// material – stone, wood, roof, window – and its 2×2 texels are painted with that material's
// detail: joints between stones, grain in planks, overlapping shingles, a glint on glass. It works
// for every building and every building style, because it reads colours, not building names.
// accents (variant 2) adds wear: darker, mossy bottom rows and soot around chimney tops.
// Sizes stay exactly 2w×2h, so collision and placement do not change. Cached per sprite.
import { bevel2x, outlined } from './sprites.js';

const cache = [new WeakMap(), new WeakMap()];
const hash = (x, y) => (Math.imul(x * 73856093 ^ (y * 19349663), 0x9e3779b1) >>> 0) / 4294967296;

// what a colour is made of
function material(r, g, b) {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 510,
    s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255) || 1);
  let h = 0;
  if (mx !== mn) {
    if (mx === r) h = (60 * ((g - b) / (mx - mn)) + 360) % 360;
    else if (mx === g) h = 60 * ((b - r) / (mx - mn)) + 120;
    else h = 60 * ((r - g) / (mx - mn)) + 240;
  }
  if (l < 0.18) return 'dark'; // doors, openings, outlines
  if (l > 0.62 && s > 0.6 && h > 25 && h < 60) return 'glass'; // lit windows
  if (s < 0.14) return l > 0.42 ? 'stone' : 'iron';
  if ((h < 18 || h > 340) && s > 0.4) return 'roof';
  if (h > 190 && h < 235 && s < 0.35) return 'roof'; // slate
  if (h >= 15 && h <= 50 && l < 0.62) return 'wood';
  return 'other';
}
const mul = (c, f) => {
  const r = Math.min(255, (c & 255) * f),
    g = Math.min(255, ((c >>> 8) & 255) * f),
    b = Math.min(255, ((c >>> 16) & 255) * f);
  return ((c & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
};
const rgba = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const MOSS = rgba(0x6f, 0x8a, 0x48),
  GLINT = rgba(0xff, 0xf3, 0xc8),
  SOOT = rgba(0x3a, 0x34, 0x30);

// variant: 1 = material detail, 2 = with wear and soot
function crafted(spr, variant = 1) {
  const memo = cache[variant - 1];
  let o = memo.get(spr);
  if (o) return o;
  const w = spr.width,
    h = spr.height,
    sg = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  sg.canvas.width = w;
  sg.canvas.height = h;
  sg.drawImage(spr, 0, 0);
  const sd = sg.getImageData(0, 0, w, h).data;
  // start from the lit double-resolution copy (light from above, grain), on a fresh canvas
  const lit = bevel2x(spr),
    big = document.createElement('canvas');
  big.width = lit.width;
  big.height = lit.height;
  const g = big.getContext('2d', { willReadFrequently: true });
  g.drawImage(lit, 0, 0);
  const id = g.getImageData(0, 0, big.width, big.height),
    px = new Uint32Array(id.data.buffer),
    W2 = big.width;
  const mat = new Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      mat[y * w + x] = sd[i + 3] < 200 ? null : material(sd[i], sd[i + 1], sd[i + 2]);
    }
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : mat[y * w + x]);
  // the lowest solid row of every column (wear starts there)
  const foot = new Int16Array(w).fill(-1);
  for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) if (at(x, y)) { foot[x] = y; break; }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const m = at(x, y);
      if (!m) continue;
      const t0 = y * 2 * W2 + x * 2, // the cell's four texels: t0, t0+1, t0+W2, t0+W2+1
        r = hash(x, y);
      if (m === 'stone') {
        // stones of two cells with a joint: the right column of every other cell and the bottom
        // row of every second row of cells is mortar-dark; a light chip now and then
        if ((x + (y >> 1)) % 2) {
          px[t0 + 1] = mul(px[t0 + 1], 0.82);
          px[t0 + W2 + 1] = mul(px[t0 + W2 + 1], 0.82);
        }
        if (y % 2) {
          px[t0 + W2] = mul(px[t0 + W2], 0.84);
          px[t0 + W2 + 1] = mul(px[t0 + W2 + 1], 0.8);
        }
        if (r < 0.12) px[t0] = mul(px[t0], 1.12);
      } else if (m === 'wood') {
        // grain: a dark streak along the plank now and then, a knot rarely
        if (r < 0.34) {
          px[t0 + W2] = mul(px[t0 + W2], 0.84);
          px[t0 + W2 + 1] = mul(px[t0 + W2 + 1], 0.84);
        } else if (r > 0.96) px[t0 + 1] = mul(px[t0 + 1], 0.7);
        if (r > 0.5 && r < 0.6) px[t0] = mul(px[t0], 1.1);
      } else if (m === 'roof') {
        // shingles: every cell's lower edge in shadow, every other one a little lighter on top
        px[t0 + W2] = mul(px[t0 + W2], 0.8);
        px[t0 + W2 + 1] = mul(px[t0 + W2 + 1], (x + y) % 2 ? 0.72 : 0.8);
        if ((x + y) % 2) px[t0] = mul(px[t0], 1.1);
      } else if (m === 'glass') {
        // a glint in the upper left of a window pane
        if (at(x - 1, y) !== 'glass' && at(x, y - 1) !== 'glass') px[t0] = GLINT;
      } else if (m === 'iron' && r < 0.3) px[t0 + 1] = mul(px[t0 + 1], 1.15);
      if (variant < 2) continue;
      // wear: the two lowest rows darker, with moss on stone and wood
      const fromFoot = foot[x] - y;
      if (fromFoot >= 0 && fromFoot < 2 && (m === 'stone' || m === 'wood')) {
        px[t0 + W2] = mul(px[t0 + W2], 0.86);
        px[t0 + W2 + 1] = mul(px[t0 + W2 + 1], 0.86);
        if (r < (m === 'stone' ? 0.35 : 0.18)) px[t0 + W2 + (r < 0.1 ? 0 : 1)] = MOSS;
      }
      // soot on the top of chimney pipes (iron grey with open air above)
      if (m === 'iron' && !at(x, y - 1) && r < 0.6) px[t0] = SOOT;
    }
  g.putImageData(id, 0, 0);
  o = outlined(big);
  memo.set(spr, o);
  return o;
}
// the same picture as a panel icon (ui.js opt(): a canvas marked hi is shown at half its size)
function craftedIcon(spr) {
  const o = crafted(spr, 1);
  o.hi = true;
  return o;
}
function drawCrafted(ctx, spr, x, y, variant = 1) {
  const o = crafted(spr, variant);
  ctx.drawImage(o, x - 0.5, y - 0.5, o.width / 2, o.height / 2);
}

export { crafted, craftedIcon, drawCrafted, material };
