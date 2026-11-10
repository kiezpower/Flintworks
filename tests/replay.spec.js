// Watching a Tagesschicht run again (replay.js): the run is written down while it is played and,
// played back in the same world, ends with the same money and the same ground – with helpers
// planning, digging, orders from the panels and drawing in between; nothing of the playback
// counts (no result, no save): npm test
import { expect, test } from '@playwright/test';

test('a recorded Tagesschicht run plays back exactly, and the playback counts for nothing', async ({ page }) => {
  test.setTimeout(240000);
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
  await page.click('#lbDaily');
  await page.click('#dlGo');
  await page.waitForFunction(() => window.__ww.state === 'play' && window.__ww.G.mode === 'daily');
  // the run: walking, digging down and sideways, jumping, an order from a panel; the page keeps
  // drawing (and drawing random numbers) between the pieces
  for (let part = 0; part < 6; part++) {
    await page.evaluate(part => {
      const w = window.__ww;
      for (let t = 0; t < 250; t++) {
        const p = (t + part * 250) % 600;
        w.keys.r = p < 200 ? 1 : 0;
        w.keys.l = p >= 400 && p < 480 ? 1 : 0;
        w.keys.d = p >= 200 && p < 300 ? 1 : 0;
        w.keys.dig = p >= 150 && p < 320 ? 1 : 0;
        if (t % 97 === 0) w.edge.jump = true;
        w.step(1);
      }
      w.keys.r = w.keys.l = w.keys.d = w.keys.dig = 0;
      if (part === 2) w.send('isel', { i: 0 });
    }, part);
    await page.waitForTimeout(150);
  }
  const rec = await page.evaluate(() => {
    const w = window.__ww;
    w.G.onLevelEnd(true);
    const d = JSON.parse(localStorage.getItem('flintworks-replay'));
    return { earned: d.earned, ticks: atob(d.bin).length / 11, cmds: d.cmds.length, dug: d.hash };
  });
  expect(rec.ticks).toBeGreaterThan(1500);
  expect(rec.cmds).toBeGreaterThan(0);
  const best = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('flintworks-profile')).daily));
  // watch it: it runs by itself (the viewer's keys do nothing) to the very same end
  await page.click('#watchBtn');
  await page.waitForFunction(() => window.__ww.state === 'play' && window.__ww.G.replaying);
  await page.evaluate(async () => {
    const w = window.__ww;
    w.keys.l = 1; // (ignored)
    for (let k = 0; k < 4000 && w.G.state === 'play'; k++) {
      w.step(1);
      if (k % 400 === 0) await new Promise(r => requestAnimationFrame(r));
    }
    w.keys.l = 0;
  });
  await expect(page.locator('#card')).toContainText('Wiederholung zu Ende');
  expect(await page.locator('#card').getAttribute('data-replay')).toBe('same');
  await expect(page.locator('#card')).toContainText(`${rec.earned} Taler`);
  // nothing counted: the day's result as before, no saved game
  expect(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('flintworks-profile')).daily))).toBe(best);
  expect(await page.evaluate(() => localStorage.getItem('wuehlwelt-save-v1'))).toBeNull();
  expect(errors).toEqual([]);
});
