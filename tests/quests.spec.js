// The daily tasks (profile.js questsFor, rollQuests): three of nine kinds a day, the same for
// everybody on a day, never a kind two days in a row, new at midnight in the player's own time zone,
// a record like the depth counts as far as it was reached: npm test
import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Berlin' });

async function lobby(page, time) {
  await page.clock.install({ time });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3 }));
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  return errors;
}

test('every day brings other tasks: three kinds, the same for all, none repeated the next day', async ({ page }) => {
  const errors = await lobby(page, new Date('2026-11-10T10:00:00Z'));
  const r = await page.evaluate(async () => {
    const { questsFor, QUESTS } = await import('/src/profile.js');
    const days = Array.from({ length: 90 }, (_, k) => 20400 + k);
    const sets = days.map(n => questsFor(n));
    const out = { shared: [], bad: [], kinds: new Set(), again: 0, goals: {} };
    sets.forEach((s, k) => {
      const ids = s.map(q => q.id);
      if (new Set(ids).size !== 3) out.bad.push(`day ${days[k]} not three kinds`);
      for (const q of s) {
        out.kinds.add(q.id);
        if (!QUESTS[q.id].n.includes(q.goal)) out.bad.push(`day ${days[k]} goal ${q.goal}`);
        (out.goals[q.id] ||= new Set()).add(q.goal);
      }
      if (k) {
        const prev = sets[k - 1].map(q => q.id);
        if (ids.some(id => prev.includes(id))) out.shared.push(days[k]);
      }
      if (JSON.stringify(questsFor(days[k])) !== JSON.stringify(s)) out.again++;
    });
    return { shared: out.shared, bad: out.bad, kinds: [...out.kinds].sort(), again: out.again, goals: Object.fromEntries(Object.entries(out.goals).map(([k, v]) => [k, v.size])) };
  });
  expect(r.shared).toEqual([]);
  expect(r.bad).toEqual([]);
  expect(r.again).toBe(0);
  // all nine kinds come round, and the amounts of a kind vary over the days
  expect(r.kinds).toEqual(['build', 'chest', 'chop', 'deep', 'fish', 'gem', 'gold', 'monster', 'sell']);
  expect(Object.values(r.goals).every(n => n >= 2)).toBe(true);
  expect(errors).toEqual([]);
});

test('the tasks change at midnight where the player is, not at midnight UTC', async ({ page }) => {
  // 23:30 UTC on the 9th is 00:30 on the 10th in Berlin (UTC+1)
  const errors = await lobby(page, new Date('2026-11-09T23:30:00Z'));
  const day1 = await page.evaluate(async () => {
    const { P, rollQuests } = await import('/src/profile.js');
    rollQuests();
    return { day: P.questDay, ids: P.quests.map(q => q.id) };
  });
  expect(day1.day).toBe('2026-11-10');
  // the same local day later (23:30 Berlin on the 10th = 22:30 UTC): the same tasks, progress kept
  await page.evaluate(async () => {
    const { P } = await import('/src/profile.js');
    P.quests[0].have = 1;
  });
  await page.clock.setSystemTime(new Date('2026-11-10T22:30:00Z'));
  const same = await page.evaluate(async () => {
    const { P, rollQuests } = await import('/src/profile.js');
    rollQuests();
    return { day: P.questDay, ids: P.quests.map(q => q.id), have: P.quests[0].have };
  });
  expect(same).toEqual({ day: '2026-11-10', ids: day1.ids, have: 1 });
  // half an hour later it is the 11th in Berlin: new tasks, nothing in common, marked as new
  await page.clock.setSystemTime(new Date('2026-11-10T23:30:00Z'));
  const next = await page.evaluate(async () => {
    const { P, rollQuests } = await import('/src/profile.js');
    rollQuests();
    return { day: P.questDay, ids: P.quests.map(q => q.id), have: P.quests.map(q => q.have), isNew: P.questNew };
  });
  expect(next.day).toBe('2026-11-11');
  expect(next.ids.some(id => day1.ids.includes(id))).toBe(false);
  expect(next.have).toEqual([0, 0, 0]);
  expect(next.isNew).toBe(true);
  expect(errors).toEqual([]);
});

test('the depth task counts as far as it was reached, the fish task adds up; new tasks are announced once', async ({ page }) => {
  const errors = await lobby(page, new Date('2026-11-10T10:00:00Z'));
  const r = await page.evaluate(async () => {
    const { P, track, QUESTS } = await import('/src/profile.js');
    P.questDay = new Date().toISOString().slice(0, 10) + 'x'; // (force a new roll)
    const { rollQuests } = await import('/src/profile.js');
    rollQuests();
    // set tasks of the two kinds by hand, whatever today brings
    P.quests = [
      { id: 'deep', goal: 50, have: 0, done: false },
      { id: 'fish', goal: 3, have: 0, done: false },
      { id: 'sell', goal: 120, have: 0, done: false },
    ];
    track('deep', 20, true);
    track('deep', 12, true); // (a shallower report does not set it back)
    const deep1 = P.quests[0].have;
    track('deep', 55, true);
    track('fish');
    track('fish');
    return { deep1, deep2: P.quests[0].have, fish: P.quests[1].have, text: QUESTS.deep.text };
  });
  expect(r).toEqual({ deep1: 20, deep2: 50, fish: 2, text: 'Erreiche {n} m Tiefe' });
  // a new day: the lobby says so once, the level button is marked until the board was seen
  await page.clock.setSystemTime(new Date('2026-11-11T10:00:00Z'));
  await page.evaluate(async () => {
    const { rollQuests } = await import('/src/profile.js');
    rollQuests();
    window.__ww.G.openMenu?.();
  });
  await expect(page.locator('#lbLvlBtn')).toHaveClass(/alert/);
  await page.click('#lbLvlBtn');
  await expect(page.locator('#pTitle')).toHaveText('Tagesaufgaben');
  expect(await page.evaluate(async () => (await import('/src/profile.js')).P.questNew)).toBe(false);
  expect(errors).toEqual([]);
});

test('a finished task says so in the game; the tests keep it quiet', async ({ page }) => {
  const errors = await lobby(page, new Date('2026-11-10T10:00:00Z'));
  const quiet = await page.evaluate(() => window.__ww.G.questQuiet);
  expect(quiet).toBe(true);
  await page.goto('/?quietoff');
  await page.waitForFunction(() => window.__ww);
  await page.evaluate(async () => {
    const { P, track } = await import('/src/profile.js');
    P.quests = [{ id: 'chop', goal: 1, have: 0, done: false }];
    track('chop');
  });
  await expect(page.locator('#toast')).toContainText('Aufgabe erfüllt');
  expect(errors).toEqual([]);
});
