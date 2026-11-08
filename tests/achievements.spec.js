// Achievements (achievements.js): selling the first nugget is one (banner, XP, kept in the
// profile); counters add up over games, the depth keeps its highest; the quest board lists them
// with how far you are: npm test
import { expect, test } from '@playwright/test';

test('the first nugget sold: an achievement with a banner and XP; the board lists them all', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3 }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const r = await page.evaluate(async () => {
    const { P, track } = await import('/src/profile.js'),
      { unload } = await import('/src/store.js');
    const xp0 = P.xp + P.level * 1000;
    // a nugget sold at the castle
    unload(['nug'], 100, 100);
    // the depth keeps its highest, the others add up
    track('deep', 30, true);
    track('deep', 20, true);
    track('chop');
    track('chop');
    return {
      ach: !!P.ach.nug1,
      more: Object.keys(P.ach).length,
      xp: P.xp + P.level * 1000 > xp0,
      deep: P.life.deep,
      chop: P.life.chop,
      saved: !!JSON.parse(localStorage.getItem('flintworks-profile')).ach,
    };
  });
  expect(r).toEqual({ ach: true, more: 1, xp: true, deep: 30, chop: 2, saved: r.saved });
  await expect(page.locator('body')).toContainText('Erster Klumpen');
  // the board in the lobby: 1 of 18, the reached one first, the others with a bar
  await page.evaluate(() => window.__ww.G.openMenu?.());
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbLvlBtn');
  await expect(page.locator('#panel')).toContainText('Erfolge 1/22');
  expect(await page.locator('#achList .ach').count()).toBe(22);
  expect(await page.locator('#achList .ach').first().getAttribute('class')).toContain('done');
  await expect(page.locator('#achList .ach').nth(1)).toContainText('/');
  await page.locator('#achList').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: test.info().outputPath('ach.png') });
  expect(errors).toEqual([]);
});
