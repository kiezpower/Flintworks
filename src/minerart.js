// Native-resolution atlases for all six heroes. Frame-sized colour variants are
// cached; the source is never reduced to a tiny pixel grid before a large preview.
import anna from './assets/miners/anna.png';
import bruno from './assets/miners/bruno.png';
import mika from './assets/miners/mika.png';
import juna from './assets/miners/juna.png';
import toni from './assets/miners/toni.png';
import nora from './assets/miners/nora.png';
import metadata from './assets/miners/atlas.json';
import { outfitPal } from './skins.js';
const urls = { anna, bruno, mika, juna, toni, nora };
const ROW = { idle: 0, walk: 1, shovel: 2, pick: 3 };
const sources = new Map(), variants = new Map();
let minerArtLoaded = 0; // generation counter also invalidates partially loaded lobby portraits
const loads = Object.entries(urls).map(([hero, url]) => new Promise(resolve => {
  const image = new Image();
  image.onload = () => {
    const meta = metadata[hero];
    if (image.naturalWidth !== meta.width || image.naturalHeight !== meta.height) return resolve(false);
    const canvas = document.createElement('canvas');
    canvas.width = meta.width; canvas.height = meta.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Discard translucent background residue, retaining the illustrated edge coverage.
    for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i] < 128) pixels.data[i] = 0;
    ctx.putImageData(pixels, 0, 0);
    sources.set(hero, canvas); minerArtLoaded++;
    image.onload = image.onerror = null; image.src = '';
    resolve(true);
  };
  image.onerror = () => resolve(false); // per-hero fallback; other sheets still work
  image.src = url;
}));
const minerArtReady = Promise.all(loads).then(results => results.every(Boolean));
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function variant(hero, row, col, cap, outfit, mode) {
  const key = `${hero}|${row}|${col}|${cap}|${outfit}|${mode}`;
  if (variants.has(key)) return variants.get(key);
  const { cellWidth: w, cellHeight: h } = metadata[hero];
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sources.get(hero), col * w, row * h, w, h, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h), data = pixels.data;
  const capRgb = rgb(cap), shirt = outfitPal(outfit).T;
  const shirtRgb = shirt && rgb(shirt);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2], y = Math.floor(i / 4 / w);
    let target, light;
    if (r > 65 && g < r * .46 && b < r * .4 && y < h * .5) { target = capRgb; light = r / 190; }
    else if (shirtRgb && b > r * 1.2 && b > g * 1.08 && r < 130) { target = shirtRgb; light = b / 145; }
    if (target) for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round(target[c] * light));
    if (mode === 'hurt' && Math.max(r, g, b) > 65) {
      data[i] = 255; data[i + 1] = 106; data[i + 2] = 90;
    } else if (mode === 'dead') {
      const grey = Math.round((r + g + b) / 3);
      data[i] = grey; data[i + 1] = grey; data[i + 2] = Math.min(255, grey + 8);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  if (variants.size >= 64) variants.delete(variants.keys().next().value);
  variants.set(key, canvas);
  return canvas;
}
// Original scale contract: .5 is a 16×20 portrait; .25 is an 8×10 game
// character. Native source pixels survive larger canvas transforms and DPRs.
function drawMinerFrame(g, x, y, f, action, frame, cap, outfit, scale = .25, mode = '', hero = 'bruno') {
  if (!sources.has(hero)) return false;
  const row = ROW[action] ?? 0, col = ((Math.floor(frame) % 6) + 6) % 6;
  const meta = metadata[hero], [px, py] = meta.pivots[row][col];
  g.save();
  g.translate(x, y); g.scale(f > 0 ? scale : -scale, scale);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const k = meta.unitScale;
  g.drawImage(variant(hero, row, col, cap, outfit, mode), -px * k, -py * k, meta.cellWidth * k, meta.cellHeight * k);
  g.restore();
  return true;
}
export { drawMinerFrame, minerArtReady, minerArtLoaded };
