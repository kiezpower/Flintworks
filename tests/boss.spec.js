// The giant worm (boss.js): it comes up from deep down towards the Wühler, bores tunnels, its
// body follows, it hurts whom it touches, blasts hurt it, beaten it leaves gold and gems; in free
// play it comes by itself after ten minutes, once per world: npm test
import { expect, test } from '@playwright/test';

async function field(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow' }),
    );
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  return errors;
}

test('the worm bores up to the Wühler, its body follows, it strikes, blasts hurt it, its loot', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      { mat, W, H, AIR } = w.world,
      { spawnWorm } = await import('/src/boss.js'),
      { explode } = await import('/src/objects.js');
    const me = w.crew.find(c => c.pid === w.G.myId);
    const a = spawnWorm();
    const air0 = mat.reduce((n, m, i) => n + (m === AIR && i > W * 150 ? 1 : 0), 0);
    const d0 = Math.hypot(a.seg[0].x - me.x, a.seg[0].y - me.y);
    let dMin = d0,
      hurt = false;
    for (let k = 0; k < 3000; k++) {
      me.energy = Math.max(me.energy, 60);
      const e0 = me.energy;
      w.step(1);
      if (me.energy < e0 - 5) hurt = true;
      dMin = Math.min(dMin, Math.hypot(a.seg[0].x - me.x, a.seg[0].y - me.y));
      if (hurt && dMin < 20) break;
    }
    const air1 = mat.reduce((n, m, i) => n + (m === AIR && i > W * 150 ? 1 : 0), 0);
    // the body stays in one piece
    const gaps = a.seg.slice(1).map((q, k) => Math.hypot(q.x - a.seg[k].x, q.y - a.seg[k].y));
    // blasts at the head until it is beaten
    const hp0 = a.hp;
    const nugs0 = w.items.filter(i => i.t === 'nug').length;
    let blasts = 0;
    while (w.animals.includes(a) && blasts < 60) {
      explode(a.seg[0].x, a.seg[0].y, 6);
      blasts++;
      w.step(2);
    }
    for (let k = 0; k < 5; k++) w.step(1);
    return {
      tunnels: air1 - air0,
      closer: dMin < d0 / 3,
      hurt,
      maxGap: Math.max(...gaps),
      hurtByBlast: hp0 > 0 && (!w.animals.includes(a) || a.hp < hp0),
      beaten: !w.animals.includes(a),
      loot: w.items.filter(i => i.t === 'nug').length - nugs0,
      gems: w.items.filter(i => i.t === 'gem').length,
    };
  });
  expect(r.tunnels).toBeGreaterThan(300);
  expect(r.closer).toBe(true);
  expect(r.hurt).toBe(true);
  expect(r.maxGap).toBeLessThan(6);
  expect(r.hurtByBlast).toBe(true);
  expect(r.beaten).toBe(true);
  expect(r.loot).toBeGreaterThanOrEqual(10);
  expect(r.gems).toBeGreaterThanOrEqual(3);
  await expect(page.locator('body')).toContainText('Riesenwurm besiegt');
  expect(errors).toEqual([]);
});

test('in free play it comes by itself after ten minutes, once per world', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(() => {
    const w = window.__ww;
    w.G.playTicks = 10 * 3600 + 10;
    let first = -1;
    for (let k = 0; k < 9000 && first < 0; k++) {
      w.step(1);
      if (w.animals.some(a => a.kind === 'worm')) first = k;
    }
    // beaten (taken away here): it does not come again
    for (const a of w.animals) if (a.kind === 'worm') a.hp = 0;
    for (let k = 0; k < 6000; k++) w.step(1);
    return { came: first >= 0, again: w.animals.some(a => a.kind === 'worm'), done: w.G.wormDone };
  });
  expect(r).toEqual({ came: true, again: false, done: true });
  expect(errors).toEqual([]);
});
