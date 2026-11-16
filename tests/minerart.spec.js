import { expect, test } from '@playwright/test';

async function lobby(page, artReady = true) {
  await page.addInitScript(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({
      tutorialDone: true, installAsked: 'done', name: 'BrunoTest', hero: 'bruno', cap: '#2f7fd0',
      games: 3, playKind: 'solo', gmode: 'gold',
    }));
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  expect(await page.evaluate(async () => (await import('/src/minerart.js')).minerArtReady)).toBe(artReady);
}

test('all 144 atlas cells render, move distinctly and stay on their foot baseline', async ({ page }) => {
  await lobby(page);
  const rows = await page.evaluate(async () => {
    const { drawMinerFrame } = await import('/src/minerart.js');
    const result = {};
    for (const hero of ['anna', 'bruno', 'mika', 'juna', 'toni', 'nora']) for (const action of ['idle', 'walk', 'shovel', 'pick']) {
      const key = hero + '/' + action;
      result[key] = [];
      for (let frame = 0; frame < 6; frame++) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 128;
        drawMinerFrame(cv.getContext('2d'), 64, 100, 1, action, frame, '#c8402c', 'blue', 1, '', hero);
        const data = cv.getContext('2d').getImageData(0, 0, 128, 128).data;
        let minX = 128, maxX = 0, minY = 128, maxY = 0, count = 0;
        for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (data[(y * 128 + x) * 4 + 3] > 128) {
          count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        result[key].push({ count, minX, maxX, minY, maxY, image: cv.toDataURL() });
      }
    }
    return result;
  });
  for (const [action, frames] of Object.entries(rows)) {
    expect(new Set(frames.map(f => f.image)).size, action).toBeGreaterThanOrEqual(action.endsWith('/idle') ? 2 : 4);
    for (const [index, f] of frames.entries()) {
      expect(f.count).toBeGreaterThan(180);
      expect(f.minX).toBeGreaterThan(0); expect(f.maxX).toBeLessThan(127);
      expect(f.minY).toBeGreaterThan(0);
      expect(Math.abs(f.maxY - 99), `${action} frame ${index}: bottom ${f.maxY}`).toBeLessThanOrEqual(2);
    }
  }
});

test('soft materials always show the shovel, including after a steel pick is bought', async ({ page }) => {
  await lobby(page);
  const result = await page.evaluate(async () => {
    const { digTool } = await import('/src/digtool.js');
    const { G } = window.__ww;
    const { EARTH, SAND, LOAM, GOLD, ORE, COAL, GEM, ROCK } = window.__ww.world;
    const tools = [];
    for (const owned of [{}, { pick: true }]) {
      G.tools = owned;
      tools.push([EARTH, SAND, LOAM, GOLD, ORE, COAL, GEM].map(digTool));
    }
    return { tools, stone: digTool(ROCK) };
  });
  expect(result.tools).toEqual([Array(7).fill('shovel'), Array(7).fill('shovel')]);
  expect(result.stone).toBe('pick');
});

test('material survives host snapshots so remote miners choose the same tool', async ({ page }) => {
  await lobby(page);
  const result = await page.evaluate(async () => {
    const { KINDS } = await import('/src/net/sync.js');
    const { digTool } = await import('/src/digtool.js');
    const { crew, world } = window.__ww;
    return [world.EARTH, world.ROCK].map(material => {
      const source = { ...crew[0], digM: material, digging: true, digDir: [1, 0] };
      const packed = KINDS.crew.pack(source);
      const target = { ...crew[0] };
      KINDS.crew.apply(target, packed);
      return { material: target.digM, tool: digTool(target.digM) };
    });
  });
  expect(result).toEqual([{ material: 1, tool: 'shovel' }, { material: 2, tool: 'pick' }]);
});

