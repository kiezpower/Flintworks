// The lava queen (queen.js): deep down near a lava lake she rises once per world in free play,
// throws lava bombs, calls lava slimes, lava does her no harm; beaten she leaves gold and gems and
// does not come again; never in the relaxed setting: npm test
import { expect, test } from '@playwright/test';

async function deep(page, profile = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(p => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', ...p }));
  }, profile);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  // a cave deep down with a lava lake in its floor, the player's Wühler standing next to it
  await page.evaluate(() => {
    const w = window.__ww,
      { mat, bg, W, surf, paint, activate, AIR, ROCK, LAVA } = w.world,
      x0 = w.G.base.x + 220,
      y0 = surf[x0] + 150;
    const set = (x, y, m) => {
      mat[y * W + x] = m;
      bg[y * W + x] = m === AIR ? 1 : 0;
      paint(y * W + x);
    };
    for (let y = y0 - 30; y < y0 + 12; y++) for (let x = x0 - 4; x < x0 + 104; x++) set(x, y, ROCK);
    for (let y = y0 - 28; y < y0; y++) for (let x = x0; x < x0 + 100; x++) set(x, y, AIR);
    for (let y = y0; y < y0 + 8; y++) for (let x = x0 + 50; x < x0 + 90; x++) set(x, y, LAVA);
    for (let x = x0; x < x0 + 100; x += 6) activate(x, y0);
    // (only the player, and no helpers wandering in)
    for (const c of [...w.crew]) if (c.pid !== w.G.myId) w.crew.splice(w.crew.indexOf(c), 1);
    w.animals.length = 0;
    const me = w.crew[0];
    Object.assign(me, { x: x0 + 10, y: y0 - 10, vx: 0, vy: 0, energy: 100 });
    window.__cave = { x0, y0 };
  });
  return errors;
}

test('deep down by a lava lake the lava queen rises, throws, calls slimes and is beaten once', async ({ page }) => {
  const errors = await deep(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G,
      { queenOf, queenTick } = await import('/src/queen.js');
    const me = w.crew[0];
    // not in the first minutes
    G.playTicks = 60;
    queenTick();
    const early = !!queenOf();
    G.playTicks = 9 * 3600;
    queenTick();
    const q = queenOf();
    if (!q) return { early, risen: false };
    const out = { early, risen: true, overLava: q.y + q.h <= window.__cave.y0 + 1 };
    // she lives in lava, throws at the Wühler and calls slimes (the Wühler kept alive and in place)
    const hp0 = q.hp;
    for (let k = 0; k < 700; k++) {
      Object.assign(me, { x: window.__cave.x0 + 10, y: window.__cave.y0 - 10, vx: 0, vy: 0, energy: 100, burn: 0 });
      w.step(1);
    }
    out.throws = q.throws;
    out.slimes = w.animals.filter(a => a.kind === 'slime').length;
    out.unhurt = q.hp >= hp0;
    // beaten: gold and gems, a banner, and she does not come again
    q.hp = 0;
    w.step(2);
    out.gone = !queenOf();
    out.gems = w.items.filter(it => it.t === 'gem').length;
    out.nugs = w.items.filter(it => it.t === 'nug').length;
    queenTick();
    out.again = !!queenOf();
    out.done = G.queenDone;
    return out;
  });
  expect(r).toMatchObject({ early: false, risen: true, overLava: true, unhurt: true, gone: true, again: false, done: true });
  expect(r.throws).toBeGreaterThanOrEqual(3);
  expect(r.slimes).toBeGreaterThanOrEqual(1);
  expect(r.gems).toBeGreaterThanOrEqual(4);
  expect(r.nugs).toBeGreaterThanOrEqual(12);
  await expect(page.locator('body')).toContainText('Lavakönigin besiegt!');
  expect(errors).toEqual([]);
});

test('in the relaxed setting the lava queen stays asleep', async ({ page }) => {
  const errors = await deep(page, { diff: 'relaxed' });
  const risen = await page.evaluate(async () => {
    const { queenOf, queenTick } = await import('/src/queen.js');
    window.__ww.G.playTicks = 9 * 3600;
    queenTick();
    return !!queenOf();
  });
  expect(risen).toBe(false);
  expect(errors).toEqual([]);
});
