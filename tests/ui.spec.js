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

test('the difficulty is set in the options and sets dangers and pace', async ({ page }) => {
  const errors = await lobby(page);
  await page.click('#lbOpt');
  const tile = page.locator('#pBody .opt', { hasText: 'Schwierigkeit' });
  await expect(tile).toContainText('Schwierigkeit: Abenteuer');
  // (a panel ignores taps for a moment after it opens, against double taps)
  await page.waitForTimeout(500);
  await tile.click();
  await expect(tile).toContainText('Schwierigkeit: Hart');
  await page.waitForTimeout(500);
  await page.click('#pClose');
  await play(page);
  expect(await page.evaluate(() => [window.__ww.G.relaxed, window.__ww.G.speed])).toEqual([false, 1]);
  // in the game menu the difficulty is not offered: the world is already made
  await page.click('#menuBtn');
  await expect(page.locator('#pBody .opt', { hasText: 'Schwierigkeit' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a relaxed round has no dangers and a calm pace', async ({ page }) => {
  await lobby(page, { diff: 'relaxed' });
  await play(page);
  expect(await page.evaluate(() => [window.__ww.G.relaxed, window.__ww.G.speed])).toEqual([true, 0.7]);
});

test('the lobby names mode and world of the chosen card, there is no second choice', async ({ page }) => {
  await lobby(page, { gmode: 'treasure', mode: 'desert' });
  await expect(page.locator('#lbGModeTxt')).toHaveText('Schatzsucher · Wüste');
  await expect(page.locator('#lbGModePv canvas')).toHaveCount(1);
  await expect(page.locator('.lb-play .lb-sel')).toHaveCount(1);
});

test('a tap next to a panel closes it, in the lobby and in the game, without walking there', async ({ page }) => {
  const errors = await lobby(page);
  await page.click('#lbOpt');
  await page.waitForTimeout(500);
  await page.mouse.click(890, 440);
  await expect(page.locator('#panel')).toBeHidden();
  await play(page);
  await page.click('#menuBtn');
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => window.__ww.crew[0].x);
  await page.mouse.click(860, 420);
  await expect(page.locator('#panel')).toBeHidden();
  await page.waitForTimeout(600);
  expect(Math.abs((await page.evaluate(() => window.__ww.crew[0].x)) - before)).toBeLessThan(2);
  expect(errors).toEqual([]);
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
  await expect(page.locator('#panel .psec')).toHaveText([/Spiel · v/, 'Ton', 'Steuerung', 'Anzeige', 'Grafik']);
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
