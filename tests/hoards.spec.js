// Treasure maps (hoards.js): free worlds hide two great hoards deep down; the first chest opened
// holds a map to one (red cross on the map, a red arrow at the edge), and the hoard opens with the
// action button into a heap of gold and gems: npm test
import { expect, test } from '@playwright/test';

test('the first chest holds a treasure map; the hoard it shows opens into gold and gems', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', diff: 'relaxed' }),
    );
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const { mat, W, AIR, surf } = await import('/src/world.js');
    const { openChest } = await import('/src/treasure.js');
    const { P } = await import('/src/profile.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    const H = G.hoards;
    const out = {
      n: H.length,
      deep: H.every(h => h.y > surf[h.x] + 140),
      hall: H.every(h => mat[(h.y - 4) * W + h.x] === AIR),
      unknown: H.every(h => !h.known),
    };
    // the first chest: a map
    const ch = G.chests.find(c => !c.open);
    openChest(ch);
    const known = H.filter(h => h.known);
    out.known = known.length;
    out.news = document.body.textContent.includes('Schatzkarte');
    // to the hoard
    const h = known[0];
    Object.assign(me, { x: h.x - 3, y: h.y - 10, vx: 0, vy: 0 });
    w.step(5);
    const items0 = w.items.length;
    const cx = w.context(me);
    out.label = cx.label;
    cx.fn();
    out.open = h.open;
    out.loot = w.items.length - items0;
    out.ach = !!P.ach.hoard;
    return out;
  });
  expect(r).toMatchObject({ n: 2, deep: true, hall: true, unknown: true, known: 1, news: true, label: 'Öffnen', open: true, ach: true });
  expect(r.loot).toBeGreaterThanOrEqual(10);
  expect(errors).toEqual([]);
});
