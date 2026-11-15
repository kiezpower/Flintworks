import { expect, test } from '@playwright/test';

test('authored maps and campaign levels do not inherit procedural zones, shrines, hoards or their creatures', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  const worlds = await page.evaluate(async () => {
    const w = window.__ww, { GAME_MODES } = await import('/src/modes.js');
    const make = id => {
      const M = GAME_MODES[id];
      Object.assign(w.G, { nextMode: id, nextSeed: M.seed || 7, nextBiome: M.biome || 'meadow', nextDiff: 'adventure', nextNp: 1, nextVersus: false });
      w.gen(); w.G.nextSeed = null;
      return { zones: w.G.zones?.length || 0, shrines: w.G.shrines?.length || 0,
        hoards: w.G.hoards?.length || 0, animals: w.animals.map(a => a.kind), lost: w.animals.filter(a => a.lost).length };
    };
    return { before: make('gold'), race: make('gipfelrennen'), between: make('gold'), rescue: make('fluffelrettung'), after: make('gold') };
  });
  for (const free of [worlds.before, worlds.between, worlds.after]) {
    expect(free.zones).toBeGreaterThan(0); expect(free.shrines).toBeGreaterThan(0); expect(free.hoards).toBeGreaterThan(0);
  }
  expect(worlds.race).toEqual({ zones: 0, shrines: 0, hoards: 0, animals: [], lost: 0 });
  expect(worlds.rescue).toMatchObject({ zones: 0, shrines: 0, hoards: 0, lost: 4 });
  expect(worlds.rescue.animals).not.toEqual(expect.arrayContaining(['guardian']));
});
