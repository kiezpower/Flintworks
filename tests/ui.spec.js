// A simpler UI: one settings list in groups for the lobby and the game menu (settings.js), one
// difficulty for dangers and pace, modern or classic controls, building areas as a rule of the
// mode, and a lobby with three signposts: npm test
import { expect, test } from '@playwright/test';

async function lobby(page, profile = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(p => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', ...p }));
  }, profile);
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  return errors;
}
const play = async page => {
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
};

test('the lobby has three signposts, the level opens the daily quests', async ({ page }) => {
  const errors = await lobby(page);
  await expect(page.locator('.lb-side .lb-b')).toHaveCount(3);
  await expect(page.locator('#lbKri')).toHaveText('0');
  await expect(page.locator('#lbRoadTxt')).toContainText('0/');
  await page.click('#lbLvlBtn');
  await expect(page.locator('#pTitle')).toHaveText('Tagesaufgaben');
  expect(errors).toEqual([]);
});

test('world and difficulty are picked in one panel; the difficulty sets dangers and pace', async ({ page }) => {
  const errors = await lobby(page);
  await page.click('#lbSetup');
  await expect(page.locator('#pTitle')).toHaveText('Neue Runde');
  // (a panel ignores taps for a moment after it opens, against double taps)
  await page.waitForTimeout(500);
  await page.locator('#pBody .opt', { hasText: 'Wüste' }).click();
  await page.waitForTimeout(500);
  await page.locator('#pBody .opt', { hasText: 'Hart' }).click();
  await expect(page.locator('#pBody .opt', { hasText: 'Hart' })).toContainText('✓');
  await page.waitForTimeout(500);
  await page.click('#pClose');
  await expect(page.locator('#lbSetupTxt')).toHaveText('Wüste · Hart');
  await play(page);
  expect(await page.evaluate(() => [window.__ww.G.biome, window.__ww.G.relaxed, window.__ww.G.speed])).toEqual([
    'desert',
    false,
    1,
  ]);
  expect(errors).toEqual([]);
});

test('a relaxed round has no dangers and a calm pace', async ({ page }) => {
  await lobby(page, { diff: 'relaxed' });
  await expect(page.locator('#lbSetupTxt')).toContainText('Gemütlich');
  await play(page);
  expect(await page.evaluate(() => [window.__ww.G.relaxed, window.__ww.G.speed])).toEqual([true, 0.7]);
});

test('building areas belong to the Siedler mode, not to the options', async ({ page }) => {
  await lobby(page, { gmode: 'build', territory: false });
  await play(page);
  expect(await page.evaluate(() => window.__ww.G.territory)).toBe(true);
  await lobby(page, { gmode: 'gold', territory: true });
  await play(page);
  expect(await page.evaluate(() => window.__ww.G.territory)).toBe(false);
});

test('the game menu shows the same grouped settings; classic controls climb, modern ones dig', async ({ page }) => {
  const errors = await lobby(page);
  await play(page);
  await page.click('#menuBtn');
  await expect(page.locator('#panel .psec')).toHaveText([/Spiel · v/, 'Ton', 'Steuerung', 'Grafik']);
  await expect(page.locator('#pBody .opt', { hasText: 'Karte' })).toHaveCount(0);
  expect(await page.evaluate(() => [window.__ww.G.autoDig, window.__ww.G.climbOn, window.__ww.G.jumpBtn])).toEqual([
    true,
    false,
    true,
  ]);
  await page.waitForTimeout(500);
  await page.locator('#pBody .opt', { hasText: 'Steuerung: Modern' }).click();
  await expect(page.locator('#pBody .opt', { hasText: 'Steuerung: Klassisch' })).toHaveCount(1);
  expect(await page.evaluate(() => [window.__ww.G.autoDig, window.__ww.G.climbOn])).toEqual([false, true]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).autodig)).toBe(false);
  expect(errors).toEqual([]);
});

test('option tiles without an icon put the title above its explanation', async ({ page }) => {
  await lobby(page);
  await page.click('#lbOpt');
  const tile = page.locator('#pBody .opt', { hasText: 'Steuerung' });
  const [t, s] = await Promise.all([tile.locator('b').boundingBox(), tile.locator('small').boundingBox()]);
  expect(s.y).toBeGreaterThanOrEqual(t.y + t.height - 1);
});
