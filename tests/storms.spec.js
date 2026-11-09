// Storms (storms.js) and the blood moon (nights.js): npm test
import { expect, test } from '@playwright/test';

async function start(page, prof) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(p => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, ...p }));
  }, prof);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  return errors;
}

test('a sandstorm pushes the Wühler on the surface, not underground, and ends again', async ({ page }) => {
  const errors = await start(page, { mode: 'desert', diff: 'adventure' });
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const { surf } = await import('/src/world.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    // it starts (the next one now)
    G.stormNext = 1;
    w.step(2);
    const kind = G.storm && G.storm.kind;
    G.storm.dir = 1;
    const x = G.base.x + 300;
    Object.assign(me, { x, y: surf[x + 3] - 10, vx: 0, vy: 0 });
    for (let q = 0; q < 60; q++) w.step(1);
    const pushed = me.x - x;
    // deep down it is not felt
    const { felt } = await import('/src/storms.js');
    const below = felt({ x: G.base.x + 600, y: surf[G.base.x + 603] + 80 - 10 }) ? 99 : 0;
    G.storm.t = 2;
    w.step(3);
    return { kind, pushed: pushed > 4, below: below < 6, over: G.storm === null, news: document.body.textContent.includes('Sandsturm') };
  });
  expect(r).toMatchObject({ kind: 'sand', pushed: true, below: true, over: true, news: true });
  expect(errors).toEqual([]);
});

test('a blood moon: warned of, twice the monsters, a red moon on the clock, twice the gold', async ({ page }) => {
  const errors = await start(page, { mode: 'meadow', diff: 'adventure' });
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const { rnd } = await import('/src/world.js');
    G.nights = { n: 2, dark: false };
    G.dayT = 0.41;
    for (let k = 0; k < 40 && !G.nights.bloodNext; k++) {
      G.nights.warned = false;
      w.step(31);
    }
    const warned = G.nights.bloodNext;
    const before = w.animals.filter(a => a.night).length;
    G.dayT = 0.52;
    w.step(31);
    const monsters = w.animals.filter(a => a.night).length - before;
    const blood = w.animals.filter(a => a.blood).length;
    return { warned, moon: G.bloodMoon, monsters, blood, news: document.body.textContent.includes('Blutmond') };
  });
  expect(r.warned).toBe(true);
  expect(r.moon).toBe(true);
  expect(r.monsters).toBeGreaterThanOrEqual(3);
  expect(r.blood).toBe(r.monsters);
  expect(r.news).toBe(true);
  await page.waitForTimeout(700);
  // the moon on the clock is red
  const red = await page.evaluate(() => {
    const d = document.getElementById('clockCv').getContext('2d').getImageData(0, 0, 22, 12).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 100 && d[i + 2] < 100) return true;
    return false;
  });
  expect(red).toBe(true);
  expect(errors).toEqual([]);
});
