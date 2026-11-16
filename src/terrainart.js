// Painted terrain is a view of the real cell map, never a second simulation.
// Native-detail chunks are created only on screen; LRU eviction bounds GPU memory.
const CHUNK = 32, DENSITY = 4, LIMIT = 192, PERIOD = 48, TILE = 192;
const frames = new Map(), cache = new Map();
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
function resetTerrainArt() { cache.clear(); }
function invalidateTerrainArt(cx, cy) { cache.delete(`${cx},${cy}`); }
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
function makeChunk(world, cx, cy) {
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  const w = Math.min(CHUNK, world.W - x0), h = Math.min(CHUNK, world.H - y0);
  const c = document.createElement('canvas'); c.width = w * DENSITY; c.height = h * DENSITY;
  const g = c.getContext('2d'); g.scale(DENSITY, DENSITY);
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
  const lighting = document.createElement('canvas'); lighting.width = w; lighting.height = h;
  const light = lighting.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wx = x0 + x, wy = y0 + y, id = tokenAt(world, wx, wy);
    if (id < 0) continue;
    const tone = world.tone(wy * world.W + wx);
    if (Math.abs(tone - 1) > 0.025) {
      light.fillStyle = tone < 1 ? `rgba(5,9,15,${Math.min(0.8, 1 - tone)})` : `rgba(255,242,213,${Math.min(0.4, (tone - 1) * 0.45)})`;
      light.fillRect(x, y, 1, 1);
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
  g.drawImage(lighting, 0, 0, w, h); g.restore();
  return c;
}
function drawTerrainArt(g, cx, cy, vw, vh, world) {
  if (!frames.size) return false;
  const look = `${world.biome}|${!!world.patterns}`;
  if (owner !== world.mat || palette !== look) { resetTerrainArt(); owner = world.mat; palette = look; }
  g.save(); g.imageSmoothingEnabled = true;
  for (let y = Math.max(0, Math.floor(cy / CHUNK)); y * CHUNK < Math.min(world.H, cy + vh); y++)
    for (let x = Math.max(0, Math.floor(cx / CHUNK)); x * CHUNK < Math.min(world.W, cx + vw); x++) {
      const key = `${x},${y}`;
      let c = cache.get(key);
      if (c) cache.delete(key); else c = makeChunk(world, x, y);
      cache.set(key, c);
      if (cache.size > LIMIT) cache.delete(cache.keys().next().value);
      g.drawImage(c, x * CHUNK - cx, y * CHUNK - cy, c.width / DENSITY, c.height / DENSITY);
    }
  g.restore(); return true;
}
const terrainArtStats = () => ({ chunks: cache.size, limit: LIMIT, density: DENSITY, materials: frames.size });
export { drawTerrainArt, invalidateTerrainArt, resetTerrainArt, terrainArtReady, terrainArtStats };
