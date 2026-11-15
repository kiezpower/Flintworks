import { expect, test } from '@playwright/test';
import { WIDTH, aim, busy, finished, fire, newRange, tick, trajectory } from '../src/blastrange-model.js';

function finishShot(s) {
  let n = 0;
  while (busy(s) && n++ < 600) tick(s);
  expect(busy(s)).toBe(false);
}

test('three physical throws destroy terrain, chain powder kegs and end the practice round', () => {
  const s = newRange(), original = s.cells.slice();
  const path = trajectory(s);
  expect(path.length).toBeGreaterThan(5);
  expect(path.some(([, y]) => y < path[0][1])).toBe(true);
  expect(fire(s)).toBe(true);
  expect(fire(s)).toBe(false);
  finishShot(s);
  expect(s.shots).toBe(2);
  expect(s.barrels.filter(b => b.spent)).toHaveLength(2);
  expect(s.chain).toBe(2);
  expect(s.score).toBeGreaterThan(1000);
  expect(s.cells.filter(Boolean).length).toBeLessThan(original.filter(Boolean).length);
  for (const x of [151, 213]) { aim(s, x); expect(fire(s)).toBe(true); finishShot(s); }
  expect(s.barrels.every(b => b.spent)).toBe(true);
  expect(finished(s)).toBe(true);
  expect(fire(s)).toBe(false);
  expect(s.shots).toBe(0);
  // Each replay has identical terrain and scoring, without sharing mutable cells.
  const other = newRange();
  expect(other.cells).toEqual(original);
  for (const x of [65, 151, 213]) { aim(other, x); fire(other); finishShot(other); }
  expect(other.score).toBe(s.score);
});

test('the ballistic preview ends where the actual charge lands, including existing craters', () => {
  const s = newRange();
  for (const x of [65, 65, 213]) {
    aim(s, x);
    const predicted = trajectory(s).at(-1);
    fire(s);
    for (let i = 0; i < 240 && !s.bomb.landed; i++) tick(s);
    expect(s.bomb.landed).toBe(true);
    expect(s.bomb.x).toBeCloseTo(predicted[0]);
    expect(s.bomb.y).toBeCloseTo(predicted[1]);
    finishShot(s);
  }
});

async function lobby(page, lang = 'de') {
  await page.goto('/');
  await page.evaluate(lang => {
    localStorage.clear(); localStorage.setItem('flintworks-lang', lang);
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', playKind: 'solo', gmode: 'settlement' }));
  }, lang);
  await page.reload(); await page.waitForFunction(() => window.__ww);
}
async function shoot(page, x) {
  await page.locator('#blastAim').fill(String(x));
  await page.click('#blastThrow');
  await expect(page.locator('#blastThrow')).toBeDisabled();
  await expect(page.locator('.blast-range')).not.toHaveAttribute('data-state', 'flying', { timeout: 15000 });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
  test(`practice is playable and reachable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await lobby(page); await page.click('#lbPractice');
    await expect(page.locator('#pTitle')).toHaveText('Sprengplatz');
    for (const id of ['blastCanvas', 'blastAim', 'blastThrow', 'blastAgain', 'pClose']) {
      const el = page.locator('#' + id); await el.scrollIntoViewIfNeeded();
      const b = await el.boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
      expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
    }
    await shoot(page, 65);
    await expect(page.locator('#blastShots')).toHaveText('2');
    expect(Number(await page.locator('#blastScore').textContent())).toBeGreaterThan(1000);
    await page.locator('#blastCanvas').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/blast-range-${viewport.width}.png` });
    await page.click('#pClose');
    await page.click('#lbPlay');
    await page.waitForFunction(() => window.__ww.state === 'play');
    expect(errors).toEqual([]);
  });
}

test('a completed score survives reload and a restart resets only the practice pit', async ({ page }) => {
  await lobby(page);
  await page.evaluate(async () => {
    const w = window.__ww; await w.G.createWorld({ name: 'Unberührt', biome: 'winter' });
    w.G.money = 987; w.save(); await w.G.worldSavePending;

  });
  await page.click('#menuBtn');
  await page.locator('#pBody').getByText('Lobby', { exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('wuehlwelt-save-v1'));
  await page.click('#lbPractice');
  for (const x of [65, 151, 213]) await shoot(page, x);
  await expect(page.locator('.blast-range')).toHaveAttribute('data-state', 'finished');
  const score = await page.locator('#blastScore').textContent();
  await expect(page.locator('#blastRecord')).toHaveText(score);
  await page.click('#blastAgain');
  await expect(page.locator('#blastScore')).toHaveText('0');
  await expect(page.locator('#blastShots')).toHaveText('3');
  await expect(page.locator('#blastRecord')).toHaveText(score);
  expect(await page.evaluate(() => localStorage.getItem('wuehlwelt-save-v1'))).toBe(saved);
  await page.reload(); await page.click('#lbPractice');
  await expect(page.locator('#blastRecord')).toHaveText(score);
  await page.click('#pClose'); await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => [window.__ww.G.worldName, window.__ww.G.money])).toEqual(['Unberührt', 987]);
});

test('keyboard aiming works in English with reduced motion and closing cancels a pending charge', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await lobby(page, 'en'); await page.click('#lbPractice');
  await expect(page.locator('#pTitle')).toHaveText('Blasting range');
  const canvas = page.locator('#blastCanvas');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box.width * 151 / WIDTH, y: box.height / 2 } });
  const target = Number(await page.locator('#blastAim').inputValue());
  await canvas.press('ArrowLeft'); await expect(page.locator('#blastAim')).toHaveValue(String(target - 5));
  await canvas.press('ArrowRight'); await expect(page.locator('#blastAim')).toHaveValue(String(target));
  await canvas.press('Space');
  await expect(page.locator('#blastShots')).toHaveText('2');
  await page.keyboard.press('Escape');
  await page.click('#lbPractice');
  await expect(page.locator('#blastShots')).toHaveText('3');
  await expect(page.locator('#blastThrow')).toHaveText('Throw charge');
  await page.waitForTimeout(1300);
  await expect(page.locator('#blastScore')).toHaveText('0');
});
