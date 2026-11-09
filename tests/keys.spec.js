// Own keys (keys.js): an action gets a new key in the settings, the game follows it, and the
// standard keys can come back: npm test
import { expect, test } from '@playwright/test';

test('jump on J: set in the settings, used in the game, and reset again', async ({ page }) => {
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
  await page.keyboard.press('KeyA'); // (a key: the game knows a keyboard is used)
  // the game menu: the keys section, "Springen" on J
  await page.keyboard.press('Escape');
  await expect(page.locator('#panel')).toContainText('Tasten');
  await page.waitForTimeout(500);
  const jump = page.locator('#panel .opt', { hasText: 'Springen' });
  await expect(jump).toContainText('Leertaste');
  await jump.click();
  await expect(page.locator('#panel .opt', { hasText: 'Springen' })).toContainText('Drück eine Taste');
  await page.keyboard.press('KeyJ');
  await expect(page.locator('#panel .opt', { hasText: 'Springen' })).toContainText('J');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).keys)).toEqual({ jump: 'KeyJ' });
  // in the game J jumps
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const vy = await page.evaluate(async () => {
    const { edge } = await import('/src/input.js');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
    const jumped = edge.jump;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }));
    return jumped;
  });
  expect(vy).toBe(true);
  // reset
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.locator('#panel .opt', { hasText: 'Tasten zurücksetzen' }).click();
  await expect(page.locator('#panel .opt', { hasText: 'Springen' })).toContainText('Leertaste');
  expect(errors).toEqual([]);
});
