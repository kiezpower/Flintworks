// The twists of the Tagesschicht (daily.js): nine of them, two days in a row never the same one, each
// does what it says (?day=N plays the shift of day N on the dev server): npm test
import { expect, test } from '@playwright/test';

async function lobby(page, day) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3 }));
  });
  await page.goto(day ? `/?day=${day}` : '/');
  await page.waitForFunction(() => window.__ww);
  return errors;
}

test('nine twists come round, never the same one two days in a row', async ({ page }) => {
  const errors = await lobby(page);
  const r = await page.evaluate(async () => {
    const { dayInfo } = await import('/src/daily.js');
    const ids = Array.from({ length: 400 }, (_, k) => dayInfo(k + 1).twist.id);
    return {
      repeats: ids.filter((id, k) => k && id === ids[k - 1]).length,
      first9: new Set(ids.slice(0, 9)).size,
      all: [...new Set(ids)].sort(),
    };
  });
  expect(r.repeats).toBe(0);
  expect(r.first9).toBe(9);
  expect(r.all).toEqual(['drill', 'fever', 'fight', 'gold', 'hook', 'night', 'quake', 'rich', 'volcano']);
  expect(errors).toEqual([]);
});

// one test per twist: which day it falls on is looked up in the game
for (const id of ['gold', 'volcano', 'quake', 'drill', 'rich', 'night', 'fever', 'fight', 'hook'])
  test(`twist "${id}" starts the shift as it promises`, async ({ page }) => {
    const errors = await lobby(page);
    const day = await page.evaluate(async id => {
      const { dayInfo } = await import('/src/daily.js');
      for (let n = 1; n <= 9; n++) if (dayInfo(n).twist.id === id) return n;
    }, id);
    expect(day).toBeGreaterThan(0);
    await page.goto(`/?day=${day}`);
    await page.waitForFunction(() => window.__ww);
    await page.click('#lbDaily');
    await page.click('#dlGo');
    await page.waitForFunction(() => window.__ww.state === 'play' && window.__ww.G.mode === 'daily');
    const r = await page.evaluate(async () => {
      const w = window.__ww,
        G = w.G,
        { sunAlt } = await import('/src/weather.js');
      w.step(30);
      return {
        tw: G.daily.tw,
        money: G.money,
        tools: Object.keys(G.tools || {}).filter(k => G.tools[k]).sort(),
        store: { ...G.store },
        night: sunAlt() < 0,
        evKinds: G.evKinds,
        // (the Wühler at the castle takes up to three torches along: store and bag together)
        torches: (G.store.torch || 0) + w.crew.reduce((n, c) => n + c.inv.filter(t => t === 'torch').length, 0),
      };
    });
    expect(r.tw).toBe(id);
    if (id === 'night') {
      expect(r.night).toBe(true);
      expect(r.tools).toContain('lamp');
      expect(r.torches).toBeGreaterThanOrEqual(6);
      // bright again after a good four minutes
      const light = await page.evaluate(async () => {
        const w = window.__ww,
          { sunAlt } = await import('/src/weather.js');
        w.step(4.6 * 60 * 60);
        return sunAlt() > 0;
      });
      expect(light).toBe(true);
    } else expect(r.night).toBe(false);
    if (id === 'fight') {
      expect(r.tools).toContain('sword');
      expect(r.tools).toContain('r_metal');
      expect(r.store.metal).toBe(2);
    }
    if (id === 'hook') {
      expect(r.tools).toContain('hook');
      expect(r.money).toBe(120);
    }
    if (id === 'volcano') expect(r.evKinds).toEqual(['volcano']);
    if (id === 'quake') expect(r.evKinds).toEqual(['quake']);
    if (id === 'rich') expect(r.money).toBe(240);
    if (id === 'drill') expect(r.tools).toContain('r_mech');
    if (id === 'fever') {
      // the first fever comes after 90 seconds, pays double for gold for a minute, and again later
      const f = await page.evaluate(async () => {
        const w = window.__ww,
          G = w.G,
          { unload } = await import('/src/store.js');
        const sell = () => {
          // (the castle grows by itself during a round, and the price with it: the same level)
          G.base.lvl = 1;
          const m0 = G.money;
          unload(['nug'], 100, 100);
          return G.money - m0;
        };
        const plain = sell();
        w.step(89 * 60);
        const before = G.rushT || 0;
        w.step(2 * 60);
        const on = G.rushT > 0;
        const rush = sell();
        w.step(60 * 60);
        const off = !(G.rushT > 0);
        w.step(76 * 60);
        return { before, on, double: rush === plain * 2, off, again: G.rushT > 0 };
      });
      expect(f).toEqual({ before: 0, on: true, double: true, off: true, again: true });
    } else {
      // (no fever on the other days)
      const none = await page.evaluate(() => {
        window.__ww.G.rushNext = 1;
        window.__ww.step(5);
        return !(window.__ww.G.rushT > 0);
      });
      expect(none).toBe(true);
    }
    expect(errors).toEqual([]);
  });
