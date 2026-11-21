import { expect, test } from '@playwright/test';

async function ready(page) {
  await page.addInitScript(() => localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: 'Anna' })));
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
}

test('painted scenery covers every biome, isolates all eight objects and preserves seasonal tree detail', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { drawSceneArt, preloadSceneArt } = await import('/src/sceneart.js');
    const { paintedObject, objectArtReady } = await import('/src/objectart.js');
    const { SPR, treeSprite } = await import('/src/sprites.js');
    const { restyle } = await import('/src/skins.js');
    const { treeLook } = await import('/src/seasons.js');
    await Promise.all([preloadSceneArt(), objectArtReady]);
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
    const g = cv.getContext('2d');
    const scenes = ['meadow', 'desert', 'winter', 'autumn'].map(biome => {
      g.clearRect(0, 0, 320, 180);
      const drawn = drawSceneArt(g, biome, 320, 180, 800);
      return { drawn, opaque: [0, 319].every(x => [0, 179].every(y => g.getImageData(x, y, 1, 1).data[3] === 255)) };
    });
    const originals = [...['base', 'hut', 'saw', 'shop', 'furnace', 'lift'].map(k => SPR[k]), treeSprite('pine', 4), treeSprite('oak', 4)];
    const objects = originals.map(spr => {
      const frame = paintedObject(spr), d = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
      let clear = 0, opaque = 0;
      for (let i = 3; i < d.length; i += 4) { if (!d[i]) clear++; if (d[i] > 250) opaque++; }
      return { high: frame.width > 250, clear: clear > frame.width * frame.height * 0.1, opaque: opaque > frame.width * frame.height * 0.15 };
    });
    const original = SPR.shop, styled = restyle(original, 'stone');
    const preserves = paintedObject(styled) === paintedObject(original) && styled.artStyle === 'stone' && styled.width === original.width;
    Object.assign(window.__ww.G, { biome: 'meadow', mode: 'gold', dayN: 0, tut: false });
    const tree = treeSprite('oak', 4), look = treeLook({ type: 'oak', stage: 4, spr: tree });
    const seasonal = paintedObject(look)?.width > 250;
    return { scenes, objects, preserves, seasonal };
  });
  for (const scene of result.scenes) expect(scene).toEqual({ drawn: true, opaque: true });
  for (const object of result.objects) expect(object).toEqual({ high: true, clear: true, opaque: true });
  expect(result.preserves).toBe(true);
  expect(result.seasonal).toBe(true);
});

test('missing scenery and object files leave the interactive lobby and fallback drawings usable', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/scenes/*.png', route => route.abort());
  await ready(page);
  const fallback = await page.evaluate(async () => {
    const scene = await import('/src/sceneart.js'), objects = await import('/src/objectart.js');
    const { SPR } = await import('/src/sprites.js');
    await Promise.all([scene.preloadSceneArt(), objects.objectArtReady]);
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
    const g = cv.getContext('2d');
    return !scene.drawSceneArt(g, 'meadow', 320, 180) && !objects.drawPaintedObject(g, SPR.base, 0, 0);
  });
  expect(fallback).toBe(true);
  await page.locator('#lbWho').click();
  await expect(page.locator('#pBody')).toBeVisible();
  expect(errors).toEqual([]);
});
