// A Fluffel companion (pets.js): fed with bread it follows its Wühler, catches up when left far
// behind, sniffs out gold close by and counts for the "Tierfreund" achievement: npm test
import { expect, test } from '@playwright/test';

test('a Fluffel fed with bread follows its Wühler and sniffs out gold', async ({ page }) => {
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
    const { petContext } = await import('/src/pets.js');
    const { mkAnimal } = await import('/src/entities.js');
    const { P } = await import('/src/profile.js');
    const { mat, W, GOLD, surf } = await import('/src/world.js');
    const me = w.crew.find(c => c.pid === G.myId);
    // (only the player)
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    for (const a of [...w.animals]) if (a.kind === 'fluffel') w.animals.splice(w.animals.indexOf(a), 1);
    const x = G.base.x + 260;
    Object.assign(me, { x, y: surf[x + 3] - 10, vx: 0, vy: 0 });
    const f = mkAnimal('fluffel', x + 6, 0);
    f.y = surf[x + 8] - f.h - 1;
    w.animals.push(f);
    for (let q = 0; q < 10; q++) w.step(1);
    // without food: nothing to do with it
    me.inv = [];
    const before = petContext(me);
    me.inv = ['bread'];
    me.isel = 0;
    f.x = me.x + 6;
    f.y = me.y + 10 - f.h;
    const cx = petContext(me);
    cx.fn();
    const tamed = f.pet === me.pid && !me.inv.includes('bread');
    // it follows: the Wühler is put 120 px away, it walks after him
    Object.assign(me, { x: x + 120, y: surf[x + 123] - 10, vx: 0, vy: 0 });
    for (let q = 0; q < 400; q++) w.step(1);
    const near = Math.abs(f.x - me.x) < 30;
    // left far behind (500 px): it turns up next to him
    const fx = x + 620;
    Object.assign(me, { x: fx, y: surf[fx + 3] - 10, vx: 0, vy: 0 });
    for (let q = 0; q < 10; q++) w.step(1);
    const caught = Math.abs(f.x - me.x) < 30;
    // gold in the ground right below it: it smells it
    const gx = Math.round(f.x + 10),
      gy = surf[gx] + 12;
    for (let yy = gy; yy < gy + 3; yy++) for (let xx = gx; xx < gx + 3; xx++) mat[yy * W + xx] = GOLD;
    for (let q = 0; q < 50; q++) w.step(1);
    return {
      before: !!before,
      label: cx.label,
      tamed,
      near,
      caught,
      sniff: !!f.sn && Math.abs(f.sn[0] - gx) < 4 && Math.abs(f.sn[1] - gy) < 4,
      ach: !!P.ach.pet,
      second: !!petContext(Object.assign(me, { inv: ['fish'] })),
    };
  });
  expect(r).toEqual({ before: false, label: 'Füttern', tamed: true, near: true, caught: true, sniff: true, ach: true, second: false });
  expect(errors).toEqual([]);
});
