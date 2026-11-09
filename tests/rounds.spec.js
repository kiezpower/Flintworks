// The round funnel after the tutorial (analytics.js, docs/ANALYTICS.md): how a round ends, when
// it is left for the lobby, and where the own Wühler gives out – nothing personal: npm test
import { expect, test } from '@playwright/test';

const events = page =>
  page.evaluate(() => window.__ww.analytics.sessionEvents().map(({ sid, v, plat, lang, t, input, seq, ...f }) => f));

async function round(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3 }));
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  return errors;
}

test('a round that ends and a Wühler that gives out are counted, with mode, time and depth', async ({ page }) => {
  const errors = await round(page);
  await page.evaluate(async () => {
    const w = window.__ww,
      { killDigger } = await import('/src/digger.js'),
      { endScreen } = await import('/src/main.js'),
      { surf } = w.world;
    w.step(600);
    const c = w.sel_ ? w.sel_() : w.crew.find(o => o.pid === w.G.myId) || w.crew[0];
    c.y = surf[Math.floor(c.x)] + 40;
    killDigger(c);
    endScreen(true);
  });
  const all = await events(page);
  const down = all.find(e => e.e === 'digger_down');
  expect(down).toMatchObject({ mode: 'gold', night: false });
  expect(down.depth).toBeGreaterThanOrEqual(39);
  expect(down.sec).toBeGreaterThanOrEqual(9);
  const end = all.find(e => e.e === 'round_end');
  expect(end).toMatchObject({ mode: 'gold', won: true, net: false });
  expect(end.games).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('leaving a running round for the lobby is counted once', async ({ page }) => {
  const errors = await round(page);
  await page.evaluate(async () => {
    const { menu } = await import('/src/main.js');
    window.__ww.step(300);
    menu();
  });
  const quits = (await events(page)).filter(e => e.e === 'round_quit');
  expect(quits).toHaveLength(1);
  expect(quits[0]).toMatchObject({ mode: 'gold' });
  expect(errors).toEqual([]);
});
