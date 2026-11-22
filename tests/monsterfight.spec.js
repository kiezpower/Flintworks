// Fights with monsters stay fair: a strike pushes the Wühler away without knocking it down, a short
// grace follows (no touching, no next strike), the monster backs off, and every kind can be
// outrun: npm test
import { expect, test } from '@playwright/test';

async function setup(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#veilGo');
  await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, AIR, EARTH, paint } = w.world;
    w.endTutorial();
    // flat field x 200..900, ground at y 200
    for (let x = 200; x < 900; x++)
      for (let y = 0; y < 230; y++) {
        mat[y * W + x] = y < 200 ? AIR : EARTH;
        paint(y * W + x);
      }
    w.crew.splice(1);
    w.animals.length = 0;
    w.trees.length = 0;
    w.vehicles.length = 0;
    w.items.length = 0;
  });
  return errors;
}

test('a monster strike pushes the Wühler away without stunning it, then a short grace follows', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    Object.assign(c, { x: 450, y: 190, vx: 0, vy: 0, energy: 100, tumble: false, dead: false, safeT: 0 });
    const m = w.mkAnimal('monster', 0, 0);
    Object.assign(m, { x: c.x + 3 - m.w / 2, y: 200 - m.h });
    w.animals.push(m);
    w.step(2);
    const out = { tumble: c.tumble, grace: c.safeT > 0, hit: 100 - c.energy, back: m.back > 0 };
    // standing still in the monster: no more damage during the grace
    const e = c.energy;
    w.step(30);
    out.during = e - c.energy;
    return out;
  });
  expect(r.tumble).toBe(false);
  expect(r.grace).toBe(true);
  expect(r.back).toBe(true);
  expect(r.hit).toBeGreaterThanOrEqual(10);
  expect(r.during).toBe(0);
  expect(errors).toEqual([]);
});

test('every walking monster can be outrun', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      out = {};
    for (const kind of ['monster', 'spider', 'crawler', 'golem']) {
      w.animals.length = 0;
      Object.assign(c, { x: 500, y: 190, vx: 0, vy: 0, energy: 100, tumble: false, dead: false, safeT: 0, face: 1 });
      const m = w.mkAnimal(kind, 0, 0);
      Object.assign(m, { x: 470, y: 200 - m.h });
      w.animals.push(m);
      w.step(5);
      const gap0 = c.x - m.x;
      w.keys.r = 1;
      w.step(240);
      w.keys.r = 0;
      out[kind] = Math.round(c.x - m.x - gap0);
    }
    return out;
  });
  for (const k of Object.keys(r)) expect(r[k], k).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});