test('Bruno has the new portrait in the album and each digging material renders a different action', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await lobby(page);
  await page.click('#lbWho');
  await expect(page.locator('#heroPreviewName')).toHaveText('Bruno');
  await page.screenshot({ path: 'test-results/bruno-spritesheet-album.png', animations: 'disabled' });
  const images = await page.evaluate(async () => {
    const { drawDiggerHi } = await import('/src/diggerhi.js');
    const { crew, world } = window.__ww;
    const c = { ...crew[0], skin: 'blue.wood.2', cap: '#2f7fd0', hat: 'none',
      inv: [], isel: 0, digging: true, digDir: [1, 0], digPh: .7, anim: 0, vx: 0, vy: 0, airT: 0,
      climb: false, hangle: false, dead: false, burn: 0, hurt: 0, turnF: -999, startF: -999, stopF: -999 };
    return [world.EARTH, world.ROCK].map(digM => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 80;
      const ctx = cv.getContext('2d'); ctx.scale(4, 4);
      drawDiggerHi({ ...c, digM }, 5, 7, 1, ctx, 100);
      return cv.toDataURL();
    });
  });
  expect(images[0]).not.toBe(images[1]);
  expect(errors).toEqual([]);
});


test('a missing atlas keeps the existing character renderer and album usable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/bruno.png*', route => route.request().resourceType() === 'image' ? route.abort() : route.continue());
  await lobby(page, false);
  await page.click('#lbWho');
  await expect(page.locator('#heroPreviewName')).toHaveText('Bruno');
  await page.click('[data-hero="anna"]');
  await page.click('#heroSelect');
  await expect(page.locator('#panel')).toBeHidden();
  expect(errors).toEqual([]);
});


test('all six portraits keep native detail and the lobby canvas matches display density', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await lobby(page);
  await page.click('#lbWho');
  const sizes = await page.locator('.ha-card canvas').evaluateAll(canvases => canvases.map(cv => [cv.width, cv.height]));
  expect(sizes).toEqual(Array(6).fill([192, 256]));
  const identities = await page.locator('.ha-card canvas').evaluateAll(canvases => canvases.map(cv => cv.toDataURL()));
  expect(new Set(identities).size).toBe(6);
  const quality = await page.locator('#lbCv').evaluate(cv => ({ width: cv.width, displayed: cv.getBoundingClientRect().width }));
  expect(quality.width).toBeGreaterThanOrEqual(quality.displayed);
  await page.screenshot({ path: 'test-results/all-heroes-album.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/all-heroes-podium.png', animations: 'disabled' });
});


test('fast graphics bound the buffer without dropping to the world grid', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await lobby(page);
  const sizes = await page.evaluate(async () => {
    const { cv, resize } = await import('/src/render.js');
    const { G } = window.__ww;
    G.res = 1; resize();
    const fast = [cv.width, cv.height], world = [G.VW, G.VH];
    G.res = 2; resize();
    return { fast, world, fine: [cv.width, cv.height] };
  });
  expect(sizes.fast[0]).toBeGreaterThan(sizes.world[0] * 2);
  expect(sizes.fast[1]).toBeGreaterThan(sizes.world[1] * 2);
  expect(sizes.fast[0] * sizes.fast[1]).toBeLessThan(1_010_000);
  expect(sizes.fine[0]).toBeGreaterThan(sizes.fast[0]);
  expect(sizes.fine[1]).toBeGreaterThan(sizes.fast[1]);
});


test('the unselected starter uses illustrated Anna without changing saved identity', async ({ page }) => {
  await lobby(page);
  const pictures = await page.evaluate(async () => {
    const { drawPortrait } = await import('/src/portrait.js');
    return [null, 'anna'].map(hero => {
      const cv = document.createElement('canvas'); cv.width = 192; cv.height = 256;
      const ctx = cv.getContext('2d'); ctx.scale(8, 8);
      drawPortrait(ctx, 4, 10, 1, '#c8402c', 'none', false, 'blue', hero);
      return cv.toDataURL();
    });
  });
  expect(pictures[0]).toBe(pictures[1]);
});
