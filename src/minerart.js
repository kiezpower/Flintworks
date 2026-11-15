// First illustrated atlas: 6 frames × idle, walk, shovel, pick. Pixels are
// normalised once at load, not redrawn or rescaled independently every tick.
import sheetUrl from './assets/miners/bruno.png';
import { outfitPal } from './skins.js';
const COLS = 6, ROWS = 4, CELL = 64;
const ROW = { idle: 0, walk: 1, shovel: 2, pick: 3 };
// Source pivots measured at the body/feet (not at the end of the swinging tool).
// Generated frames drift within their cells; explicit pivots keep the miner grounded.
const PIVOTS = [
  [[145,239],[140,239],[134,239],[127,239],[119,239],[112,239]],
  [[145,236],[135,236],[129,236],[123,236],[117,236],[111,236]],
  [[130,236],[122,236],[116,236],[108,233],[102,233],[96,236]],
  [[136,231],[129,231],[122,231],[116,234],[110,235],[103,231]],
];
let original = null;
let minerArtLoaded = false;
const variants = new Map();
const image = new Image();
const minerArtReady = new Promise(resolve => {
  image.onload = () => {
    if (image.naturalWidth !== 1536 || image.naturalHeight !== 1024) return resolve(false);
    original = document.createElement('canvas');
    original.width = COLS * CELL; original.height = ROWS * CELL;
    const ctx = original.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, original.width, original.height);
    // Remove the soft alpha fringe so the atlas reads as clean pixel art in-game.
    const pixels = ctx.getImageData(0, 0, original.width, original.height);
    for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] > 128 ? 255 : 0;
    ctx.putImageData(pixels, 0, 0);
    minerArtLoaded = true;
    resolve(true);
  };
  image.onerror = () => resolve(false); // existing pixel art remains a complete fallback
});
image.src = sheetUrl;
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function variant(cap, outfit, mode) {
  const key = `${cap}|${outfit}|${mode}`;
  if (variants.has(key)) return variants.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = original.width; canvas.height = original.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(original, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), data = pixels.data;
  const capRgb = rgb(cap), shirt = outfitPal(outfit).T;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = Math.floor(i / 4 / canvas.width) % CELL;
    let target, light;
    if (r > 65 && r > g * 1.6 && r > b * 1.7 && y < 32) { target = capRgb; light = r / 190; }
    else if (shirt && b > r * 1.2 && b > g * 1.08 && r < 130) { target = rgb(shirt); light = b / 145; }
    if (target) for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round(target[c] * light));
    if (mode === 'hurt' && Math.max(r, g, b) > 65) {
      data[i] = 255; data[i + 1] = 106; data[i + 2] = 90;
    } else if (mode === 'dead') {
      const grey = Math.round((r + g + b) / 3);
      data[i] = grey; data[i + 1] = grey; data[i + 2] = Math.min(255, grey + 8);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  if (variants.size >= 16) variants.delete(variants.keys().next().value);
  variants.set(key, canvas);
  return canvas;
}
// x/y are the body centre and foot baseline. Scale .5 gives the existing
// 16×20 portrait size, .25 the in-game size; physics and hitboxes do not change.
function drawMinerFrame(g, x, y, f, action, frame, cap, outfit, scale = .25, mode = '') {
  if (!original) return false;
  const row = ROW[action] ?? 0, col = ((Math.floor(frame) % COLS) + COLS) % COLS;
  const [px, py] = PIVOTS[row][col].map(v => v / 4);
  g.save();
  g.translate(x, y); g.scale(f > 0 ? scale : -scale, scale);
  g.imageSmoothingEnabled = false;
  g.drawImage(variant(cap, outfit, mode), col * CELL, row * CELL, CELL, CELL, -px, -py, CELL, CELL);
  g.restore();
  return true;
}
export { drawMinerFrame, minerArtReady, minerArtLoaded };
