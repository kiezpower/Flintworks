// The ice king (iceking.js): in a winter world, deep down in a cave, he appears once per world in
// free play, throws shards of ice that freeze (slower), calls bats, and is beaten once; never in
// other worlds or the relaxed setting: npm test
import { expect, test } from '@playwright/test';

async function cave(page, { biome = 'winter', diff } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(
    ([biome, diff]) => {
      localStorage.clear();
      localStorage.setItem('flintworks-lang', 'de');
      localStorage.setItem(
        'flintworks-profile',
        JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: biome, ...(diff ? { diff } : {}) }),
      );
    },
    [biome, diff],
  );
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  // a wide cave deep down, the player's Wühler standing in it
  await page.evaluate(() => {
    const w = window.__ww,
      { mat, bg, W, surf, paint, AIR, ROCK } = w.world,
      x0 = w.G.base.x + 220,
      y0 = surf[x0] + 140;
    const set = (x, y, m) => {
      mat[y * W + x] = m;
      bg[y * W + x] = m === AIR ? 1 : 0;
      paint(y * W + x);
    };
    for (let y = y0 - 40; y < y0 + 6; y++) for (let x = x0 - 4; x < x0 + 124; x++) set(x, y, ROCK);
    for (let y = y0 - 38; y < y0; y++) for (let x = x0; x < x0 + 120; x++) set(x, y, AIR);
    for (const c of [...w.crew]) if (c.pid !== w.G.myId) w.crew.splice(w.crew.indexOf(c), 1);
    w.animals.length = 0;
    Object.assign(w.crew[0], { x: x0 + 50, y: y0 - 10, vx: 0, vy: 0, energy: 100 });
    window.__cave = { x0, y0 };
  });
  return errors;
}

test('in a winter world the ice king appears deep down, freezes with his shards, calls bats, is beaten once', async ({ page }) => {
  const errors = await cave(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G,
      { kingOf, kingTick } = await import('/src/iceking.js'),
      me = w.crew[0],
      { x0, y0 } = window.__cave;
    G.playTicks = 60;
    kingTick();
    const early = !!kingOf();
    G.playTicks = 11 * 3600;
    kingTick();
    const k = kingOf();
    if (!k) return { early, risen: false, biome: G.biome };
    const out = { early, risen: true };
    let frozen = false;
    for (let t = 0; t < 600; t++) {
      Object.assign(me, { x: x0 + 50, y: y0 - 10, vx: 0, energy: 100 });
      w.step(1);
      if (me.frost > 0) frozen = true;
    }
    out.frozen = frozen;
    out.throws = k.throws;
    out.bats = w.animals.filter(a => a.kind === 'bat').length;
    // frost makes the Wühler slower
    me.frost = 100;
    const vSlow = (() => {
      const x = me.x;
      w.keys.r = 1;
      w.step(20);
      w.keys.r = 0;
      return me.x - x;
    })();
    me.frost = 0;
    Object.assign(me, { x: x0 + 50, y: y0 - 10, vx: 0 });
    w.step(2);
    const vFast = (() => {
      const x = me.x;
      w.keys.r = 1;
      w.step(20);
      w.keys.r = 0;
      return me.x - x;
    })();
    out.slower = vSlow < vFast * 0.8;
    k.hp = 0;
    w.step(2);
    out.gone = !kingOf();
    out.gems = w.items.filter(it => it.t === 'gem').length;
    kingTick();
    out.again = !!kingOf();
    return out;
  });
  expect(r).toMatchObject({ early: false, risen: true, frozen: true, slower: true, gone: true, again: false });
  expect(r.throws).toBeGreaterThanOrEqual(3);
  expect(r.bats).toBeGreaterThanOrEqual(1);
  expect(r.gems).toBeGreaterThanOrEqual(5);
  await expect(page.locator('body')).toContainText('Eiskönig besiegt!');
  expect(errors).toEqual([]);
});

test('no ice king in a meadow world or in the relaxed setting', async ({ page }) => {
  for (const opt of [{ biome: 'meadow' }, { biome: 'winter', diff: 'relaxed' }]) {
    const errors = await cave(page, opt);
    const risen = await page.evaluate(async () => {
      const { kingOf, kingTick } = await import('/src/iceking.js');
      window.__ww.G.playTicks = 11 * 3600;
      kingTick();
      return !!kingOf();
    });
    expect(risen, JSON.stringify(opt)).toBe(false);
    expect(errors).toEqual([]);
  }
});
