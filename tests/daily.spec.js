// Tagesschacht (daily.js): the same world for everybody on a day, a clock that ends the round,
// the result kept in the profile with medals and a streak, shared as text, and the ?daily link
// that opens today's shaft: npm test
import { expect, test } from '@playwright/test';

async function lobby(page, url = '/', profile = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(p => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', ...p }));
  }, profile);
  await page.goto(url);
  await page.waitForFunction(() => window.__ww);
  return errors;
}

test('every day has its own fixed world, and two days in a row never share a twist', async ({ page }) => {
  const errors = await lobby(page);
  const r = await page.evaluate(() =>
    import('/src/daily.js').then(d => {
      const days = Array.from({ length: 30 }, (_, k) => d.dayInfo(k + 1));
      return {
        same: JSON.stringify(d.dayInfo(5)) === JSON.stringify(d.dayInfo(5)),
        seeds: new Set(days.map(x => x.seed)).size,
        biomes: new Set(days.map(x => x.biome)).size,
        twists: new Set(days.map(x => x.twist.id)).size,
        repeat: days.some((x, k) => k && x.twist.id === days[k - 1].twist.id),
        first: d.dayNo(new Date(2026, 9, 26, 0, 5)),
        next: d.dayNo(new Date(2026, 9, 27, 23, 55)),
      };
    }),
  );
  expect(r.same).toBe(true);
  expect(r.seeds).toBe(30);
  expect(r.biomes).toBe(3);
  expect(r.twists).toBe(5);
  expect(r.repeat).toBe(false);
  expect(r.first).toBe(1);
  expect(r.next).toBe(2);
  expect(errors).toEqual([]);
});

test('the streak grows day by day, breaks after a gap, and only the best of a day counts', async ({ page }) => {
  await lobby(page);
  const r = await page.evaluate(() =>
    Promise.all([import('/src/daily.js'), import('/src/profile.js')]).then(([d, { P }]) => {
      const n = d.dayNo();
      P.daily = null;
      d.record(n, 300);
      d.record(n + 1, 500);
      const a = d.record(n + 2, 120);
      const b = d.record(n + 2, 90);
      const s1 = P.daily.streak;
      const text = d.shareText(n + 2);
      d.record(n + 5, 10); // (a gap)
      return {
        a,
        b,
        s1,
        best: P.daily.best[n + 2],
        tries: P.daily.tries[n + 2],
        top: P.daily.top,
        after: P.daily.streak,
        text,
      };
    }),
  );
  expect(r.a).toBe(true);
  expect(r.b).toBe(false);
  expect(r.best).toBe(120);
  expect(r.tries).toBe(2);
  expect(r.s1).toBe(3);
  expect(r.top).toBe(3);
  expect(r.after).toBe(1);
  expect(r.text).toContain('Tagesschacht #');
  expect(r.text).toContain('120 Taler');
  expect(r.text).toContain('🪨 · 🔥 3 Tage in Folge');
});

test('the shaft starts from the lobby with today’s world, ends on the clock and keeps the result', async ({ page }) => {
  const errors = await lobby(page);
  await expect(page.locator('#lbDailyTxt')).toContainText('Neu!');
  await page.click('#lbDaily');
  await expect(page.locator('#panel')).toContainText('Tagesschacht #');
  await page.waitForTimeout(500); // (a tap right after the panel opened is ignored)
  await page.click('#dlGo');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const s = await page.evaluate(() =>
    Promise.all([import('/src/daily.js'), import('/src/state.js')]).then(([d, { G }]) => ({
      mode: G.mode,
      seed: G.seed,
      want: d.dayInfo().seed,
      biome: G.biome,
      wantBiome: d.dayInfo().biome,
      day: G.daily && G.daily.n,
      today: d.dayNo(),
    })),
  );
  expect(s.mode).toBe('daily');
  expect(s.seed).toBe(s.want);
  expect(s.biome).toBe(s.wantBiome);
  expect(s.day).toBe(s.today);
  await page.waitForFunction(() => document.getElementById('goalTxt').textContent.includes('⏱'));

  // saved and loaded on the way: the shaft goes on as today's
  await page.evaluate(() => {
    window.__ww.save();
    return import('/src/state.js').then(({ G }) => {
      G.daily = null;
      window.__ww.load();
      return G.daily && G.daily.n;
    });
  });
  expect(await page.evaluate(() => import('/src/state.js').then(({ G }) => G.daily && G.daily.n))).toBe(s.today);

  // 470 Taler earned, then the clock runs out
  await page.evaluate(() =>
    Promise.all([import('/src/daily.js'), import('/src/state.js')]).then(([d, { G }]) => {
      G.earned = 470;
      G.playTicks = d.LEN - 5;
    }),
  );
  await page.evaluate(() => window.__ww.step(40));
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#card')).toContainText('Tagesschacht #');
  await expect(page.locator('#card')).toContainText('🥈 470 Taler');
  await expect(page.locator('#shareBtn')).toBeVisible();
  const best = await page.evaluate(() =>
    Promise.all([import('/src/daily.js'), import('/src/profile.js')]).then(([d, { P }]) => P.daily.best[d.dayNo()]),
  );
  expect(best).toBe(470);

  // back in the lobby the sign shows the medal instead of "new"
  await page.click('#goBtn');
  await expect(page.locator('#lbDailyTxt')).toContainText('🥈 470');
  expect(errors).toEqual([]);
});

test('a shared link (?daily) opens today’s shaft in the lobby', async ({ page }) => {
  const errors = await lobby(page, '/?daily');
  await expect(page.locator('#panel')).toContainText('Tagesschacht #');
  await expect(page.locator('#panel')).toContainText('Los geht’s!');
  expect(page.url()).not.toContain('daily');
  expect(errors).toEqual([]);
});
