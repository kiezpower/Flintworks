// Tips for the newer things when you first come across them (lessons.js): npm test
import { expect, test } from '@playwright/test';

test('a potion in the bag and a dig into the rich depths bring their tips once', async ({ page }) => {
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
    const { LESSONS, checkLessons } = await import('/src/lessons.js');
    const { P } = await import('/src/profile.js');
    const { surf } = await import('/src/world.js');
    const me = w.crew.find(c => c.pid === G.myId);
    // every other tip already known
    P.tips = LESSONS.map(l => l.id).filter(id => id !== 'potion' && id !== 'richdeep');
    G.toastT = 0;
    G.tipT = -1e9;
    me.inv = ['potGlow'];
    checkLessons();
    const potion = document.getElementById('toast').textContent;
    // the rich depths, a while later
    G.toastT = 0;
    G.tipT = -1e9;
    me.inv = [];
    const x = Math.round(me.x);
    Object.assign(me, { y: surf[x + 3] + 100, vx: 0, vy: 0 });
    checkLessons();
    const deep = document.getElementById('toast').textContent;
    return { potion, deep, seen: P.tips.includes('potion') && P.tips.includes('richdeep'), names: LESSONS.length };
  });
  expect(r.potion).toContain('Trank');
  expect(r.deep).toContain('ergiebiger');
  expect(r.seen).toBe(true);
  expect(errors).toEqual([]);
});
