// The clock in the HUD (ui.js drawClock), the warning before a dangerous night (nights.js) and the
// trader on the map (ui.js): npm test
import { expect, test } from '@playwright/test';

test('the clock shows day or night and the season; a warning comes before a night with monsters', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', diff: 'normal' }),
    );
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  await expect(page.locator('#clockBox')).toBeVisible();
  await expect(page.locator('#seasonTxt')).toHaveText('🌸');
  expect(await page.getAttribute('#clockBox', 'title')).toBe('Tag · Frühling');
  // the first night was quiet; before the second one a warning
  const warned = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    G.nights = { n: 1, dark: false };
    G.dayT = 0.41;
    w.step(31);
    return document.body.textContent.includes('Bald wird es dunkel');
  });
  expect(warned).toBe(true);
  await page.evaluate(() => {
    window.__ww.G.dayT = 0.7;
    window.__ww.step(31);
  });
  await page.waitForTimeout(700);
  expect(await page.getAttribute('#clockBox', 'title')).toBe('Nacht · Frühling');
  expect(errors).toEqual([]);
});
