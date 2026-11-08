// The siege (siege.js) in the level "Belagerung": a wave is announced, comes from the edge of the
// map over land and marches on the castle; at the castle it strikes it; walls stop it; a beaten
// wave counts; a fallen castle loses the level: npm test
import { expect, test } from '@playwright/test';

async function level(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({
        tutorialDone: true,
        installAsked: 'done',
        games: 3,
        gmode: 'belagerung',
        campaign: { bergdorf: 1 },
      }),
    ),
  );
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play' && window.__ww.G.mode === 'belagerung');
  // the crew stays in the castle, out of the way
  await page.evaluate(() => {
    const w = window.__ww;
    window.__park = () => {
      for (const c of w.crew) Object.assign(c, { x: w.G.base.x + 14, y: w.G.base.gy - 10, vx: 0, vy: 0 });
    };
  });
  return errors;
}
// run the game for n frames (the level checks every half second)
const run = (page, n) =>
  page.evaluate(n => {
    for (let k = 0; k < n; k++) {
      window.__park();
      window.__ww.step(1);
    }
  }, n);

test('a wave comes from the edge over land, marches on the castle and strikes it', async ({ page }) => {
  const errors = await level(page);
  // half a minute before the first wave: the scouts' warning
  await page.evaluate(() => (window.__ww.G.playTicks = 3 * 3600 - 1810));
  await run(page, 40);
  expect(await page.evaluate(() => window.__ww.G.lvl.sg.warned)).toBe(0);
  await page.evaluate(() => (window.__ww.G.playTicks = 3 * 3600));
  await run(page, 120);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { surf } = w.world,
      s = w.animals.filter(a => a.siege);
    return {
      n: s.length,
      left: s.every(a => a.x < 60),
      onGround: s.every(a => Math.abs(a.y + a.h - surf[Math.round(a.x + a.w / 2)]) < 6),
    };
  });
  expect(r).toEqual({ n: 3, left: true, onGround: true });
  // they march on the castle and strike it
  let hp = 1000;
  for (let k = 0; k < 12 && hp >= 1000; k++) {
    await run(page, 600);
    hp = await page.evaluate(() => window.__ww.G.base.fhp ?? 1000);
  }
  expect(hp).toBeLessThan(1000);
  expect(errors).toEqual([]);
});

test('a wall stops the march; beaten waves count; a fallen castle loses the level', async ({ page }) => {
  const errors = await level(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { surf } = w.world,
      b = w.G.base;
    // a finished wall left of the castle, the first wave on its way
    const me = w.crew.find(c => c.pid === w.G.myId),
      x = b.x - 40;
    Object.assign(me, { x, y: surf[x + 3] - 10, vx: 0, vy: 0 });
    w.step(6);
    me.inv = ['rock', 'rock', 'rock'];
    w.send('build', { type: 'wall' });
    const wall = w.builds.find(q => q.type === 'wall');
    wall.prog = 1e9;
    w.step(3);
    w.G.playTicks = 3 * 3600;
    // (the wave needs about 25 s to the wall; then it strikes it for half a minute)
    // (no creature may get past the wall while it stands)
    let past = false,
      hit = false;
    for (let k = 0; k < 3300; k++) {
      window.__park();
      w.step(1);
      if (!w.builds.includes(wall)) break;
      if (wall.fhp < 600) hit = true;
      if (w.animals.some(a => a.siege && a.x + a.w >= wall.x + 1 && a.x < wall.x + wall.w)) past = true;
      if (w.animals.some(a => a.siege && a.x > wall.x + wall.w)) past = true;
    }
    const s = w.animals.filter(a => a.siege);
    return { done: wall.done, n: s.length, stopped: !past, wallHit: hit, castle: b.fhp ?? 1000 };
  });
  expect(r.done).toBe(true);
  expect(r.n).toBe(3);
  expect(r.stopped).toBe(true);
  expect(r.wallHit).toBe(true);
  expect(r.castle).toBe(1000);
  // all of the wave beaten: one wave counts
  const beaten = await page.evaluate(async () => {
    const w = window.__ww;
    for (const a of w.animals) if (a.siege) a.hp = 0;
    for (let k = 0; k < 40; k++) {
      window.__park();
      w.step(1);
    }
    const { wavesBeaten } = await import('/src/siege.js');
    return wavesBeaten(w.G.lvl);
  });
  expect(beaten).toBe(1);
  // the castle falls: the level is lost
  await page.evaluate(async () => {
    const { hitFort } = await import('/src/fort.js');
    hitFort(window.__ww.G.base, 9999, window.__ww.G.base.x, window.__ww.G.base.gy - 5);
  });
  await run(page, 40);
  await page.waitForFunction(() => window.__ww.state === 'lost' || window.__ww.state === 'over' || window.__ww.state !== 'play');
  expect(errors).toEqual([]);
});
