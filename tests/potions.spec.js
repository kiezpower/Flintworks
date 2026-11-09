// Potions (potions.js): glowing mushrooms deep down are picked, stored in the castle, a brewing
// cauldron brews potions from them, a player takes one of each at the castle, and drinking them
// heals, lights and speeds up digging: npm test
import { expect, test } from '@playwright/test';

test('mushrooms are picked, brewed into potions, taken at the castle and drunk', async ({ page }) => {
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
    const { decor, glowList } = await import('/src/decor.js');
    const { arriveAtBase } = await import('/src/store.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    const out = {};
    // a mushroom on a cave floor: pick it
    const d = decor.find(d => d.kind === 'shroom');
    Object.assign(me, { x: d.x - 3, y: d.y - 10, vx: 0, vy: 0 });
    me.inv = [];
    const cx = w.context(me);
    out.label = cx.label;
    cx.fn();
    out.picked = me.inv.includes('shroom') && d.picked && G.picked.length === 1;
    out.saved = !glowList().some(g => g[0] === d.x && g[1] === d.y);
    // a cauldron next to the castle brews from the store
    w.builds.push({ id: 9960, type: 'brew', x: G.base.x - 24, gy: G.base.gy, w: 14, h: 12, prog: 1, done: true, busy: 0 });
    G.store.shroom = 6;
    for (let q = 0; q < 900; q++) w.step(1);
    out.brewed = ['potHeal', 'potGlow', 'potDig'].map(t => G.store[t] || 0);
    // at the castle the player takes one of each
    me.inv = [];
    arriveAtBase(me);
    out.bag = [...me.inv].sort();
    // drinking: the action button with a potion chosen (away from the castle)
    const { surf } = await import('/src/world.js');
    const fx = G.base.x + 300;
    Object.assign(me, { x: fx, y: surf[fx + 3] - 10, vx: 0, vy: 0 });
    const drink = t => {
      me.isel = me.inv.indexOf(t);
      const x = w.context(me);
      x.fn();
      return x.label;
    };
    me.energy = 30;
    out.drink = drink('potHeal');
    out.heal = me.energy === 100;
    drink('potGlow');
    drink('potDig');
    out.timers = me.glowT > 3000 && me.digT > 3000;
    out.empty = me.inv.length === 0;
    return out;
  });
  expect(r).toEqual({
    label: 'Pflücken',
    picked: true,
    saved: true,
    brewed: [1, 1, 1],
    bag: ['potDig', 'potGlow', 'potHeal'],
    drink: 'Trinken',
    heal: true,
    timers: true,
    empty: true,
  });
  expect(errors).toEqual([]);
});
