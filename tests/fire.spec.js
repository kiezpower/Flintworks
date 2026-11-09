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
    for (let x = x0; x < x0 + 20; x++) (mat[(g + 11) * W + x] = OIL), paint((g + 11) * W + x);
    mat[(g + 11) * W + x0 + 20] = LAVA;
    paint((g + 11) * W + x0 + 20);
    activate(x0 + 20, g + 11);
    let lit = false;
    for (let k = 0; k < 120 && !lit; k++) {
      w.step(1);
      for (let x = x0; x < x0 + 20; x++) if (isBurning((g + 11) * W + x)) lit = true;
    }
    // free worlds have oil pockets: three worlds of fixed seeds (the world of this round comes
    // from wherever the random numbers stood when "play" was pressed, and may have few)
    const oil = [];
    for (const seed of [1, 2, 3]) {
      Object.assign(w.G, { nextMode: 'gold', nextSeed: seed, nextBiome: 'meadow', nextDiff: 'adventure' });
      w.gen();
      w.G.nextSeed = null;
      let n = 0;
      for (let i = 0; i < w.world.W * w.world.H; i++) if (w.world.mat[i] === OIL) n++;
      oil.push(n);
    }
    return { oil: Math.min(...oil), lit };
  });
  expect(r.oil).toBeGreaterThan(50);
  expect(r.lit).toBe(true);
  expect(errors).toEqual([]);
});

test('fire chars a wooden bridge next to it, water puts burning oil out', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      { mat, W, paint, activate, OIL, PLANK, WATER, AIR } = w.world,
      { x0, g } = window.__basin,
      { igniteCell, isBurning } = await import('/src/fire.js');
    const set = (x, y, m) => {
      mat[y * W + x] = m;
      paint(y * W + x);
    };
    // left half: an oil pool with a plank bridge resting on it
    for (let x = x0; x < x0 + 18; x++) {
      for (let y = g + 9; y < g + 12; y++) set(x, y, OIL);
      set(x, g + 8, PLANK);
    }
    for (let x = x0; x < x0 + 18; x += 3) activate(x, g + 9);
    for (let x = x0; x < x0 + 18; x++) igniteCell((g + 9) * W + x);
    for (let k = 0; k < 400; k++) w.step(1);
    let planks = 0;
    for (let x = x0; x < x0 + 18; x++) if (mat[(g + 8) * W + x] === PLANK) planks++;
    // right half: a burning oil film, then water poured onto it
    const x1 = x0 + 24;
    for (let x = x1; x < x1 + 14; x++) set(x, g + 11, OIL);
    for (let x = x1; x < x1 + 14; x++) igniteCell((g + 11) * W + x);
    for (let x = x1; x < x1 + 14; x++) set(x, g + 10, WATER);
    for (let x = x1; x < x1 + 14; x += 3) activate(x, g + 10);
    w.step(2);
    let still = 0;
    for (let x = x1; x < x1 + 14; x++) for (let y = g + 8; y < g + 12; y++) if (isBurning(y * W + x)) still++;
    let oilLeft = 0;
    for (let x = x1; x < x1 + 14; x++) for (let y = g + 6; y < g + 12; y++) if (mat[y * W + x] === OIL) oilLeft++;
    return { planks, still, oilLeft, air: AIR };
  });
  // the bridge over the fire has (mostly) burnt away
  expect(r.planks).toBeLessThan(9);
  // the doused oil no longer burns and is not used up
  expect(r.still).toBeLessThan(4);
  expect(r.oilLeft).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});

test('acid gnaws through wood and, slowly, through rock; lava chars wood', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, paint, activate, ACID, PLANK, ROCK, LAVA, AIR } = w.world,
      { x0, g } = window.__basin;
    const set = (x, y, m) => {
      mat[y * W + x] = m;
      paint(y * W + x);
    };
    // acid on a plank floor (left) and on a rock floor (right), lava on planks (far right)
    for (let x = x0; x < x0 + 12; x++) {
      set(x, g + 11, PLANK);
      set(x, g + 10, ACID);
    }
    for (let x = x0 + 14; x < x0 + 26; x++) set(x, g + 10, ACID);
    for (let x = x0 + 28; x < x0 + 40; x++) {
      set(x, g + 11, PLANK);
      set(x, g + 10, LAVA);
    }
    for (let x = x0; x < x0 + 40; x += 2) activate(x, g + 10);
    const n = (xa, xb, y, m) => {
      let k = 0;
      for (let x = xa; x < xb; x++) if (mat[y * W + x] === m) k++;
      return k;
    };
    const rock0 = n(x0 - 2, x0 + 42, g + 12, ROCK) + n(x0 - 2, x0 + 42, g + 13, ROCK);
    for (let k = 0; k < 1500; k++) w.step(1);
    return {
      wood: n(x0, x0 + 12, g + 11, PLANK),
      lavaWood: n(x0 + 28, x0 + 40, g + 11, PLANK),
      rockEaten: rock0 - n(x0 - 2, x0 + 42, g + 12, ROCK) - n(x0 - 2, x0 + 42, g + 13, ROCK),
      air: AIR,
    };
  });
  expect(r.wood).toBeLessThan(10);
  expect(r.lavaWood).toBeLessThan(10);
  expect(r.rockEaten).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
