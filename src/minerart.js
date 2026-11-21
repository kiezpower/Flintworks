// Native-resolution atlases for all six heroes. Frame-sized colour variants are
// cached; the source is never reduced to a tiny pixel grid before a large preview.
import anna from './assets/miners/anna.png';
import bruno from './assets/miners/bruno.png';
import mika from './assets/miners/mika.png';
import juna from './assets/miners/juna.png';
import toni from './assets/miners/toni.png';
import nora from './assets/miners/nora.png';
import actionAnna from './assets/miners/actions/anna.png';
import actionBruno from './assets/miners/actions/bruno.png';
import actionMika from './assets/miners/actions/mika.png';
import actionJuna from './assets/miners/actions/juna.png';
import actionToni from './assets/miners/actions/toni.png';
import actionNora from './assets/miners/actions/nora.png';
import actionMetadata from './assets/miners/actions/atlas.json';
import mobilityAnna from './assets/miners/mobility/anna.png';
import mobilityBruno from './assets/miners/mobility/bruno.png';
import mobilityMika from './assets/miners/mobility/mika.png';
import mobilityJuna from './assets/miners/mobility/juna.png';
import mobilityToni from './assets/miners/mobility/toni.png';
import mobilityNora from './assets/miners/mobility/nora.png';
import mobilityMetadata from './assets/miners/mobility/atlas.json';
import metadata from './assets/miners/atlas.json';
import { minerAction, minerIdentity } from './mineractions.js';
import { outfitPal, parseSkin } from './skins.js';
const urls = { 'anna:mobility': mobilityAnna, 'bruno:mobility': mobilityBruno, 'mika:mobility': mobilityMika, 'juna:mobility': mobilityJuna, 'toni:mobility': mobilityToni, 'nora:mobility': mobilityNora, anna, bruno, mika, juna, toni, nora, 'anna:actions': actionAnna, 'bruno:actions': actionBruno, 'mika:actions': actionMika, 'juna:actions': actionJuna, 'toni:actions': actionToni, 'nora:actions': actionNora };
const atlases = { ...Object.fromEntries(Object.entries(mobilityMetadata).map(([hero, meta]) => [hero + ':mobility', meta])), ...metadata, ...Object.fromEntries(Object.entries(actionMetadata).map(([hero, meta]) => [hero + ':actions', meta])) };
const MOBILITY = { jump: 0, fall: 1, climb: 2, hang: 3, hammer: 4, chop: 5 };
const ROW = { idle: 0, walk: 1, shovel: 2, pick: 3 };
const sources = new Map(), variants = new Map();
let minerArtLoaded = 0; // generation counter also invalidates partially loaded lobby portraits
const loads = new Map();
function loadAtlas(hero) {
  if (!Object.hasOwn(urls, hero)) return Promise.resolve(false);
  if (!loads.has(hero)) {
    loads.set(hero, new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const meta = atlases[hero];
        if (image.naturalWidth !== meta.width || image.naturalHeight !== meta.height) return resolve(false);
        sources.set(hero, image);
        minerArtLoaded++;
        resolve(true);
      };
      image.onerror = () => resolve(false);
      image.src = urls[hero];
    }));
  }
  return loads.get(hero);
}
async function preloadMinerArt({ actions = true } = {}) {
  const keys = Object.keys(urls).filter(hero => actions || Object.hasOwn(metadata, hero));
  return (await Promise.all(keys.map(loadAtlas))).every(Boolean);
}
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function variant(hero, row, col, cap, outfit, mode) {
  const key = `${hero}|${row}|${col}|${cap}|${outfit}|${mode}`;
  if (variants.has(key)) return variants.get(key);
  const { cellWidth: w, cellHeight: h } = atlases[hero];
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Measured bounds exclude detached alpha specks outside the actual figure/tool.
  const [bx, by, bw, bh] = atlases[hero].bounds[row][col];
  ctx.drawImage(sources.get(hero), col * w + bx, row * h + by, bw, bh, bx, by, bw, bh);
  const pixels = ctx.getImageData(0, 0, w, h), data = pixels.data;
  const capRgb = rgb(cap), shirt = outfitPal(outfit).T;
  const shirtRgb = shirt && rgb(shirt);
  for (let i = 0; i < data.length; i += 4) {
    // Discard background residue only in the frame being drawn.
    if (data[i + 3] < 128) {
      data[i + 3] = 0;
      continue;
    }
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
  const special = action === 'throw' || action === 'hook', moving = MOBILITY[action] != null;
  const original = hero;
  if (special) hero += ':actions'; else if (moving) hero += ':mobility';
  if (!sources.has(hero)) {
    loadAtlas(hero);
    return special || moving ? drawMinerFrame(g, x, y, f, 'idle', frame, cap, outfit, scale, mode, original) : false;
  }
  const row = moving ? MOBILITY[action] : special ? (action === 'hook' ? 1 : 0) : ROW[action] ?? 0;
  const count = atlases[hero].pivots[row].length;
  const col = ((Math.floor(frame) % count) + count) % count;
  const meta = atlases[hero], [px, py] = meta.pivots[row][col];
  g.save();
  g.translate(x, y); g.scale(f > 0 ? scale : -scale, scale);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const k = meta.unitScale;
  g.drawImage(variant(hero, row, col, cap, outfit, mode), -px * k, -py * k, meta.cellWidth * k, meta.cellHeight * k);
  g.restore();
  return true;
}
function minerHand(c, frame, reducedMotion = false) {
  const hero = minerIdentity(c, parseSkin(c.skin).hero), key = hero + ':actions';
  const pose = minerAction(c, frame, null, null, reducedMotion);
  if (!sources.has(key) || pose?.action !== 'hook') return { x: 3 + c.face * 2, y: 4 };
  const meta = atlases[key], col = pose.frame;
  const [px, py] = meta.pivots[1][col], [hx, hy] = meta.hands[col], k = meta.unitScale * .25;
  return { x: 3 + (hx - px) * k * c.face, y: 10 + (hy - py) * k };
}
function minerCap(hero, action, frame, face = 1) {
  const moving = MOBILITY[action] != null, special = action === 'throw' || action === 'hook';
  const key = hero + (moving ? ':mobility' : special ? ':actions' : '');
  const meta = atlases[key];
  if (!sources.has(key) || !meta?.heads) return { x: 3, y: 0 };
  const row = moving ? MOBILITY[action] : special ? (action === 'hook' ? 1 : 0) : ROW[action] ?? 0;
  const col = ((Math.floor(frame) % meta.pivots[row].length) + meta.pivots[row].length) % meta.pivots[row].length;
  const [hx, hy] = meta.heads[row][col], [px, py] = meta.pivots[row][col], k = meta.unitScale * .25;
  return { x: 3 + (hx - px) * k * face, y: 10 + (hy - py) * k };
}
export { drawMinerFrame, minerCap, minerHand, loadAtlas as preloadMinerAtlas, preloadMinerArt, minerArtLoaded };
