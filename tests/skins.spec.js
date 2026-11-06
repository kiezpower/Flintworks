// Building styles (skins.js): stone and winter recolour the wood of a building, but never its
// fire, embers, gold or lit windows: npm test
import { expect, test } from '@playwright/test';

test('stone and winter style keep the furnace fire and the shop light', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  const r = await page.evaluate(async () => {
    const { SPR } = await import('/src/sprites.js');
    const { restyle } = await import('/src/skins.js');
    const out = {};
    for (const t of ['furnace', 'shop', 'hut'])
      for (const st of ['stone', 'winter']) {
        const s = SPR[t],
          a = s.getContext('2d').getImageData(0, 0, s.width, s.height).data,
          b = restyle(s, st).getContext('2d').getImageData(0, 0, s.width, s.height).data;
        let wood = 0,
          hot = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (!a[i + 3] || (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2])) continue;
          const mx = Math.max(a[i], a[i + 1], a[i + 2]),
            mn = Math.min(a[i], a[i + 1], a[i + 2]),
            l = (mx + mn) / 510,
            sat = mx === mn ? 0 : (mx - mn) / 255 / (1 - Math.abs(2 * l - 1));
          // a recoloured pixel with fire-like saturation; the snow line on top of winter is white
          if (sat > 0.7 && !(b[i] === 240 && b[i + 1] === 246)) hot++;
          else wood++;
        }
        out[t + '/' + st] = { recoloured: wood > 0, hot };
      }
    return out;
  });
  for (const [k, v] of Object.entries(r)) {
    expect(v.hot, k).toBe(0);
    if (!k.startsWith('furnace/stone')) expect(v.recoloured, k).toBe(true);
  }
});
