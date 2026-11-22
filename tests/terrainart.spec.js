import { expect, test } from '@playwright/test';

async function ready(page) {
  await page.goto('/'); await page.waitForFunction(() => window.__ww);
  await page.evaluate(async () => (await import('/src/terrainart.js')).terrainArtReady);
}

test('painted masks follow digging, tunnels and liquids without changing simulation cells', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { drawTerrainArt, invalidateTerrainArt, terrainArtStats } = await import('/src/terrainart.js');
    const W = 64, H = 64, mat = new Uint8Array(W * H).fill(1), bg = new Uint8Array(W * H), shade = new Uint8Array(W * H);
    const world = { W, H, mat, bg, shade, biome: 'meadow', patterns: false, tone: () => 1 };
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.scale(4, 4);
    const draw = () => { g.clearRect(0, 0, W, H); return drawTerrainArt(g, 0, 0, W, H, world); };
    const at = (x, y) => [...g.getImageData(x * 4 + 2, y * 4 + 2, 1, 1).data];
    const before = mat.slice(); draw();
    const unchanged = mat.every((v, i) => v === before[i]);
    const solid = at(10, 10); mat[10 * W + 10] = 0; invalidateTerrainArt(0, 0); draw(); const air = at(10, 10);
    bg[10 * W + 10] = 1; invalidateTerrainArt(0, 0); draw(); const tunnel = at(10, 10);
    mat[10 * W + 10] = 5; invalidateTerrainArt(0, 0); draw(); const water = at(10, 10);
    const seam = [31, 32].every(x => [31, 32].every(y => at(x, y)[3] === 255));
    const first = c.toDataURL(); world.patterns = true; mat.fill(3); invalidateTerrainArt(0, 0); invalidateTerrainArt(1, 0); invalidateTerrainArt(0, 1); invalidateTerrainArt(1, 1); draw();
    const gold = at(10, 10), changed = first !== c.toDataURL();
    return { unchanged, solid, air, tunnel, water, seam, changed, gold, stats: terrainArtStats() };
  });
  expect(r.unchanged).toBe(true); expect(r.solid[3]).toBe(255); expect(r.air[3]).toBe(0);
  expect(r.tunnel[3]).toBe(255); expect(r.tunnel).not.toEqual(r.solid);
  expect(r.water[3]).toBeGreaterThan(150); expect(r.water[2]).toBeGreaterThan(r.water[0]); // (water is painted blue, terrainart.js)
  expect(r.seam).toBe(true); expect(r.changed).toBe(true); expect(r.gold[0]).toBeGreaterThan(r.gold[2]);
  expect(r.stats.materials).toBe(12);
});

test('real world paint invalidates visible art, and switching worlds cannot reuse stale masks', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww.world;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.scale(4, 4);
    const draw = () => { g.clearRect(0, 0, 32, 32); w.drawWorld(g, 32, 128, 32, 32); return c.toDataURL(); };
    for (let y = 128; y < 160; y++) for (let x = 32; x < 64; x++) { const i = y * w.W + x; w.mat[i] = w.EARTH; w.bg[i] = 1; w.paint(i); }
    const before = draw();
    const i = 140 * w.W + 45; w.mat[i] = w.AIR; w.paint(i); const after = draw();
    const { drawTerrainArt } = await import('/src/terrainart.js');
    const other = { W: 32, H: 32, mat: new Uint8Array(1024), bg: new Uint8Array(1024), shade: new Uint8Array(1024), tone: () => 1 };
    g.clearRect(0, 0, 32, 32); drawTerrainArt(g, 0, 0, 32, 32, other);
    const switched = g.getImageData(40, 40, 1, 1).data[3];
    return { dug: before !== after, switched, restored: draw() === after };
  });
  expect(r).toEqual({ dug: true, switched: 0, restored: true });
});

test('exploring a large world keeps a bounded native-detail cache', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const art = await import('/src/terrainart.js');
    const W = 2800, H = 700;
    const world = { W, H, mat: new Uint8Array(W * H).fill(2), bg: new Uint8Array(W * H), shade: new Uint8Array(W * H), tone: () => 1 };
    const g = document.createElement('canvas').getContext('2d');
    for (let n = 0; n < 240; n++) art.drawTerrainArt(g, (n % 80) * 32, Math.floor(n / 80) * 32, 32, 32, world);
    return art.terrainArtStats();
  });
  expect(r.chunks).toBe(r.limit); expect(r.density).toBe(4);
});

test('unavailable material atlas leaves the original world and lobby usable', async ({ page }) => {
  await page.route('**/assets/scenes/materials.png', route => route.abort());
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: 'Anna', playKind: 'solo' })));
  await ready(page);
  expect(await page.evaluate(async () => (await import('/src/terrainart.js')).terrainArtStats().materials)).toBe(0);
  await page.click('#lbPlay'); await page.waitForFunction(() => window.__ww.state === 'play');
  expect(errors).toEqual([]);
});

test('the same terrain mask changes with biome and find-pattern settings', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const art = await import('/src/terrainart.js');
    const world = { W: 32, H: 32, mat: new Uint8Array(1024).fill(1), bg: new Uint8Array(1024), shade: new Uint8Array(1024).fill(4), biome: 'meadow', tone: () => 1 };
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.scale(4, 4);
    const draw = () => { g.clearRect(0, 0, 32, 32); art.drawTerrainArt(g, 0, 0, 32, 32, world); return c.toDataURL(); };
    const meadow = draw(); world.biome = 'winter'; const winter = draw(); world.biome = 'desert'; const desert = draw();
    world.mat.fill(3); art.invalidateTerrainArt(0, 0); world.patterns = false; const plain = draw(); world.patterns = true; const marked = draw();
    return { winter: meadow !== winter, desert: meadow !== desert, patterns: plain !== marked };
  });
  expect(r).toEqual({ winter: true, desert: true, patterns: true });
});
