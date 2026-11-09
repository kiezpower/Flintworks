// Shrines deep down (shrines.js): free worlds have halls far below with a gift each; the action
// button takes it, the shrine goes dark, and the gift works (no fall damage, less damage, healing,
// faster digging): npm test
import { expect, test } from '@playwright/test';

test('shrines lie deep down, give their gift once, and the gifts work', async ({ page }) => {
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
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const { mat, W, GRANITE, EARTH, ROCK, surf } = await import('/src/world.js');
    const { hurt } = await import('/src/digger.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    const S = G.shrines;
    const out = {
      n: S.length,
      gifts: new Set(S.map(s => s.gift)).size,
      deep: S.every(s => s.y > surf[s.x] + 100),
      // (the hall: a granite floor, open above it – water or sand may have trickled in meanwhile)
      hall: S.every(s => mat[s.y * W + s.x] === GRANITE && ![EARTH, ROCK, GRANITE].includes(mat[(s.y - 5) * W + s.x])),
    };
    // at the first shrine: its gift
    const s = S[0];
    Object.assign(me, { x: s.x - 3, y: s.y - 10, vx: 0, vy: 0 });
    w.step(10);
    const cx = w.context(me);
    out.label = cx.label;
    cx.fn();
    out.took = me.gifts.includes(s.gift) && s.used;
    out.after = w.context(me).label !== 'Gabe nehmen';
    // the gifts at work
    me.gifts = ['tough'];
    me.energy = 100;
    hurt(me, 30);
    out.tough = Math.round(100 - me.energy);
    me.gifts = ['regen'];
    me.energy = 50;
    w.step(300);
    out.regen = me.energy > 54;
    // a fall from high up: no damage with "Federleicht"
    me.gifts = ['feather'];
    me.energy = 100;
    Object.assign(me, { x: s.x - 3, y: s.y - 14, vx: 0, vy: 6 });
    w.step(20);
    out.feather = me.energy >= 99;
    return out;
  });
  expect(r).toEqual({ n: 3, gifts: 3, deep: true, hall: true, label: 'Gabe nehmen', took: true, after: true, tough: 20, regen: true, feather: true });
  expect(errors).toEqual([]);
});
