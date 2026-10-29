// The level selection (levelselect.js): one list of sections with rows of cards, jump chips,
// pictures, the level to go on with, locked levels with their reason, the detail view, keys,
// starting, the choice kept in the lobby, and "next level" after a win: npm test
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
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  return errors;
}
const shown = page => page.evaluate(() => !document.getElementById('levelsel').hidden);

test('the selection shows the chapters with pictures, the next level, locks and details', async ({ page }) => {
  const errors = await lobby(page, { campaign: { wipfrettung: 3 }, campaignTime: { wipfrettung: 312 } });
  await page.click('#lbGMode');
  expect(await shown(page)).toBe(true);
  // one chip per group: recommended, game modes, two chapters, maps
  expect(await page.locator('.ls-tab').allTextContents()).toEqual([
    'Empfohlen',
    'Spielmodi',
    'Kapitel 1',
    'Kapitel 2',
    'Karten',
  ]);
  await page.click('.ls-tab[data-t="k2"]');
  expect(await page.locator('.ls-tab.on').getAttribute('data-t')).toBe('k2');
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('.ls-sec[data-s="k2"] .ls-card')].map(c => ({
      id: c.dataset.id,
      locked: c.classList.contains('locked'),
      next: c.classList.contains('next'),
      picture: !!c.querySelector('.ls-pv img, .ls-pv canvas:not(.ls-badge)'),
    })),
  );
  expect(cards.length).toBe(8);
  expect(cards.every(c => c.picture)).toBe(true);
  expect(cards.filter(c => c.next).map(c => c.id)).toEqual(['altemine']);
  expect(cards.filter(c => !c.locked).map(c => c.id)).toEqual(['wipfrettung', 'altemine']);
  // the pictures load
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.ls-sec[data-s="k2"] .ls-card img')].every(i => i.complete && i.naturalWidth > 0),
  );
  // details of a played level: its story, goal, star times and best time
  await page.click('.ls-card[data-id="wipfrettung"]');
  const info = await page.textContent('.ls-info');
  expect(info).toContain('Rette 4 Wipfe');
  expect(info).toContain('3 Sterne unter 6 Min.');
  expect(info).toContain('Bestzeit 5:12');
  expect(await page.textContent('.ls-go')).toBe('Spielen');
  // back with Escape, then a locked level says why
  await page.keyboard.press('Escape');
  await page.click('.ls-card[data-id="insel"]');
  expect(await page.locator('.ls-go').isDisabled()).toBe(true);
  expect(await page.textContent('.ls-go')).toBe('Erst 1 Stern in Die alte Mine');
  // dangers from the level: the volcano island has lava and volcanoes and a time limit
  await page.keyboard.press('Escape');
  await page.click('.ls-card[data-id="feuerinsel"]');
  const dz = await page.locator('.ls-chip').allTextContents();
  expect(dz).toEqual(expect.arrayContaining(['Vulkane', 'Lava', 'Zeitlimit 25 Min.']));
  // Escape twice: back to the lobby
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  expect(await shown(page)).toBe(false);
  expect(errors).toEqual([]);
});

test('arrow keys move between cards, Enter opens and starts, the lobby keeps the choice', async ({ page }) => {
  const errors = await lobby(page, { campaign: { wipfrettung: 1 } });
  await page.click('#lbGMode');
  await page.click('.ls-tab[data-t="k2"]');
  await page.focus('.ls-sec[data-s="k2"] .ls-card[data-id="wipfrettung"]');
  // up: the row above (chapter 1), down again: back to the first card of chapter 2
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => document.activeElement.closest('.ls-sec').dataset.s)).toBe('k1');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.activeElement.dataset.id)).toBe('altemine');
  await page.keyboard.press('Enter');
  expect(await page.textContent('.ls-info h3')).toContain('Die alte Mine');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const r = await page.evaluate(() => ({
    mode: window.__ww.G.mode,
    W: window.__ww.world.W,
    gmode: JSON.parse(localStorage.getItem('flintworks-profile')).gmode,
  }));
  expect(r).toEqual({ mode: 'altemine', W: 1000, gmode: 'altemine' });
  // back in the lobby without the running game: the mode button names the level and shows
  // its picture (leaving the page saves the round, so the save goes after that)
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('wuehlwelt-save-v1'));
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  expect(await page.textContent('#lbGModeTxt')).toContain('Die alte Mine');
  expect(await page.locator('#lbGModePv img').count()).toBe(1);
  expect(errors).toEqual([]);
});

test('a map and a game mode start from the selection', async ({ page }) => {
  const errors = await lobby(page);
  await page.click('#lbGMode');
  await page.click('.ls-tab[data-t="maps"]');
  await page.click('.ls-card[data-id="expedition"]');
  await page.click('.ls-go');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.world.W])).toEqual(['expedition', 2800]);
  await lobby(page);
  // a game mode is a card per world type: Siedler in the winter
  await page.click('#lbGMode');
  await page.click('.ls-card[data-id="build"][data-biome="winter"]');
  expect(await page.textContent('.ls-info h3')).toBe('Siedler · Winter');
  await page.click('.ls-go');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.G.biome, window.__ww.world.W])).toEqual([
    'build',
    'winter',
    1400,
  ]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).mode)).toBe('winter');
  expect(errors).toEqual([]);
});

test('recommended: the level to go on with and the Tagesschacht, which opens its panel', async ({ page }) => {
  const errors = await lobby(page, { campaign: { c1: 1 } });
  await page.click('#lbGMode');
  const rec = await page.evaluate(() =>
    [...document.querySelectorAll('.ls-sec[data-s="rec"] .ls-card')].map(c => c.dataset.id),
  );
  expect(rec).toEqual(['c2', 'daily']);
  // the lobby's choice is marked and in view: Goldrausch in the desert
  await lobby(page, { gmode: 'gold', mode: 'desert' });
  await page.click('#lbGMode');
  expect(await page.locator('.ls-card.cur').count()).toBe(1);
  expect(await page.locator('.ls-card.cur').getAttribute('data-biome')).toBe('desert');
  await page.click('.ls-card[data-id="daily"]');
  expect(await shown(page)).toBe(false);
  await expect(page.locator('#pTitle')).toContainText('Tagesschacht');
  expect(errors).toEqual([]);
});

test('after a won level the end screen offers the next one', async ({ page }) => {
  const errors = await lobby(page, { gmode: 'wipfrettung' });
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play' && window.__ww.G.mode === 'wipfrettung');
  await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    for (const a of w.animals.filter(a => a.lost)) {
      c.x = a.x;
      c.y = a.y - 6;
      c.vx = c.vy = 0;
      w.step(35);
    }
    w.step(5);
  });
  await page.waitForFunction(() => window.__ww.state === 'won');
  expect(await page.textContent('#nextBtn')).toContain('Die alte Mine');
  await page.click('#nextBtn');
  await page.waitForFunction(() => window.__ww.state === 'play' && window.__ww.G.mode === 'altemine');
  expect(errors).toEqual([]);
});
