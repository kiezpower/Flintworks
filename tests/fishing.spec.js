// Fishing (fishing.js): with the rod, at water the action button casts; when something bites the
// button pulls it in (mostly a fish, sold at the castle); too late, it gets away; walking off ends
// it: npm test
import { expect, test } from '@playwright/test';

test('fishing: cast, a bite, pull in a catch; too late it gets away; a fish sells at the castle', async ({ page }) => {
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
      { mat, W, paint, activate, surf, ROCK, AIR, WATER } = w.world,
      { context } = await import('/src/digger.js'),
      me = w.crew.find(c => c.pid === w.G.myId);
    for (const c of w.crew) if (c !== me) c.x = 40;
    // a stone pond right of the castle, the player at its left bank facing it
    const x0 = w.G.base.x + 140,
      g = surf[x0];
    for (let y = g - 2; y < g + 12; y++)
      for (let x = x0 - 4; x < x0 + 34; x++) {
        const inside = x >= x0 && x < x0 + 30 && y < g + 10;
        mat[y * W + x] = !inside ? ROCK : y < g + 2 ? AIR : WATER;
        paint(y * W + x);
      }
    for (let y = g; y < g + 10; y += 3) for (let x = x0; x < x0 + 30; x += 4) activate(x, y);
    Object.assign(me, { x: x0 - 9, y: g - 12, vx: 0, vy: 0, face: 1 });
    w.step(20);
    const out = { noRod: context(me).label };
    w.G.tools = { ...w.G.tools, rod: true };
    out.offer = context(me).label;
    // cast, wait for the bite, pull in: five times
    let caught = 0,
      coins0 = w.G.money,
      // (a catch lands on the bank or right in the bag)
      items0 = w.items.length + me.inv.length + Object.values(w.G.store || {}).reduce((a, b) => a + b, 0);
    for (let n = 0; n < 5; n++) {
      context(me).fn();
      let k = 0;
      while (!(me.fish && me.fish.bite > 0) && k++ < 1500) {
        me.vx = 0;
        w.step(1);
      }
      out.bite = context(me).label;
      context(me).fn();
      w.step(2);
      caught++;
    }
    for (let q = 0; q < 60; q++) w.step(1);
    out.got =
      w.items.length + me.inv.length + Object.values(w.G.store || {}).reduce((a, b) => a + b, 0) - items0 + (w.G.money > coins0 ? 1 : 0);
    // too late: it gets away and the wait starts again
    context(me).fn();
    let k = 0;
    while (!(me.fish && me.fish.bite > 0) && k++ < 1500) w.step(1);
    for (let q = 0; q < 70; q++) w.step(1);
    out.stillFishing = !!me.fish && !(me.fish.bite > 0);
    // walking off ends it
    me.vx = 1;
    w.step(1);
    out.ended = !me.fish;
    // a fish sold at the castle
    const { unload } = await import('/src/store.js'),
      m0 = w.G.money;
    unload(['fish'], 0, 0);
    out.sold = w.G.money - m0;
    return out;
  });
  expect(r.noRod).not.toBe('Angeln');
  expect(r.offer).toBe('Angeln');
  expect(r.bite).toBe('Einholen!');
  expect(r.got).toBeGreaterThanOrEqual(4);
  expect(r.stillFishing).toBe(true);
  expect(r.ended).toBe(true);
  expect(r.sold).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
