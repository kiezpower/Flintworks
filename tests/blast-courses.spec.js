import { expect, test } from '@playwright/test';
import { COURSES, courseOf, medalOf } from '../src/blastrange-courses.js';
import { aim, busy, finished, fire, newRange, tick } from '../src/blastrange-model.js';
import { PROGRESS_KEY, readProgress, recordResult, saveProgress } from '../src/blastrange-progress.js';

const routes = { yard: [65, 151, 213], chain: [45, 75, 125], gems: [60, 165, 185] };
function complete(id) {
  const s = newRange(id);
  for (const x of routes[id]) {
    aim(s, x); expect(fire(s)).toBe(true);
    let n = 0; while (busy(s) && n++ < 600) tick(s);
    expect(busy(s)).toBe(false);
  }
  return s;
}
for (const c of COURSES) test(`${c.id}: its distinct three-charge challenge can earn gold deterministically`, () => {
  const a = complete(c.id), b = complete(c.id);
  expect(finished(a)).toBe(true);
  expect(a.score).toBe(b.score);
  expect(medalOf(c.id, a.score)).toBe(3);
  expect(a.barrels.some(b => b.spent)).toBe(true);
  expect(newRange(c.id).cells).not.toEqual(a.cells);
  if (c.id !== 'yard') expect(newRange(c.id).cells).not.toEqual(newRange().cells);
});

function memory() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}
test('legacy records migrate only to the original course and concurrent better results survive', () => {
  const storage = memory(); storage.setItem('flintworks-blast-range-v1', '4134');
  const a = readProgress(storage), b = readProgress(storage);
  expect(a.scores).toEqual({ yard: 4134, chain: 0, gems: 0 });
  recordResult(a, 'chain', 9369, storage);
  b.selected = 'gems'; recordResult(b, 'gems', 8416, storage);
  expect(readProgress(storage)).toEqual({ selected: 'gems', scores: { yard: 4134, chain: 9369, gems: 8416 } });
  recordResult(a, 'chain', 3000, storage);
  expect(readProgress(storage).scores).toEqual({ yard: 4134, chain: 9369, gems: 8416 });
});

test('corrupt or unavailable storage keeps practice usable', () => {
  const storage = memory();
  storage.setItem(PROGRESS_KEY, '{bad json');
  expect(readProgress(storage).scores).toEqual({ yard: 0, chain: 0, gems: 0 });
  storage.setItem(PROGRESS_KEY, JSON.stringify({ selected: '__proto__', scores: { yard: -8, chain: { toString: null, valueOf: null }, gems: 'NaN' } }));
  expect(readProgress(storage)).toEqual({ selected: 'yard', scores: { yard: 0, chain: 0, gems: 0 } });
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  const progress = readProgress(blocked);
  expect(() => recordResult(progress, 'gems', 8416, blocked)).not.toThrow();
  expect(progress.scores.gems).toBe(8416);
  expect(() => saveProgress(progress, blocked)).not.toThrow();
  expect(courseOf('missing').id).toBe('yard');
});

async function open(page, lang = 'de', legacy = 0) {
  await page.goto('/');
  await page.evaluate(({ lang, legacy }) => {
    localStorage.clear(); localStorage.setItem('flintworks-lang', lang);
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', playKind: 'solo', gmode: 'settlement' }));
    if (legacy) localStorage.setItem('flintworks-blast-range-v1', String(legacy));
  }, { lang, legacy });
  await page.reload(); await page.click('#lbPractice');
}
async function shoot(page, target) {
  await page.locator('#blastAim').fill(String(target)); await page.click('#blastThrow');
  await expect(page.locator('.blast-range')).not.toHaveAttribute('data-state', 'flying', { timeout: 15000 });
}

test('course selection, medals and separate records survive restart, including the legacy record', async ({ page }) => {
  await open(page, 'de', 4134);
  await expect(page.locator('#blastRecord')).toHaveText('4134');
  await expect(page.locator('button[data-course="yard"] small')).toHaveText('Gold');
  await page.locator('button[data-course="chain"]').click();
  await expect(page.locator('#blastRecord')).toHaveText('0');
  for (const x of routes.chain) await shoot(page, x);
  await expect(page.locator('.blast-range')).toHaveAttribute('data-state', 'finished');
  await expect(page.locator('#blastGoal')).toHaveText('Goldmedaille erreicht!');
  await expect(page.locator('button[data-course="chain"] small')).toHaveText('Gold');
  await page.locator('button[data-course="gems"]').click();
  await expect(page.locator('#blastRecord')).toHaveText('0');
  await page.reload(); await page.click('#lbPractice');
  await expect(page.locator('.blast-range')).toHaveAttribute('data-course', 'gems');
  await page.locator('button[data-course="chain"]').click();
  await expect(page.locator('#blastRecord')).toHaveText('9369');
  await page.locator('button[data-course="yard"]').click();
  await expect(page.locator('#blastRecord')).toHaveText('4134');
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) test(`course switching cancels a throw and stays usable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
  await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page, 'en');
  await page.click('#blastThrow');
  await page.locator('button[data-course="gems"]').click();
  await expect(page.locator('.blast-range')).toHaveAttribute('data-course', 'gems');
  await expect(page.locator('#blastShots')).toHaveText('3');
  await expect(page.locator('#blastGoal')).toHaveText('1500 more points for Bronze');
  await expect(page.locator('button[data-course="gems"]')).toHaveAttribute('aria-pressed', 'true');
  for (const id of ['yard', 'chain', 'gems']) {
    const b = page.locator(`button[data-course="${id}"]`); await b.scrollIntoViewIfNeeded();
    const bounds = await b.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await b.click({ trial: true });
  }
  await page.waitForTimeout(1300);
  await expect(page.locator('#blastScore')).toHaveText('0');
  await shoot(page, 60);
  await page.locator('#blastCanvas').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/blast-courses-${viewport.width}.png` });
  expect(errors).toEqual([]);
});

test('practice still opens and records a completed attempt in memory when device storage is blocked', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page); await page.click('#pClose');
  await page.evaluate(() => Object.defineProperty(window, 'localStorage', {
    configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); },
  }));
  await page.click('#lbPractice');
  await page.locator('button[data-course="chain"]').click();
  for (const x of routes.chain) await shoot(page, x);
  await expect(page.locator('#blastRecord')).toHaveText('9369');
  await expect(page.locator('#blastGoal')).toHaveText('Goldmedaille erreicht!');
  expect(errors).toEqual([]);
});
