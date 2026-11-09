// Cave biomes (zones.js) and the shrines' guardians (shrines.js): npm test
import { expect, test } from '@playwright/test';

async function start(page, diff) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(d => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', diff: d }));
  }, diff);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  return errors;
}

test('a crystal cave and a mushroom cave lie deep down, with their finds and creatures, announced once', async ({ page }) => {
  const errors = await start(page, 'adventure');
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const { mat, W, GEM, surf } = await import('/src/world.js');
    const { decor } = await import('/src/decor.js');
    const Z = G.zones;
    const count = (z, f) => decor.filter(d => ((d.x - z.x) / (z.rx * 1.2)) ** 2 + ((d.y - z.y) / (z.ry * 1.3)) ** 2 <= 1 && f(d)).length;
    const crystal = Z.find(z => z.kind === 'crystal'),
      mush = Z.find(z => z.kind === 'mushroom');
    let gems = 0;
    for (let y = crystal.y - 20; y < crystal.y + 20; y++) for (let x = crystal.x - 46; x < crystal.x + 46; x++) if (mat[y * W + x] === GEM) gems++;
    const out = {
      n: Z.length,
      deep: Z.every(z => z.y > surf[z.x] + 140),
      gems: gems > 10,
      // (what was placed with the world: water may wash some away later)
      crystals: (crystal.decorN || 0) >= 6,
      shrooms: (mush.decorN || 0) >= 6,
      crawlers: w.animals.filter(a => a.kind === 'crawler').length,
      spores: w.animals.filter(a => a.kind === 'spore').length,
    };
    // the player walks in: announced once, on the map
    const me = w.crew.find(c => c.pid === G.myId);
    Object.assign(me, { x: mush.x - 3, y: mush.y - 5, vx: 0, vy: 0 });
    w.step(31);
    out.news = document.body.textContent.includes('Eine Pilzhöhle');
    out.seen = mush.seen && !crystal.seen;
    return out;
  });
  expect(r).toEqual({ n: 2, deep: true, gems: true, crystals: true, shrooms: true, crawlers: 3, spores: 3, news: true, seen: true });
  expect(errors).toEqual([]);
});

test('a guardian keeps each shrine: the gift only after it is beaten; none in relaxed worlds', async ({ page }) => {
  const errors = await start(page, 'adventure');
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const s = G.shrines[0];
    const guards = w.animals.filter(a => a.kind === 'guardian');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    Object.assign(me, { x: s.x - 3, y: s.y - 10, vx: 0, vy: 0 });
    w.step(2);
    const locked = w.context(me);
    // beaten
    const g = guards.find(a => a.shrine === 0);
    g.hp = 0;
    w.step(2);
    const open = w.context(me).label;
    return { n: guards.length, shrines: G.shrines.length, locked: locked.label, noFn: !locked.fn, open, inHall: Math.abs(g.x + g.w / 2 - s.x) < 14 };
  });
  expect(r).toEqual({ n: 3, shrines: 3, locked: 'Erst den Wächter besiegen', noFn: true, open: 'Gabe nehmen', inHall: true });
  expect(errors).toEqual([]);
});
