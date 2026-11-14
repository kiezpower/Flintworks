import { expect, test } from '@playwright/test';

test('map disaster rules apply and reset when the next world starts; free-mode kits still apply', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  const rounds = await page.evaluate(async () => {
    const w = window.__ww, { GAME_MODES } = await import('/src/modes.js');
    return ['expedition', 'fluffelstollen', 'gold', 'fort'].map(id => {
      const M = GAME_MODES[id];
      Object.assign(w.G, { nextMode: id, nextSeed: M.seed || 1, nextBiome: M.biome || 'meadow', nextDiff: 'adventure', nextNp: 1, nextVersus: false });
      w.gen();
      w.G.nextSeed = null;
      return { id, rate: w.G.evRate, kinds: w.G.evKinds, rock: w.G.store.rock || 0 };
    });
  });
  expect(rounds).toEqual([
    { id: 'expedition', rate: 0.5, kinds: ['quake'], rock: 0 },
    { id: 'fluffelstollen', rate: 0, kinds: null, rock: 0 },
    { id: 'gold', rate: 1, kinds: null, rock: 0 },
    { id: 'fort', rate: 1, kinds: null, rock: 6 },
  ]);
});
