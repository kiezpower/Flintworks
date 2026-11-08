// Settlers (villagers.js): finished huts draw settlers who move in, they pay rent, eat bread from the
// store every morning, and without bread move out after a second hungry morning: npm test
import { expect, test } from '@playwright/test';

test('settlers move into huts, pay rent, eat bread in the morning and leave when it runs out', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', diff: 'relaxed' }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const r = await page.evaluate(() => {
    const w = window.__ww,
      G = w.G;
    // (only the player: helpers would bring things to the store)
    for (const c of [...w.crew]) if (c.pid !== G.myId) w.crew.splice(w.crew.indexOf(c), 1);
    // (and away from the castle, where he would take a loaf for himself)
    const me = w.crew[0],
      fx = G.base.x + 300;
    Object.assign(me, { x: fx, y: w.world.surf[fx + 3] - 10, vx: 0, vy: 0 });
    // two finished huts, a bright day
    for (const k of [0, 1])
      w.builds.push({ id: 9900 + k, type: 'hut', x: G.base.x + 60 + k * 40, gy: G.base.gy, w: 22, h: 16, prog: 1, done: true, busy: 0 });
    G.dayT = 0.2;
    let k = 0;
    while (G.villagers.length < 2 && k++ < 9000) w.step(1);
    const moved = G.villagers.length;
    for (const v of G.villagers) v.first = true;
    // rent: a half minute brings 2 coins per settler
    const m0 = G.money;
    for (let q = 0; q < 1800; q++) w.step(1);
    const rent = G.money - m0;
    // the first morning with bread: both eat
    G.store.bread = 3;
    const morning = () => {
      G.dayT = 0.99;
      for (let q = 0; q < 900; q++) w.step(1);
    };
    morning();
    const ate = 3 - (G.store.bread || 0);
    // two mornings without bread: they move out
    G.store.bread = 0;
    morning();
    const after1 = G.villagers.length;
    morning();
    // (the two who were hungry are gone; a newcomer may already have taken a free hut)
    return { moved, rent, ate, after1, after2: G.villagers.filter(v => v.first).length };
  });
  expect(r.moved).toBe(2);
  expect(r.rent).toBeGreaterThanOrEqual(4);
  expect(r.ate).toBe(2);
  expect(r.after1).toBe(2);
  expect(r.after2).toBe(0);
  expect(errors).toEqual([]);
});
