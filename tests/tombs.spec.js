// A gravestone where a Wühler gave out (tombs.js), and fish by the place (fishing.js): npm test
import { expect, test } from '@playwright/test';

test('a gravestone marks the lost bag until it is picked up again', async ({ page }) => {
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
    const { hurt } = await import('/src/digger.js');
    const { surf } = await import('/src/world.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    const x = G.base.x + 400;
    Object.assign(me, { x, y: surf[x + 3] - 10, vx: 0, vy: 0 });
    me.inv = ['nug', 'nug', 'gem'];
    w.step(2);
    hurt(me, 500);
    const out = { tomb: (G.tombs || []).length === 1 && G.tombs[0].pid === me.pid };
    // back on his feet in the castle; the stone stays while the things lie there
    for (let q = 0; q < 400; q++) w.step(1);
    out.stays = G.tombs.length === 1 && !me.dead;
    // he walks back and picks them up: the stone is gone
    Object.assign(me, { x: G.tombs[0].x - 3, y: surf[G.tombs[0].x] - 10, vx: 0, vy: 0 });
    for (let q = 0; q < 120 && w.items.some(i => Math.abs(i.x - me.x) < 40); q++) {
      const it = w.items.find(i => Math.abs(i.x - me.x) < 40);
      Object.assign(me, { x: it.x - 2, y: it.y - 6 });
      w.step(2);
    }
    for (let q = 0; q < 40; q++) w.step(1);
    out.gone = G.tombs.length === 0;
    out.bag = me.inv.filter(t => t === 'nug').length >= 2 && me.inv.includes('gem');
    return out;
  });
  expect(r).toMatchObject({ tomb: true, stays: true, gone: true, bag: true });
  expect(errors).toEqual([]);
});

test('fish by the place: cave fish only from deep water, a goldfish now and then', async ({ page }) => {
  await page.goto('/?seed=7');
  await page.waitForFunction(() => window.__ww);
  const r = await page.evaluate(async () => {
    const { catchAt } = await import('/src/fishing.js');
    const { surf } = await import('/src/world.js');
    const count = y0 => {
      const n = {};
      for (let k = 0; k < 2000; k++) {
        const t = catchAt(500, surf[500] + y0);
        n[t] = (n[t] || 0) + 1;
      }
      return n;
    };
    return { top: count(2), deep: count(120) };
  });
  expect(r.top.cavefish || 0).toBe(0);
  expect(r.deep.cavefish).toBeGreaterThan(600);
  expect(r.top.goldfish + r.deep.goldfish).toBeGreaterThan(50);
  expect(r.top.fish).toBeGreaterThan(r.deep.fish);
});
