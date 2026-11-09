// Back down to the last digging spot from the castle (descend.js): npm test
import { expect, test } from '@playwright/test';

test('the castle remembers the last spot deep down and takes you back for 5 coins', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', diff: 'relaxed' }),
    );
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const spot = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const { mat, W, AIR, ROCK, surf } = await import('/src/world.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    // a small room 25 m down, the player standing in it
    const x = G.base.x + 320,
      y = surf[x] + 100;
    for (let yy = y - 14; yy < y; yy++) for (let xx = x - 10; xx < x + 16; xx++) mat[yy * W + xx] = AIR;
    for (let xx = x - 10; xx < x + 16; xx++) mat[y * W + xx] = ROCK;
    Object.assign(me, { x, y: y - 10, vx: 0, vy: 0 });
    w.step(40);
    const at = me.lastDeep && [...me.lastDeep];
    // back home
    Object.assign(me, { x: G.base.x + 10, y: G.base.gy - 10, vx: 0, vy: 0 });
    G.money = 40;
    w.step(5);
    return at;
  });
  expect(spot).not.toBeNull();
  // the castle panel offers the trip
  await page.keyboard.press('KeyF');
  await expect(page.locator('#panel')).toContainText('Zurück zur Grabestelle (↓ 25 m)');
  await page.waitForTimeout(500);
  await page.locator('#panel .opt', { hasText: 'Zurück zur Grabestelle' }).click();
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      me = w.crew.find(c => c.pid === w.G.myId);
    return { x: Math.round(me.x), money: w.G.money };
  });
  expect(r.x).toBe(spot[0]);
  expect(r.money).toBe(35);
  expect(errors).toEqual([]);
});
