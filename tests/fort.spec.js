// The fortress (fort.js): a wall stops monsters and takes the blows, a wall, a gate and a wall
// stand right against each other, the cannon tower fires with coal from the store, a broken wall
// is gone, and a Wühler next to a damaged wall mends it: npm test
import { expect, test } from '@playwright/test';

async function field(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() =>
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow' }),
    ),
  );
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  // build a piece where the player stands (finished at once), on flat ground right of the castle
  await page.evaluate(() => {
    const w = window.__ww,
      { surf } = w.world,
      me = w.crew.find(c => c.pid === w.G.myId);
    for (const c of w.crew) if (c !== me) c.x = 40;
    let x = w.G.base.x + 80;
    while (Math.abs(surf[x] - surf[x + 40]) > 2 && x < 900) x++;
    window.__fx = x;
    window.__put = (type, at) => {
      Object.assign(me, { x: at, y: surf[at + 3] - 10, vx: 0, vy: 0, tumble: false });
      w.step(6);
      w.G.store = { rock: 40, metal: 10, plank: 10, coal: (w.G.store && w.G.store.coal) || 0 };
      me.inv = ['rock', 'rock', 'rock', 'rock', 'rock', 'plank', 'plank', 'metal', 'metal'];
      const n = w.builds.length;
      w.send('build', { type });
      const b = w.builds[n];
      if (!b) return null;
      b.prog = 1e9;
      w.step(3);
      return b.x;
    };
    window.__me = me;
  });
  return errors;
}

test('a wall stops a monster, which strikes it; nobody stays stuck inside a new wall', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { surf } = w.world,
      me = window.__me,
      x = window.__fx;
    window.__put('wall', x);
    const wall = w.builds.find(b => b.type === 'wall');
    const out = { done: wall.done, meOut: me.x + 6 <= wall.x || me.x >= wall.x + wall.w };
    // the player left of the wall, a monster right of it, walking at the player
    Object.assign(me, { x: wall.x - 20, y: surf[wall.x - 18] - 10 });
    const m = w.mkAnimal('monster', wall.x + 30, surf[wall.x + 30] - 10);
    w.animals.push(m);
    let minX = 1e9;
    for (let k = 0; k < 900; k++) {
      w.step(1);
      minX = Math.min(minX, m.x);
      me.vx = 0;
    }
    out.passed = minX < wall.x + wall.w;
    out.hp = wall.fhp;
    return out;
  });
  expect(r.done).toBe(true);
  expect(r.meOut).toBe(true);
  expect(r.passed).toBe(false);
  expect(r.hp).toBeLessThan(400);
  expect(errors).toEqual([]);
});

test('wall, gate and wall side by side; the cannon tower fires with coal and hits', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { surf } = w.world,
      me = window.__me,
      x = window.__fx;
    const xs = [window.__put('wall', x), window.__put('gate', x + 8), window.__put('wall', x + 16), window.__put('cannon', x - 30)];
    w.G.store.coal = 2;
    Object.assign(me, { x: x - 50, y: surf[x - 48] - 10 });
    const ms = [0, 1, 2].map(k => {
      const m = w.mkAnimal('monster', x + 60 + k * 25, surf[x + 60 + k * 25] - 10);
      w.animals.push(m);
      return m;
    });
    let minX = 1e9;
    for (let k = 0; k < 1500; k++) {
      w.step(1);
      for (const m of ms) if (w.animals.includes(m)) minX = Math.min(minX, m.x);
      me.vx = 0;
    }
    const right = w.builds.filter(b => b.type === 'wall').sort((a, b) => b.x - a.x)[0];
    return {
      xs,
      passed: minX < right.x + right.w - 0.5,
      coal: w.G.store.coal,
      hurt: ms.filter(m => !w.animals.includes(m) || m.hp < m.maxHp).length,
    };
  });
  // all four stand, the wall pieces and the gate without a gap
  expect(r.xs.every(v => v != null)).toBe(true);
  expect(r.xs[1] - r.xs[0]).toBe(8);
  expect(r.xs[2] - r.xs[1]).toBe(8);
  expect(r.passed).toBe(false);
  expect(r.coal).toBe(0);
  expect(r.hurt).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a broken wall is gone; a Wühler next to a damaged one mends it', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      x = window.__fx,
      { hitFort } = await import('/src/fort.js');
    window.__put('wall', x);
    window.__put('wall', x + 40);
    const [a, b] = w.builds.filter(q => q.type === 'wall');
    hitFort(a, 999, a.x, a.gy - 4);
    hitFort(b, 100, b.x, b.gy - 4);
    const gone = !w.builds.includes(a);
    // the player stands next to the damaged one; once the fighting has stopped it is mended
    const me = window.__me;
    Object.assign(me, { x: b.x - 7, y: b.gy - 10, vx: 0, vy: 0 });
    for (let k = 0; k < 900; k++) {
      w.step(1);
      me.vx = 0;
    }
    return { gone, hp: b.fhp };
  });
  expect(r.gone).toBe(true);
  expect(r.hp).toBe(400);
  expect(errors).toEqual([]);
});
