// Gold fever in the middle of a free round (rush.js): after three minutes, for one minute, the
// castle pays double for gold nuggets; not in the Tagesschicht: npm test
import { expect, test } from '@playwright/test';

async function start(page, profile = {}, url = '/') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(p => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, ...p }));
  }, profile);
  await page.goto(url);
  await page.waitForFunction(() => window.__ww);
  return errors;
}

test('gold fever comes after three minutes and pays double for gold for one minute', async ({ page }) => {
  const errors = await start(page);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      { unload } = await import('/src/store.js');
    const sell = () => {
      const m0 = w.G.money;
      unload(['nug'], 100, 100);
      return w.G.money - m0;
    };
    const plain = sell();
    // the first one is planned for three minutes in (counted down every tick, not simulated
    // here minute by minute: only the last ticks are)
    w.step(1);
    const planned = w.G.rushNext;
    w.G.rushNext = 10;
    w.step(5);
    const early = w.G.rushT || 0;
    w.step(10);
    const on = w.G.rushT > 0;
    const rush = sell();
    // other goods keep their price
    const m0 = w.G.money;
    unload(['gem'], 100, 100);
    const gem = w.G.money - m0;
    // one minute later it is over (the last ticks simulated)
    const long = w.G.rushT;
    w.G.rushT = 5;
    w.step(10);
    return { plain, planned, long, early, on, rush, gem, after: sell(), off: !(w.G.rushT > 0) };
  });
  expect(r.planned).toBeGreaterThan(3 * 3600 - 300);
  expect(r.long).toBeGreaterThan(3600 - 20);
  expect(r.early).toBe(0);
  expect(r.on).toBe(true);
  expect(r.rush).toBe(r.plain * 2);
  expect(r.gem).toBeGreaterThan(0);
  expect(r.after).toBe(r.plain);
  expect(r.off).toBe(true);
  await expect(page.locator('body')).toContainText('Das Goldfieber ist vorbei');
  expect(errors).toEqual([]);
});

test('the Tagesschicht has no gold fever (its scores stay comparable)', async ({ page }) => {
  const errors = await start(page);
  await page.click('#lbDaily');
  await page.click('#dlGo');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const r = await page.evaluate(() => {
    const w = window.__ww;
    w.step(60);
    // (even when the countdown would run out)
    w.G.rushNext = 1;
    w.step(5);
    return { rush: w.G.rushT || 0 };
  });
  expect(r.rush).toBe(0);
  expect(errors).toEqual([]);
});
