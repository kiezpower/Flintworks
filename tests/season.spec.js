// Seasons (season.js): Versus rounds bring points, the points a rank; a new month pays crystals
// for the rank reached and starts the points again: npm test
import { expect, test } from '@playwright/test';

test('season points make a rank, and a new month pays for it and starts afresh', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done' }));
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  const r = await page.evaluate(async () => {
    const { seasonResult, seasonRoll, seasonLine } = await import('/src/season.js'),
      { P } = await import('/src/profile.js');
    const kri = () => (P.camp && P.camp.k) || 0;
    const nov = new Date(2026, 10, 15),
      dec = new Date(2026, 11, 2);
    P.season = null;
    seasonRoll(nov);
    const out = { start: { ...P.season } };
    // four wins and a loss and a draw: 100 + 5 + 10 = 115, Silber
    let s;
    for (let k = 0; k < 4; k++) s = seasonResult('win', nov);
    out.promoted = s.up && s.rank === 'Silber';
    seasonResult('loss', nov);
    s = seasonResult('draw', nov);
    out.after = { pts: s.pts, rank: s.rank, toNext: s.toNext, line: seasonLine(s) };
    // the same month again: nothing happens
    out.same = seasonRoll(nov);
    // a new month: Silber pays 30 crystals, the points start again
    const k0 = kri();
    out.paid = seasonRoll(dec);
    out.kri = kri() - k0;
    out.next = { id: P.season.id, pts: P.season.pts, last: P.season.last };
    return out;
  });
  expect(r.start).toEqual({ id: '2026-11', pts: 0 });
  expect(r.promoted).toBe(true);
  expect(r.after).toEqual({ pts: 115, rank: 'Silber', toNext: 135, line: 'Saison: +10 · 115 Punkte · Silber (Gold in 135)' });
  expect(r.same).toBeNull();
  expect(r.paid).toEqual({ rank: 'Silber', kri: 30 });
  expect(r.kri).toBe(30);
  expect(r.next).toEqual({ id: '2026-12', pts: 0, last: { id: '2026-11', rank: 1, kri: 30 } });
  expect(errors).toEqual([]);
});
