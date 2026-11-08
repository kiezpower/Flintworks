// The lorry can be pushed up wooden stairs and up a hillside, and rolls back down: npm test
import { expect, test } from '@playwright/test';

test('a lorry is pushed up stairs and up a hill', async ({ page }) => {
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
  await page.evaluate(() => window.__ww.endTutorial());
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, AIR, EARTH, paint } = w.world,
      c = w.crew[0];
    const X0 = 400,
      X1 = 700,
      gy = 200;
    // ground(x): flat, then a hill rising in steps of 3 px every 2 px (as steep as the
    // Wühler walks), then flat again
    const field = (ground, m = EARTH) => {
      for (let x = X0; x < X1; x++)
        for (let y = 0; y < gy + 20; y++) {
          mat[y * W + x] = y < ground(x) ? AIR : y < gy ? m : EARTH;
          paint(y * W + x);
        }
    };
    w.crew.splice(1);
    w.animals.length = 0;
    w.lorries.length = 0;
    const L = { id: 9999, x: 0, y: 0, w: 12, h: 7, vx: 0, vy: 0, items: [] };
    w.lorries.push(L);
    const setup = () => {
      c.x = 420;
      c.y = gy - 10;
      c.vx = c.vy = 0;
      c.face = 1;
      L.x = 428;
      L.y = gy - 7;
      L.vx = L.vy = 0;
      w.step(5);
    };
    const out = {};
    // 1) a hill
    field(x => (x < 460 ? gy : x < 520 ? gy - Math.floor((x - 460) / 2) * 3 : gy - 90));
    setup();
    w.keys.r = 1;
    for (let i = 0; i < 400 && L.x < 540; i++) w.step(1);
    w.keys.r = 0;
    out.hillTop = L.x > 525 && L.y + L.h <= gy - 88;
    out.hill = { Lx: L.x, Ly: L.y, cx: c.x, cy: c.y };
    // 2) wooden stairs on flat ground
    field(() => gy);
    c.x = 470;
    c.y = gy - 10;
    c.vx = c.vy = 0;
    c.face = 1;
    w.lorries.length = 0;
    w.step(5);
    c.inv = ['plank'];
    w.send('stairs');
    w.step(160);
    w.lorries.push(L);
    let x1 = 0;
    for (let x = X0; x < X1; x++) for (let y = 0; y < gy; y++) if (mat[y * W + x] === w.world.PLANK) x1 = Math.max(x1, x);
    const top = gy - Math.min(...[...Array(gy).keys()].filter(y => mat[y * W + x1] === w.world.PLANK));
    setup();
    w.keys.r = 1;
    for (let i = 0; i < 500 && L.x < x1 - 14; i++) w.step(1);
    w.keys.r = 0;
    out.stairsUp = gy - (L.y + L.h) >= top - 6;
    out.dbg = { top, Lx: L.x, Ly: L.y, x1, cx: c.x, cy: c.y };
    // ... and from the other side it passes under the stair's high end, as the Wühler do
    c.x = x1 + 30;
    c.y = gy - 10;
    c.vx = c.vy = 0;
    c.face = -1;
    L.x = x1 + 16;
    L.y = gy - 7;
    L.vx = L.vy = 0;
    w.step(5);
    w.keys.l = 1;
    let xs = X1;
    for (let x = X0; x < X1; x++) for (let y = 0; y < gy; y++) if (mat[y * W + x] === w.world.PLANK) xs = Math.min(xs, x);
    for (let i = 0; i < 400 && L.x > xs - 16; i++) w.step(1);
    w.keys.l = 0;
    out.under = L.x <= xs - 16;
    out.underDbg = { xs, x1, Lx: L.x, Ly: L.y, cx: c.x };
    // 3) the steep stairs the action builds up to a ledge, and on over the ledge
    const LH = 30;
    field(x => (x < 500 ? gy : gy - LH), w.world.ROCK); // (rock: no ramp dug instead)
    w.lorries.length = 0;
    c.x = 470;
    c.y = gy - 10;
    c.vx = c.vy = 0;
    c.face = 1;
    w.step(5);
    c.inv = ['plank'];
    const act = w.climb.climbContext(c);
    out.stairAct = act && act.label;
    if (act) act.fn();
    w.step(300);
    w.lorries.push(L);
    setup();
    w.keys.r = 1;
    for (let i = 0; i < 600 && L.x < 520; i++) w.step(1);
    w.keys.r = 0;
    out.ledge = L.x >= 520 && L.y + L.h <= gy - LH + 1;
    out.ledgeDbg = { Lx: L.x, Ly: L.y, cx: c.x, cy: c.y };
    return out;
  });
  expect(r.hillTop, JSON.stringify(r.hill)).toBe(true);
  expect(r.stairsUp, JSON.stringify(r.dbg)).toBe(true);
  expect(r.under, JSON.stringify(r.underDbg)).toBe(true);
  expect(r.stairAct).toBe('Treppe');
  expect(r.ledge, JSON.stringify(r.ledgeDbg)).toBe(true);
  expect(errors).toEqual([]);
});
