// Worlds of different sizes: 1400 × 400 worlds stay exactly as they were, small and big worlds
// can be played, drawn, saved and loaded: npm test
import { expect, test } from '@playwright/test';

async function open(page, url = '/') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done' }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  return errors;
}

// a new world from the generator, with a checksum over everything it laid down
const GEN = ([mode, seed, biome, versus, size]) => {
  const w = window.__ww,
    G = w.G;
  Object.assign(G, { nextSeed: seed, nextBiome: biome, nextMode: mode, nextDiff: 'adventure', nextVersus: versus });
  G.nextSize = size;
  // the sand settling while the world is made runs left or right depending on the frame count
  G.frame = 1;
  w.world.stamp.fill(0);
  w.gen();
  G.nextSeed = G.nextSize = null;
  G.nextVersus = false;
  const { mat, bg, shade, surf, W, H } = w.world;
  let h = 2166136261;
  const add = v => {
    h ^= v;
    h = Math.imul(h, 16777619) >>> 0;
  };
  for (let i = 0; i < W * H; i++) add(mat[i] | (bg[i] << 4) | (shade[i] << 5));
  for (let x = 0; x < W; x++) add(surf[x] & 0xffff);
  return { W, H, h, trees: w.trees.length, animals: w.animals.length, crew: w.crew.length };
};

test('worlds of 1400 × 400 come out exactly as before', async ({ page }) => {
  const errors = await open(page);
  // checksums taken from v1.29.0, before worlds could change their size
  const want = [
    [['gold', 7, 'meadow', false], 3541873457],
    [['gold', 99, 'desert', true], 3525443043],
    [['c3', 3303, 'winter', false], 3226257325],
    [['c4', 4404, 'meadow', false], 4017410677],
  ];
  // also after a world of another size
  await page.evaluate(GEN, ['gold', 1, 'meadow', false, [700, 300]]);
  for (const [args, h] of want) {
    const r = await page.evaluate(GEN, [...args, null]);
    expect([r.W, r.H, r.h], args.join(' ')).toEqual([1400, 400, h]);
  }
  expect(errors).toEqual([]);
});

for (const [w, h] of [
  [300, 150],
  [700, 300],
  [2800, 700],
]) {
  test(`a world of ${w} × ${h} can be played and drawn`, async ({ page }) => {
    const errors = await open(page, `/?seed=5&size=${w}x${h}`);
    await page.click('#lbPlay');
    await page.waitForFunction(() => window.__ww.state === 'play');
    const r = await page.evaluate(async () => {
      const w = window.__ww,
        { W, H, mat, SOLID, setMat, AIR } = w.world,
        c = w.crew[0],
        b = w.G.base;
      w.crew.splice(1);
      w.animals.length = 0;
      w.step(120);
      const at = (x, y) => SOLID[mat[Math.floor(y) * W + Math.floor(x)]] === 1,
        onGround = !at(c.x + 3, c.y + 9) && at(c.x + 3, c.y + 11);
      const baseOk = SOLID[mat[(b.gy + 1) * W + b.x + b.w / 2]] === 1;
      // dig in the far corner (the last tile of the world image) and look at it there
      for (let y = H - 40; y < H - 30; y++) for (let x = W - 30; x < W - 10; x++) setMat(x, y, AIR);
      c.x = W - 25;
      c.y = H - 40;
      c.vx = c.vy = 0;
      w.step(30);
      const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      await frame();
      const cv = document.getElementById('cv'),
        d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const cols = new Set();
      for (let k = 0; k < d.length; k += 4 * 97) cols.add((d[k] << 16) | (d[k + 1] << 8) | d[k + 2]);
      const mini = document.getElementById('mini');
      return {
        W,
        H,
        onGround,
        baseOk,
        colours: cols.size,
        mini: [mini.width, mini.height],
        trees: w.trees.length,
      };
    });
    expect([r.W, r.H]).toEqual([w, h]);
    expect(r.onGround).toBe(true);
    expect(r.baseOk).toBe(true);
    expect(r.colours).toBeGreaterThan(8);
    expect(r.mini).toEqual([Math.ceil(w / 4), Math.ceil(h / 4)]);
    expect(r.trees).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('a world of another size is saved and loaded with its size', async ({ page }) => {
  const errors = await open(page, '/?seed=3&size=900x350');
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const r = await page.evaluate(() => {
    const w = window.__ww,
      sum = () => {
        const { mat, bg, W, H } = w.world;
        let h = 0;
        for (let i = 0; i < W * H; i++) h = (Math.imul(h, 31) + (mat[i] | (bg[i] << 4))) >>> 0;
        return [W, H, h];
      };
    w.save();
    const before = sum();
    // another world in between, of the normal size
    Object.assign(w.G, { nextSize: [1400, 400], nextMode: 'gold' });
    w.gen();
    w.G.nextSize = null;
    const between = sum();
    w.load();
    return { before, between, after: sum(), money: w.G.money };
  });
  expect(r.between.slice(0, 2)).toEqual([1400, 400]);
  expect(r.after).toEqual(r.before);
  expect(r.before.slice(0, 2)).toEqual([900, 350]);
  expect(errors).toEqual([]);
});
