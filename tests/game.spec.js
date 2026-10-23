import { expect, test } from '@playwright/test';
import { clickInPanel, placeOnFlatGround, startGame, steps } from './helpers.js';

test('starts without errors and shows the HUD', async ({ page }) => {
  const errors = await startGame(page);
  await steps(page, 120);
  await expect(page.locator('#moneyTxt')).toContainText('Taler');
  expect(errors).toEqual([]);
});

test('survives random play with explosions, rain and lightning', async ({ page }) => {
  const errors = await startGame(page);
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift', 'Space', 'e', 'q', 'Tab'];
  await page.evaluate(() => window.__ww.rain());
  for (let i = 0; i < 150; i++) {
    const k = keys[(i * 7) % keys.length];
    await page.keyboard.down(k);
    await steps(page, 15);
    await page.keyboard.up(k);
    if (i % 40 === 0)
      await page.evaluate(() => {
        const w = window.__ww,
          c = w.crew.find(c => !c.dead);
        if (c) w.explode(c.x + 40, c.y + 10, 19);
        w.bolt();
        w.meteor();
      });
  }
  expect(errors).toEqual([]);
});

test('production chain: sawmill, windmill, furnace make metal', async ({ page }) => {
  const errors = await startGame(page);
  await page.evaluate(() => {
    window.__ww.base.lvl = 3;
    window.__ww.calcTerr();
  });
  const build = async (type, inv, x) => {
    await page.evaluate(inv => (window.__ww.crew[0].inv = inv), inv);
    expect(await placeOnFlatGround(page, x)).toBeGreaterThan(0);
    await steps(page, 60);
    await page.evaluate(t => window.__ww.tryBuild(t), type);
    await steps(page, 330);
    return page.evaluate(t => window.__ww.builds.some(b => b.type === t && b.done), type);
  };
  expect(await build('saw', ['wood', 'wood', 'wood', 'rock'], 150)).toBe(true);
  expect(await build('wind', ['plank', 'plank', 'wood', 'rock'], 150)).toBe(true);
  expect(await build('furnace', ['rock', 'rock', 'rock', 'plank', 'plank'], 150)).toBe(true);
  expect(await page.evaluate(() => window.__ww.power().sup)).toBeGreaterThan(1);
  await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      b = w.builds.find(b => b.type === 'furnace');
    c.x = b.x + 6;
    c.y = b.gy - 12;
    c.inv = ['ore', 'coal'];
  });
  await steps(page, 30);
  await page.keyboard.press('f');
  await clickInPanel(page, '#pBody .opt');
  await steps(page, 400);
  const metal = await page.evaluate(
    () =>
      window.__ww.items.filter(i => i.t === 'metal').length +
      window.__ww.crew[0].inv.filter(t => t === 'metal').length,
  );
  expect(metal).toBe(1);
  expect(errors).toEqual([]);
});

test('save and load keep the world', async ({ page }) => {
  await startGame(page);
  await steps(page, 60);
  const before = await page.evaluate(() => {
    window.__ww.money = 123;
    window.__ww.save();
    return window.__ww.crew.length;
  });
  await page.reload();
  await page.click('#contBtn');
  await steps(page, 10);
  expect(await page.evaluate(() => window.__ww.money)).toBe(123);
  expect(await page.evaluate(() => window.__ww.crew.length)).toBe(before);
});

test('digging goes straight or diagonal, never vertical', async ({ page }) => {
  await startGame(page);
  const dig = async keys => {
    await page.evaluate(() => {
      const w = window.__ww,
        c = w.crew[0];
      let y = 0;
      while (!w.solidAt(303, y)) y++;
      w.explode(303, y + 30, 8);
      c.x = 300;
      c.y = y + 28;
      c.vx = c.vy = 0;
      c.face = 1;
    });
    await steps(page, 150);
    const [x0, y0] = await page.evaluate(() => [window.__ww.crew[0].x, window.__ww.crew[0].y]);
    await page.keyboard.down('Shift');
    for (const k of keys) await page.keyboard.down(k);
    await steps(page, 90);
    for (const k of keys) await page.keyboard.up(k);
    await page.keyboard.up('Shift');
    const [x1, y1] = await page.evaluate(() => [window.__ww.crew[0].x, window.__ww.crew[0].y]);
    return [x1 - x0, y1 - y0];
  };
  const [sx, sy] = await dig([]);
  expect(sx).toBeGreaterThan(20);
  expect(Math.abs(sy)).toBeLessThan(10);
  const [dx, dy] = await dig(['ArrowDown']);
  expect(dx).toBeGreaterThan(5);
  expect(dy).toBeGreaterThan(5);
});

test('english version translates the interface', async ({ browser }) => {
  const page = await browser.newPage({ locale: 'en-US' });
  await page.goto('/?seed=7');
  await expect(page.locator('#langBtn')).toHaveText('Deutsch');
  await page.click('#goBtn');
  await expect(page.locator('#moneyTxt')).toContainText('coins');
  await expect(page.locator('#buildBtn')).toHaveText('Build');
});
