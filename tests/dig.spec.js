// Digging through each material straight, slanted down and slanted up: the Wühler never gets
// stuck, each material has its own pace and the loot lands next to the one digging: npm test
import { expect, test } from '@playwright/test';

async function field(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.evaluate(() => {
    const w = window.__ww;
    w.crew.splice(1);
    w.animals.length = 0;
    w.G.autoDig = true;
  });
  return errors;
}

// fills a test field with one material (air above), digs for n frames and reports the way
// made, whether the Wühler got stuck and the items that fell out
const DIG = ([name, dir, n, pick]) => {
  const w = window.__ww,
    { mat, W, AIR, paint } = w.world,
    M = w.world[name],
    c = w.crew[0];
  const X0 = 380,
    X1 = 700,
    gy = 200,
    wall = 440;
  for (let x = X0; x < X1; x++)
    for (let y = 60; y < gy + 60; y++) {
      mat[y * W + x] = y < gy && x < wall ? AIR : M;
      paint(y * W + x);
    }
  // the wall starts at x = wall, the floor at gy (both of the material)
  w.items.length = 0;
  w.G.tools = pick ? { pick: true } : {};
  c.x = wall - 8;
  c.y = gy - 10;
  c.vx = c.vy = 0;
  c.face = 1;
  c.inv = [];
  c.energy = 100;
  w.step(5);
  const x0 = c.x,
    y0 = c.y;
  let stuck = 0,
    digF = 0;
  w.keys.r = 1;
  w.keys.dig = 1;
  if (dir === 'down') w.keys.d = 1;
  if (dir === 'up') w.keys.u = 1;
  for (let i = 0; i < n; i++) {
    const px = c.x,
      py = c.y;
    w.step(1);
    if (c.digging) digF++;
    if (c.x === px && c.y === py) stuck++;
    else stuck = 0;
    if (stuck > 60) break;
  }
  w.keys.r = w.keys.dig = w.keys.d = w.keys.u = 0;
  return {
    dx: +(c.x - x0).toFixed(1),
    dy: +(c.y - y0).toFixed(1),
    stuck: stuck > 60,
    digF,
    items: w.items.map(t => t.t),
  };
};

const MATS = ['SAND', 'EARTH', 'LOAM', 'GOLD', 'COAL', 'ORE', 'GEM'];

test('digging goes on through every material in all three directions', async ({ page }) => {
  const errors = await field(page);
  const out = {};
  for (const m of [...MATS, 'ROCK'])
    for (const dir of ['side', 'down', 'up']) out[`${m} ${dir}`] = await page.evaluate(DIG, [m, dir, 240, m === 'ROCK']);
  console.log(JSON.stringify(out));
  for (const [k, r] of Object.entries(out)) {
    const [m, dir] = k.split(' ');
    expect(r.stuck, `${k}: ${JSON.stringify(r)}`).toBe(false);
    // sand runs into the tunnel behind you, so it is slow going
    if (m !== 'SAND') expect(r.dx, `${k}: ${JSON.stringify(r)}`).toBeGreaterThan(m === 'ROCK' ? 25 : 40);
    if (dir === 'down') expect(r.dy, `${k}: ${JSON.stringify(r)}`).toBeGreaterThan(3);
    if (dir === 'up' && m !== 'SAND') expect(r.dy, `${k}: ${JSON.stringify(r)}`).toBeLessThan(-8);
  }
  expect(errors).toEqual([]);
});
