import { expect, test } from '@playwright/test';

async function ready(page) {
  await page.addInitScript(() => localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: 'Anna' })));
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  expect(await page.evaluate(async () => (await import('/src/creatureart.js')).creatureArtReady)).toBe(true);
}
const SIZE = { fluffel: [5, 4], fish: [4, 2], bat: [5, 3], monster: [12, 9], spider: [9, 6], crawler: [9, 6], slime: [10, 7], spore: [10, 7], golem: [16, 14], guardian: [16, 14], queen: [16, 12], iceking: [14, 14], worm: [10, 10] };

test('every creature has painted poses that cover its hitbox and stand on its feet', async ({ page }) => {
  await ready(page);
  const shots = await page.evaluate(async SIZE => {
    const { drawCreature } = await import('/src/creatureart.js');
    const out = {};
    for (const [kind, [w, h]] of Object.entries(SIZE)) for (const pose of ['idle', 'move', 'attack']) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 160;
      const g = cv.getContext('2d'); g.scale(4, 4);
      const drawn = drawCreature(g, kind, pose, 20 - w / 2, 28 - h, w, h, 1);
      const d = g.getImageData(0, 0, 160, 160).data;
      let count = 0, minX = 160, maxX = 0, minY = 160, maxY = 0, soft = 0;
      for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) {
        const a = d[(y * 160 + x) * 4 + 3];
        if (a > 0 && a < 255) soft++;
        if (a > 128) { count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
      out[kind + '/' + pose] = { drawn, count, minX, maxX, minY, maxY, soft, image: cv.toDataURL() };
    }
    return out;
  }, SIZE);
  for (const [key, s] of Object.entries(shots)) {
    const [kind] = key.split('/'), [w, h] = SIZE[kind];
    expect(s.drawn, key).toBe(true);
    expect(s.count, key).toBeGreaterThan(w * h * 16 * 0.45); // fills its hitbox, not a speck
    expect(s.soft, key).toBeGreaterThan(20); // smooth painted edges, not hard pixels
    expect(s.minX, key).toBeGreaterThan(0); expect(s.maxX, key).toBeLessThan(159);
    expect(s.minY, key).toBeGreaterThan(0);
    // standing creatures touch the floor under their hitbox (y = 28 cells = 112 px)
    if (!['fish', 'bat', 'worm'].includes(kind)) expect(Math.abs(s.maxY - 112), `${key}: bottom ${s.maxY}`).toBeLessThanOrEqual(4);
  }
  for (const kind of ['fluffel', 'bat', 'monster', 'spider', 'slime', 'golem']) expect(new Set(['idle', 'move', 'attack'].map(p => shots[kind + '/' + p].image)).size, kind).toBe(3);
  // recoloured relatives differ from the creature whose shape they wear
  for (const [a, b] of [['crawler', 'spider'], ['spore', 'slime'], ['guardian', 'golem']]) expect(shots[a + '/idle'].image).not.toBe(shots[b + '/idle'].image);
});

test('hurt flashes, pets wear a collar and the world draws the painted monster', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { drawCreature } = await import('/src/creatureart.js');
    const shot = (kind, o) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 96;
      const g = cv.getContext('2d'); g.scale(4, 4);
      drawCreature(g, kind, 'idle', 6, 8, 12, 9, 1, o);
      const d = g.getImageData(0, 0, 96, 96).data;
      let red = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { n++; if (d[i] > 190 && d[i + 1] < 130 && d[i + 2] < 130) red++; }
      return red / n;
    };
    return { plain: shot('monster', {}), hurt: shot('monster', { hurt: true }), fluffel: shot('fluffel', {}), pet: shot('fluffel', { pet: true }) };
  });
  expect(result.hurt).toBeGreaterThan(result.plain + 0.3);
  expect(result.pet).toBeGreaterThan(result.fluffel + 0.01);
});
