// Oil and fire (fire.js): oil floats on water; a blast sets an oil pool alight, the fire spreads
// through it, hurts a monster in it and burns the oil away; lava lights oil too; a free world has
// oil pockets: npm test
import { expect, test } from '@playwright/test';

async function field(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() =>
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow' }),
    ),
  );
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  // a stone basin 40 wide and 12 deep, well right of the castle (its inside empty)
  await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, paint, activate, surf, ROCK, AIR } = w.world,
      x0 = w.G.base.x + 160,
      g = surf[x0];
    const set = (x, y, m) => {
      mat[y * W + x] = m;
      paint(y * W + x);
    };
    for (let y = g - 4; y < g + 14; y++) for (let x = x0 - 2; x < x0 + 42; x++) set(x, y, ROCK);
    for (let y = g - 4; y < g + 12; y++) for (let x = x0; x < x0 + 40; x++) set(x, y, AIR);
    for (let y = g - 4; y < g + 14; y += 4) for (let x = x0; x < x0 + 40; x += 4) activate(x, y);
    for (const c of w.crew) c.x = 40;
    window.__basin = { x0, g };
  });
  return errors;
}

test('oil floats on water', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, paint, activate, OIL, WATER } = w.world,
      { x0, g } = window.__basin;
    // oil at the bottom, water poured on top
    for (let y = g + 8; y < g + 12; y++) for (let x = x0; x < x0 + 40; x++) (mat[y * W + x] = OIL), paint(y * W + x);
    for (let y = g + 2; y < g + 6; y++) for (let x = x0; x < x0 + 40; x++) (mat[y * W + x] = WATER), paint(y * W + x);
    for (let y = g; y < g + 12; y += 2) for (let x = x0; x < x0 + 40; x += 4) activate(x, y);
    for (let k = 0; k < 600; k++) w.step(1);
    // the bottom row is water, the top of the liquid is oil
    const row = y => [...Array(40).keys()].map(k => mat[y * W + x0 + k]);
    const bottom = row(g + 11),
      top = [g + 4, g + 5, g + 6, g + 7, g + 8].map(row).find(r => r.some(m => m === OIL || m === WATER)) || [];
    return {
      bottomWater: bottom.filter(m => m === WATER).length,
      topOil: top.filter(m => m === OIL).length,
    };
  });
  expect(r.bottomWater).toBeGreaterThan(30);
  expect(r.topOil).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('a blast sets an oil pool alight: the fire spreads, hurts a monster in it and burns the oil away', async ({
  page,
}) => {
  const errors = await field(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      { mat, W, paint, activate, OIL } = w.world,
      { x0, g } = window.__basin,
      { explode } = await import('/src/objects.js'),
      { isBurning } = await import('/src/fire.js');
    for (let y = g + 6; y < g + 12; y++) for (let x = x0; x < x0 + 40; x++) (mat[y * W + x] = OIL), paint(y * W + x);
    for (let y = g; y < g + 12; y += 2) for (let x = x0; x < x0 + 40; x += 4) activate(x, y);
    const count = () => {
      let n = 0;
      for (let y = g; y < g + 12; y++) for (let x = x0; x < x0 + 40; x++) if (mat[y * W + x] === OIL) n++;
      return n;
    };
    for (let k = 0; k < 60; k++) w.step(1);
    const before = count();
    const m = w.mkAnimal('monster', x0 + 30, g + 1);
    w.animals.push(m);
    // a small blast at the left end
    explode(x0 + 2, g + 5, 3);
    w.step(30);
    let spread = 0;
    for (let x = x0; x < x0 + 40; x++) for (let y = g; y < g + 12; y++) if (isBurning(y * W + x)) spread = Math.max(spread, x - x0);
    for (let k = 0; k < 900; k++) w.step(1);
    return { before, after: count(), spread, monster: !w.animals.includes(m) || m.hp < m.maxHp };
  });
  expect(r.before).toBeGreaterThan(150);
  expect(r.after).toBeLessThan(r.before / 3);
  expect(r.spread).toBeGreaterThan(5);
  expect(r.monster).toBe(true);
  expect(errors).toEqual([]);
});

test('lava lights oil; a free world has oil pockets', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      { mat, W, H, paint, activate, OIL, LAVA } = w.world,
      { x0, g } = window.__basin,
      { isBurning } = await import('/src/fire.js');
    let oil = 0;
    for (let i = 0; i < W * H; i++) if (mat[i] === OIL) oil++;
    for (let x = x0; x < x0 + 20; x++) (mat[(g + 11) * W + x] = OIL), paint((g + 11) * W + x);
    mat[(g + 11) * W + x0 + 20] = LAVA;
    paint((g + 11) * W + x0 + 20);
    activate(x0 + 20, g + 11);
    let lit = false;
    for (let k = 0; k < 120 && !lit; k++) {
      w.step(1);
      for (let x = x0; x < x0 + 20; x++) if (isBurning((g + 11) * W + x)) lit = true;
    }
    return { oil, lit };
  });
  expect(r.oil).toBeGreaterThan(50);
  expect(r.lit).toBe(true);
  expect(errors).toEqual([]);
});
