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
    // The mushroom has a narrow stem; the sentinel has gaps between floating stone slabs.
    const coverage = kind === 'guardian' ? 0.25 : 0.45;
    expect(s.count, key).toBeGreaterThan(w * h * 16 * coverage);
    expect(s.soft, key).toBeGreaterThan(20); // smooth painted edges, not hard pixels
    expect(s.minX, key).toBeGreaterThan(0); expect(s.maxX, key).toBeLessThan(159);
    expect(s.minY, key).toBeGreaterThan(0);
    // standing creatures touch the floor under their hitbox (y = 28 cells = 112 px)
    if (!['fish', 'bat', 'worm'].includes(kind)) expect(Math.abs(s.maxY - 112), `${key}: bottom ${s.maxY}`).toBeLessThanOrEqual(4);
  }
  for (const kind of ['fluffel', 'bat', 'monster', 'spider', 'slime', 'golem']) expect(new Set(['idle', 'move', 'attack'].map(p => shots[kind + '/' + p].image)).size, kind).toBe(3);
  // the common creatures have four distinct walking phases, as large as their idle picture
  const walk = await page.evaluate(async SIZE => {
    const { drawCreature, phasesOf } = await import('/src/creatureart.js');
    const out = {};
    for (const kind of ['fluffel', 'bat', 'monster', 'spider', 'slime', 'golem', 'crawler', 'spore', 'guardian']) {
      const [w, h] = SIZE[kind], images = [], areas = [];
      for (const pose of ['idle', 'walk0', 'walk1', 'walk2', 'walk3']) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 160;
        const g = cv.getContext('2d'); g.scale(4, 4);
        drawCreature(g, kind, pose, 20 - w / 2, 28 - h, w, h, 1);
        const d = g.getImageData(0, 0, 160, 160).data; let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
        images.push(cv.toDataURL()); areas.push(n);
      }
      out[kind] = { phases: phasesOf(kind), distinct: new Set(images.slice(1)).size, ratio: Math.max(...areas.slice(1)) / areas[0], low: Math.min(...areas.slice(1)) / areas[0] };
    }
    return out;
  }, SIZE);
  for (const [kind, r] of Object.entries(walk)) {
    expect(r.phases, kind).toBe(4);
    expect(r.distinct, kind).toBe(4);
    expect(r.ratio, kind).toBeLessThan(1.6); expect(r.low, kind).toBeGreaterThan(0.45);
  }
  // Unique relatives differ in silhouette, not just their palette
  for (const [a, b] of [['crawler', 'spider'], ['spore', 'slime'], ['guardian', 'golem']]) {
    expect(shots[a + '/idle'].image).not.toBe(shots[b + '/idle'].image);
    expect(shots[a + '/idle'].count).not.toBe(shots[b + '/idle'].count);
  }
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

test('items, chests and interface icons are painted, smooth and cover their square', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { itemArtReady, paintedIcon, drawPainted } = await import('/src/itemart.js');
    const { ITEM, itemIcon, padIcon, toolIcon } = await import('/src/sprites.js');
    const { creatureIcon } = await import('/src/creatureart.js');
    const filled = c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0, soft = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] > 128) n++; if (d[i] > 0 && d[i] < 255) soft++; }
      return { share: n / (c.width * c.height), soft };
    };
    const items = Object.keys(ITEM).map(t => ({ t, painted: !!itemIcon(t).painted, ...filled(itemIcon(t)) }));
    const ui = ['dig', 'jump', 'throw', 'act', 'crew', 'quest', 'crystal', 'trophy', 'gear', 'stairs', 'rod', 'hook', 'bag', 'hammer', 'castle', 'chest', 'lamp', 'sword', 'bow', 'arrow', 'farrow', 'shield', 'helm', 'rails', 'balloon']
      .map(t => ({ t, painted: !!toolIcon(t).painted, url: padIcon(t).length, ...filled(toolIcon(t)) }));
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const world = ['chest', 'chestOpen', 'hoard'].map(t => { const g = cv.getContext('2d'); g.clearRect(0, 0, 64, 64); return drawPainted(g, t, 8, 8, 48, 48) && filled(cv).share; });
    const props = ['merchant', 'merchantA', 'merchantB', 'tomb', 'shrine', 'mast', 'gondola', 'drillwagon'].every(t => paintedIcon('prop:' + t));
    return { ready: await itemArtReady, props, items, ui, world, distinct: new Set([...items, ...ui].map(i => paintedIcon(i.t)?.toDataURL() || i.t)).size, mount: filled(creatureIcon('fluffel')).share };
  });
  expect(result.ready).toBe(true);
  expect(result.props).toBe(true);
  for (const i of [...result.items, ...result.ui]) {
    expect(i.painted, i.t).toBe(true);
    expect(i.share, i.t).toBeGreaterThan(0.12);
    expect(i.soft, i.t).toBeGreaterThan(20);
  }
  for (const share of result.world) expect(share).toBeGreaterThan(0.2);
  expect(result.distinct).toBeGreaterThan(40);
  expect(result.mount).toBeGreaterThan(0.2);
});
