// The wandering trader (merchant.js): once a hut stands he comes over land to the castle, the
// action next to him opens his stall with three offers, buying pays and delivers, and after a
// while he walks off again: npm test
import { expect, test } from '@playwright/test';

test('the trader comes to the castle, sells from his stall and moves on', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow' }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G,
      { context } = await import('/src/digger.js'),
      me = w.crew.find(c => c.pid === G.myId);
    // no hut, no trader
    G.playTicks = 20 * 3600;
    for (let k = 0; k < 60; k++) w.step(1);
    const before = !!G.merchant;
    // a finished hut: he comes
    w.builds.push({ id: 9999, type: 'hut', x: G.base.x + 60, gy: G.base.gy, w: 22, h: 16, prog: 1, done: true, busy: 0 });
    G.merchNext = 0;
    let k = 0;
    while (!(G.merchant && G.merchant.at != null) && k++ < 6000) w.step(1);
    const arrived = G.merchant && G.merchant.at != null;
    // next to him: the action opens his stall
    Object.assign(me, { x: G.merchant.x - 3, y: w.world.surf[Math.round(G.merchant.x)] - 10, vx: 0, vy: 0 });
    w.step(2);
    const label = context(me).label;
    return { before, arrived, label, offers: G.merchant.offers.length };
  });
  expect(r).toEqual({ before: false, arrived: true, label: 'Händler', offers: 3 });
  // the stall: three offers; buying one pays
  await page.evaluate(async () => (await import('/src/ui.js')).openUi('merchant'));
  await expect(page.locator('#pTitle')).toHaveText('Wandernder Händler');
  await expect(page.locator('#panel .opt')).toHaveCount(3);
  const b = await page.evaluate(() => {
    const w = window.__ww;
    w.G.money = 500;
    return { m0: w.G.money, store0: { ...w.G.store }, tools0: { ...w.G.tools } };
  });
  await page.waitForTimeout(500);
  await page.locator('#panel .opt').first().click();
  const a = await page.evaluate(() => {
    const w = window.__ww;
    return { m: w.G.money, sold: w.G.merchant.sold.length };
  });
  // (paid – though a lucky bag may give back more than it cost, so only that it was sold)
  expect(a.m).not.toBe(b.m0);
  expect(a.sold).toBe(1);
  await expect(page.locator('#panel .opt').first()).toContainText('verkauft');
  // after his stay he walks off and is gone
  // (closed for sure: an open panel pauses the game, and he would wait for ever)
  await page.evaluate(async () => (await import('/src/ui.js')).closePanel());
  const gone = await page.evaluate(() => {
    const w = window.__ww;
    for (let k = 0; k < 150 * 60 + 4000 && w.G.merchant; k++) w.step(1);
    return !w.G.merchant;
  });
  expect(gone).toBe(true);
  expect(errors).toEqual([]);
});
