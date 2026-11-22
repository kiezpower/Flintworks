// Painted terrain is a view of the real cell map, never a second simulation.
// Native-detail chunks are created only on screen; LRU eviction bounds GPU memory.
const CHUNK = 32, DENSITY = 4, LIMIT = 192, PERIOD = 48, TILE = 192;
const frames = new Map(), cache = new Map();
// Chunks whose cells changed keep their old picture until rebuilt. Digging helpers and flowing
// liquids touch the same chunks every frame, so only the REBUILDS oldest ones are repainted per
// picture (the rest follow a frame or two later); chunks not painted yet are always made at once.
const dirty = new Map(), REBUILDS = 4;
let dirtySeq = 0;
const ids = [1, 2, 3, 4, 6, 9, 10, 11, 12, 13, 0, 16];
let owner = null, palette = null;
const image = new Image();
const terrainArtReady = new Promise(resolve => {
  image.onload = () => {
    for (let n = 0; n < ids.length; n++) {
      const x = (n % 4) * image.width / 4, y = Math.floor(n / 4) * image.height / 3;
      // Each swatch becomes a tile that repeats without a seam and without mirror symmetry:
      // towards its edges it cross-fades into itself shifted by half a tile, first across, then down.
      const c = document.createElement('canvas'); c.width = c.height = TILE;
      const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
      g.drawImage(image, x + 4, y + 4, image.width / 4 - 8, image.height / 3 - 8, 0, 0, TILE, TILE);
      const img = g.getImageData(0, 0, TILE, TILE), d = img.data, half = TILE / 2;
      const weight = new Float32Array(TILE);
      for (let k = 0; k < TILE; k++) {
        const t = Math.min(1, Math.max(0, (Math.abs(k - (TILE - 1) / 2) / half - 0.55) / 0.4));
        weight[k] = t * t * (3 - 2 * t);
      }
      for (const down of [false, true]) {
        const from = d.slice();
        for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
          const w = weight[down ? py : px];
          if (!w) continue;
          const i = (py * TILE + px) * 4, j = down ? (((py + half) % TILE) * TILE + px) * 4 : (py * TILE + ((px + half) % TILE)) * 4;
          for (let k = 0; k < 3; k++) d[i + k] = from[i + k] * (1 - w) + from[j + k] * w;
        }
      }
      g.putImageData(img, 0, 0);
      frames.set(ids[n], c);
    }
    resetTerrainArt(); resolve(true);
  };
  image.onerror = () => resolve(false);
  image.src = new URL('./assets/scenes/materials.png', import.meta.url).href;
});
function resetTerrainArt() { cache.clear(); dirty.clear(); }
function invalidateTerrainArt(cx, cy) {
  const key = `${cx},${cy}`;
  if (cache.has(key) && !dirty.has(key)) dirty.set(key, dirtySeq++);
}
function texture(g, id, x, y) {
  const p = g.createPattern(frames.get(id), 'repeat');
  p.setTransform(new DOMMatrix().translate(-x, -y).scale(PERIOD / TILE));
  return p;
}
function tokenAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.W || y >= world.H) return -1;
  const i = y * world.W + x, m = world.mat[i];
  if (!m) return world.bg[i] ? 0 : -1;
  if (m === 1 && (world.shade[i] & 4)) return world.biome === 'desert' ? 4 : 16;
  return frames.has(m) ? m : -1; // liquids and glass keep their specialised renderer
}
// Liquids are painted here as well (they used to be pixel texels in world.js): a body in the
// liquid's colour, soft blobs of light and shadow that hide the cell grid, and a bright band on
// open surfaces. body/light/dark are CSS colours, alpha how much the ground behind shows.
const LIQUID = {
  5: { body: '#3a7dc2', light: '#8fd0ff', dark: '#1f4f8c', alpha: 0.9, rim: '#d5efff' },
  7: { body: '#e8501a', light: '#ffd25a', dark: '#a82a10', alpha: 1, rim: '#fff0a8' },
  8: { body: '#6fcf48', light: '#c9ff9a', dark: '#3d8a2a', alpha: 0.9, rim: '#e8ffd0' },
  14: { body: '#2a2016', light: '#6b5238', dark: '#120c08', alpha: 0.92, rim: '#8a6a48' },
};
const blobs = new Map();
function blob(color) {
  let c = blobs.get(color);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, color); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  blobs.set(color, c); return c;
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function hash2(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function paintLiquids(g, world, x0, y0, w, h) {
  const paths = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w;) {
    const m = world.mat[(y0 + y) * world.W + x0 + x]; let end = x + 1;
    if (LIQUID[m]) {
      while (end < w && world.mat[(y0 + y) * world.W + x0 + end] === m) end++;
      let path = paths.get(m); if (!path) paths.set(m, path = new Path2D());
      path.rect(x, y, end - x, 1);
    }
    x = end;
  }
  for (const [m, path] of paths) {
    const L = LIQUID[m];
    g.save(); g.globalAlpha = L.alpha; g.fillStyle = L.body; g.fill(path); g.restore();
    g.save(); g.clip(path);
    const light = blob(rgba(L.light, 0.55)), dark = blob(rgba(L.dark, 0.5));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (world.mat[(y0 + y) * world.W + x0 + x] !== m) continue;
      const r = hash2(x0 + x, y0 + y), wx = x0 + x, wy = y0 + y;
      if (r < 0.34) { g.globalAlpha = 0.5 + r; g.drawImage(light, x - 1.4 + hash2(wx, wy + 7) * 1.2, y - 1.4 + hash2(wx + 3, wy) * 1.2, 3.4, 3.4); }
      else if (r > 0.62) { g.globalAlpha = 0.45 + (r - 0.62); g.drawImage(dark, x - 1.4 + hash2(wx + 5, wy) * 1.2, y - 1.4 + hash2(wx, wy + 11) * 1.2, 3.4, 3.4); }
      // open surface: a bright band that undulates a little
      if (y0 + y > 0 && world.mat[(y0 + y - 1) * world.W + x0 + x] === 0) {
        g.globalAlpha = 0.7; g.fillStyle = L.rim;
        g.fillRect(x, y + Math.sin(wx * 0.9) * 0.06, 1.02, 0.34);
        g.globalAlpha = 0.25; g.fillRect(x, y + 0.34, 1.02, 0.3);
      }
    }
    g.restore();
  }
}
// one scratch canvas for the per-cell lighting of every chunk (written as pixels, not fillRects)
const lighting = document.createElement('canvas'); lighting.width = lighting.height = CHUNK;
const light = lighting.getContext('2d', { willReadFrequently: true });
const lightImg = light.createImageData(CHUNK, CHUNK);
// reuse: the chunk's previous canvas, repainted in place instead of allocating a new one
function makeChunk(world, cx, cy, reuse) {
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  const w = Math.min(CHUNK, world.W - x0), h = Math.min(CHUNK, world.H - y0);
  let c = reuse, g;
  if (c && c.width === w * DENSITY && c.height === h * DENSITY) {
    g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, c.width, c.height);
  } else {
    c = document.createElement('canvas'); c.width = w * DENSITY; c.height = h * DENSITY;
    g = c.getContext('2d');
  }
  g.scale(DENSITY, DENSITY);
  const paths = new Map();
  // Horizontal runs form exact material masks, including one-cell tunnels.
  for (let y = 0; y < h; y++) for (let x = 0; x < w;) {
    const id = tokenAt(world, x0 + x, y0 + y); let end = x + 1;
    while (end < w && tokenAt(world, x0 + end, y0 + y) === id) end++;
    if (id >= 0) {
      let path = paths.get(id); if (!path) paths.set(id, path = new Path2D());
      path.rect(x, y, end - x, 1);
    }
    x = end;
  }
  for (const [id, path] of paths) {
    g.fillStyle = texture(g, id, x0, y0); g.fill(path);
    const tint = { 3: '#f6c42d70', 10: '#b75c3530', 13: '#4cdaef45' }[id];
    if (tint) { g.fillStyle = tint; g.fill(path); }
    if (id === 16 && world.biome === 'winter') { g.fillStyle = '#ecf4eeed'; g.fill(path); }
  }
  paintLiquids(g, world, x0, y0, w, h);
  const ld = lightImg.data; ld.fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wx = x0 + x, wy = y0 + y, id = tokenAt(world, wx, wy);
    if (id < 0) continue;
    const tone = world.tone(wy * world.W + wx);
    if (Math.abs(tone - 1) > 0.025) {
      const o = (y * CHUNK + x) * 4, dark = tone < 1;
      ld[o] = dark ? 5 : 255; ld[o + 1] = dark ? 9 : 242; ld[o + 2] = dark ? 15 : 213;
      ld[o + 3] = Math.round(255 * (dark ? Math.min(0.8, 1 - tone) : Math.min(0.4, (tone - 1) * 0.45)));
    }
    // Accessible find marks survive the new material art, at world-locked positions.
    if (world.patterns && [3, 10, 11, 13].includes(id)) {
      g.strokeStyle = id === 11 ? '#c1c4bc' : '#33251e'; g.lineWidth = 0.2;
      if (id === 3 && wx % 3 === 0 && wy % 3 === 0) { g.beginPath(); g.arc(x + 0.5, y + 0.5, 0.22, 0, Math.PI * 2); g.stroke(); }
      if (id === 10 && wy % 3 === 0) { g.beginPath(); g.moveTo(x, y + 0.5); g.lineTo(x + 1, y + 0.5); g.stroke(); }
      if (id === 11 && wx % 3 === 0) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 1); g.stroke(); }
      if (id === 13 && (wx + wy) % 3 === 0) { g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x + 1, y); g.stroke(); }
    }
  }
  g.save(); g.globalCompositeOperation = 'source-atop'; g.imageSmoothingEnabled = true;
  light.putImageData(lightImg, 0, 0);
  g.drawImage(lighting, 0, 0, w, h, 0, 0, w, h); g.restore();
  return c;
}
function drawTerrainArt(g, cx, cy, vw, vh, world) {
  if (!frames.size) return false;
  const look = `${world.biome}|${!!world.patterns}`;
  if (owner !== world.mat || palette !== look) { resetTerrainArt(); owner = world.mat; palette = look; }
  // the visible chunks with changed cells, oldest change first, get this picture's rebuilds
  const redo = new Set();
  if (dirty.size) {
    const seen = [];
    for (let y = Math.max(0, Math.floor(cy / CHUNK)); y * CHUNK < Math.min(world.H, cy + vh); y++)
      for (let x = Math.max(0, Math.floor(cx / CHUNK)); x * CHUNK < Math.min(world.W, cx + vw); x++) {
        const key = `${x},${y}`;
        if (dirty.has(key)) seen.push(key);
      }
    seen.sort((a, b) => dirty.get(a) - dirty.get(b));
    for (const key of seen.slice(0, REBUILDS)) redo.add(key);
  }
  g.save(); g.imageSmoothingEnabled = true;
  for (let y = Math.max(0, Math.floor(cy / CHUNK)); y * CHUNK < Math.min(world.H, cy + vh); y++)
    for (let x = Math.max(0, Math.floor(cx / CHUNK)); x * CHUNK < Math.min(world.W, cx + vw); x++) {
      const key = `${x},${y}`;
      let c = cache.get(key);
      if (!c) c = makeChunk(world, x, y);
      else {
        cache.delete(key);
        if (redo.has(key)) { dirty.delete(key); c = makeChunk(world, x, y, c); }
      }
      cache.set(key, c);
      if (cache.size > LIMIT) { const old = cache.keys().next().value; cache.delete(old); dirty.delete(old); }
      g.drawImage(c, x * CHUNK - cx, y * CHUNK - cy, c.width / DENSITY, c.height / DENSITY);
    }
  g.restore(); return true;
}
// A picture of a whole small cut (menus, the blasting range): painted straight onto g, without
// touching the world's chunk cache. False while the materials are not loaded.
function paintTerrainOnce(g, world) {
  if (!frames.size) return false;
  g.save(); g.imageSmoothingEnabled = true;
  for (let y = 0; y * CHUNK < world.H; y++) for (let x = 0; x * CHUNK < world.W; x++) {
    const c = makeChunk(world, x, y);
    g.drawImage(c, x * CHUNK, y * CHUNK, c.width / DENSITY, c.height / DENSITY);
  }
  g.restore(); return true;
}
const terrainArtLoaded = () => frames.size > 0;
const terrainArtStats = () => ({ chunks: cache.size, limit: LIMIT, density: DENSITY, materials: frames.size });
export { drawTerrainArt, paintTerrainOnce, invalidateTerrainArt, resetTerrainArt, terrainArtLoaded, terrainArtReady, terrainArtStats };
