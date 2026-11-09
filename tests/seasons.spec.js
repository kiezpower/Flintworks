// Seasons (seasons.js): in a green free-play world each day is a season; the fields grow at the
// season's pace, the rain comes as snow in winter, the oaks change their look, and the day count
// is saved: npm test
import { expect, test } from '@playwright/test';

test('a day is a season: fields grow fast in spring and hardly in winter, oaks change, snow falls', async ({ page }) => {
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
    const S = await import('/src/seasons.js');
    const out = { start: S.season() };
    // a field, and how far it gets in 600 ticks in each season
    const f = { id: 9901, type: 'field', x: G.base.x + 80, gy: G.base.gy, w: 24, h: 4, prog: 1, done: true, busy: 0, grow: 0 };
    w.builds.push(f);
    G.rainT = 0;
    const grown = n => {
      G.dayN = n;
      G.rainT = 0;
      f.grow = 0;
      for (let q = 0; q < 600; q++) w.step(1);
      return f.grow;
    };
    out.spring = grown(0);
    out.winter = grown(3);
    // the clock goes round: the next day, the next season, announced
    G.dayN = 0;
    G.dayT = 0.99999;
    w.step(3);
    out.next = S.season();
    out.news = document.body.textContent.includes('Sommer beginnt');
    // the look of an oak: blossoms, autumn, bare in winter
    const oak = w.trees.find(t => t.type === 'oak' && !t.fall) || { type: 'oak', stage: 2, spr: (await import('/src/sprites.js')).treeSprite('oak', 2) };
    G.dayN = 1;
    const summer = S.treeLook(oak);
    G.dayN = 2;
    const autumn = S.treeLook(oak);
    G.dayN = 3;
    out.cold = S.cold();
    out.look = summer === oak.spr && autumn !== oak.spr && S.treeLook(oak) !== autumn;
    // saved with the world
    const { serialize } = await import('/src/save.js');
    const d = serialize();
    out.saved = d && d.dayN;
    return out;
  });
  expect(r.start).toBe(0);
  expect(r.spring).toBeGreaterThan(r.winter * 5);
  expect(r).toMatchObject({ next: 1, news: true, cold: true, look: true, saved: 3 });
  expect(errors).toEqual([]);
});
