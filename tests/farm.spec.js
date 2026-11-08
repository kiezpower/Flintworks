// Farming (farm.js): grain grows on a field (faster in the rain), ripe it is harvested with the
// action button; the mill bakes bread from grain in the store; at the castle a Wühler takes a loaf
// and eats it when his strength runs low: npm test
import { expect, test } from '@playwright/test';

test('a field grows and is harvested, the mill bakes bread, a weak Wühler eats it', async ({ page }) => {
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
      { surf } = w.world,
      { context } = await import('/src/digger.js'),
      { arriveAtBase } = await import('/src/store.js'),
      me = w.crew.find(c => c.pid === G.myId);
    // (only the player: helpers would carry grain home and eat bread, whenever their paths allow)
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    const build = (type, x) => {
      Object.assign(me, { x, y: surf[x + 3] - 10, vx: 0, vy: 0, tumble: false });
      w.step(6);
      G.store = { ...G.store, wood: 9, rock: 9, plank: 9, loam: 9 };
      me.inv = ['loam', 'loam', 'wood', 'wood', 'wood', 'rock', 'rock', 'plank', 'plank'];
      const n = w.builds.length;
      w.send('build', { type });
      const b = w.builds[n];
      if (b) {
        b.prog = 1e9;
        w.step(3);
      }
      return b;
    };
    let x = G.base.x + 80;
    while (Math.abs(surf[x] - surf[x + 40]) > 1 && x < 900) x++;
    const field = build('field', x + 10),
      mill = build('mill', x + 60);
    const out = { field: !!(field && field.done), mill: !!(mill && mill.done) };
    // growing: rain doubles the pace
    G.rainT = 0;
    field.grow = 0;
    w.step(600);
    const dry = field.grow;
    G.rainT = 99999;
    field.grow = 0;
    w.step(600);
    out.rainFaster = field.grow > dry * 1.7;
    G.rainT = 0;
    // ripe: on the field the action harvests three grain, and it starts again
    field.grow = 1;
    Object.assign(me, { x: field.x + 8, y: field.gy - 10, vx: 0, vy: 0 });
    w.step(2);
    const cx = context(me);
    out.label = cx.label;
    const items0 = w.items.filter(i => i.t === 'grain').length + me.inv.filter(t => t === 'grain').length;
    cx.fn();
    w.step(2);
    out.grain = w.items.filter(i => i.t === 'grain').length + me.inv.filter(t => t === 'grain').length - items0;
    out.resown = field.grow < 0.01;
    // the mill: grain in the store becomes bread
    G.store.grain = 4;
    G.store.bread = 0;
    // (the mill looks for grain every half second and bakes for 2.5 s)
    for (let k = 0; k < 900; k++) w.step(1);
    out.bread = G.store.bread || 0;
    // at the castle a loaf for the way; weak, he eats it
    me.inv = [];
    G.store.bread = 1;
    arriveAtBase(me);
    out.took = me.inv.includes('bread');
    me.energy = 20;
    Object.assign(me, { x: field.x + 40, y: surf[field.x + 43] - 10 });
    w.step(40);
    out.ate = me.energy >= 65 && !me.inv.includes('bread');
    return out;
  });
  expect(r).toEqual({ field: true, mill: true, rainFaster: true, label: 'Ernten', grain: 3, resown: true, bread: 2, took: true, ate: true });
  expect(errors).toEqual([]);
});
