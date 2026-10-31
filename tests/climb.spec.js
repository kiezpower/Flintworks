// Getting out of a pit (climb.js): in the modern controls the Wühler digs a ramp up through an
// earth wall by himself; where that does not work the action button offers the grappling hook,
// stairs up to the ledge or the way home: npm test
import { expect, test } from '@playwright/test';

async function field(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done' }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  await page.evaluate(() => {
    const w = window.__ww;
    w.crew.splice(1);
    w.animals.length = 0;
    w.G.autoDig = true;
    w.G.tools = {};
    w.G.store = {};
    // (no treasure chest next to the pit: the action would open it)
    w.G.chests = [];
  });
  return errors;
}

// a pit below the surface: walls and floor of the material, a cave of air above the rim; the
// Wühler stands on the floor at x; returns the rim (the top of the ledges)
const PIT = ([name, x]) => {
  const w = window.__ww,
    { mat, W, AIR, paint, surf } = w.world,
    M = w.world[name],
    c = w.crew[0];
  const X0 = 380,
    X1 = 720,
    L = 450,
    R = 510,
    rim = surf[X0] + 70,
    floor = rim + 46;
  for (let xx = X0; xx < X1; xx++)
    for (let y = rim - 40; y < floor + 20; y++) {
      const air = (y >= rim - 30 && y < rim) || (y >= rim && y < floor && xx >= L && xx < R);
      mat[y * W + xx] = air ? AIR : M;
      paint(y * W + xx);
    }
  w.items.length = 0;
  Object.assign(c, { x, y: floor - 10, vx: 0, vy: 0, face: 1, inv: [], energy: 100, bridge: null, hook: null });
  w.step(5);
  return rim;
};
const label = page => page.evaluate(() => window.__ww.context(window.__ww.crew[0]).label);
const act = page =>
  page.evaluate(() => {
    const w = window.__ww;
    w.context(w.crew[0]).fn();
  });
// walk to the right for up to n frames, until the Wühler is at the height of the rim, then a few
// steps on (onto the ledge: the field ends further on, then the world's own ground); the feet
const walk = (page, n, rim) =>
  page.evaluate(
    ([n, rim]) => {
      const w = window.__ww,
        c = w.crew[0];
      w.keys.r = 1;
      for (let i = 0; i < n && c.y + 10 > rim + 2; i++) w.step(1);
      w.step(30);
      w.keys.r = 0;
      w.step(5);
      return c.y + 10;
    },
    [n, rim],
  );

test('in an earth pit, walking into the wall digs a ramp up and out', async ({ page }) => {
  const errors = await field(page);
  const rim = await page.evaluate(PIT, ['EARTH', 500]);
  // an earth wall the Wühler can dig: no action needed, so no stairs or home offered
  expect(await label(page)).not.toMatch(/Treppe|Heim|Haken/);
  const feet = await walk(page, 520, rim);
  expect(feet).toBeLessThanOrEqual(rim + 2);
  expect(errors).toEqual([]);
});

test('in a rock pit with wood the action builds stairs up to the ledge', async ({ page }) => {
  const errors = await field(page);
  // (in the middle of the pit: the stairs to the nearer ledge are steep but can be walked)
  const rim = await page.evaluate(PIT, ['ROCK', 476]);
  await page.evaluate(() => (window.__ww.G.store = { wood: 2 }));
  expect(await label(page)).toBe('Treppe');
  await act(page);
  await page.evaluate(() => window.__ww.step(200));
  expect(await page.evaluate(() => window.__ww.G.store.wood)).toBe(1);
  const feet = await walk(page, 300, rim);
  expect(feet).toBeLessThanOrEqual(rim + 2);
  expect(errors).toEqual([]);
});

test('in a rock pit without wood the action takes the Wühler home', async ({ page }) => {
  const errors = await field(page);
  await page.evaluate(PIT, ['ROCK', 480]);
  expect(await label(page)).toBe('Heim');
  await act(page);
  const home = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    return Math.abs(c.x - (w.base.x + 10)) < 2 && Math.abs(c.y - (w.base.gy - 10)) < 2;
  });
  expect(home).toBe(true);
  expect(errors).toEqual([]);
});

// the hook's button: shown once bought (#btns.hookon), dimmed without a ledge in reach (nohook)
const hookBtn = page =>
  page.evaluate(() => {
    const w = window.__ww,
      b = document.getElementById('btns');
    w.hud();
    return { on: b.classList.contains('hookon'), dim: b.classList.contains('nohook') };
  });
// fire the hook like its button does, then let it fly and pull
const hook = page =>
  page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    w.send('hook');
    w.step(5);
    const flying = !!c.hook;
    w.step(80);
    return { flying, done: !c.hook, feet: c.y + 10 };
  });

test('the grappling hook is bought at the base, gets its own button and pulls onto the ledge', async ({ page }) => {
  const errors = await field(page);
  expect((await hookBtn(page)).on).toBe(false);
  // bought in the base panel like every tool
  await page.evaluate(() => {
    const w = window.__ww;
    w.money = 100;
    w.G.store = { wood: 2, rock: 1 };
    w.send('tool', { id: 'hook' });
  });
  expect(await page.evaluate(() => [!!window.__ww.G.tools.hook, window.__ww.money])).toEqual([true, 70]);
  const rim = await page.evaluate(PIT, ['ROCK', 480]);
  expect(await hookBtn(page)).toEqual({ on: true, dim: false });
  // the action button keeps to stairs and home: the hook has its own
  expect(await label(page)).toBe('Heim');
  const r = await hook(page);
  expect(r.flying).toBe(true);
  expect(r.done).toBe(true);
  expect(r.feet).toBeLessThanOrEqual(rim + 1);
  expect(errors).toEqual([]);
});

test('the hook also takes a low ledge, and says so when there is none in reach', async ({ page }) => {
  const errors = await field(page);
  await page.evaluate(() => (window.__ww.G.tools = { hook: true }));
  // open ground with a rock step of 12 px a little to the right
  const top = await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, AIR, ROCK, paint, surf } = w.world,
      c = w.crew[0],
      // (the field stays inside the world even where the surface is high)
      gy = Math.max(110, surf[400] - 20);
    // (wider than the hook reaches, so the world's own ground beyond plays no part)
    for (let x = 360; x < 720; x++)
      for (let y = gy - 90; y < gy + 20; y++) {
        mat[y * W + x] = y >= gy || (x >= 480 && y >= gy - 12) ? ROCK : AIR;
        paint(y * W + x);
      }
    Object.assign(c, { x: 450, y: gy - 10, vx: 0, vy: 0, face: 1, inv: [], hook: null });
    w.step(5);
    return gy - 12;
  });
  expect((await hookBtn(page)).dim).toBe(false);
  const r = await hook(page);
  expect(r.done).toBe(true);
  expect(r.feet).toBeLessThanOrEqual(top + 1);
  // up there nothing higher is in reach: the button is dimmed and a tap says why
  await page.evaluate(() => {
    const c = window.__ww.crew[0];
    c.x = 560;
    window.__ww.step(5);
  });
  expect((await hookBtn(page)).dim).toBe(true);
  await page.evaluate(() => window.__ww.send('hook'));
  await expect(page.locator('#toast')).toHaveText('Keine Kante in Reichweite');
  expect(errors).toEqual([]);
});

test('on the surface and in a tunnel walking into earth still digs straight', async ({ page }) => {
  await field(page);
  // an earth wall at the surface (no pit around): a tunnel straight in, no ramp
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, AIR, EARTH, paint, surf } = w.world,
      c = w.crew[0],
      gy = surf[400];
    for (let x = 380; x < 560; x++)
      for (let y = gy - 60; y < gy + 20; y++) {
        mat[y * W + x] = y < gy && x < 460 ? AIR : EARTH;
        paint(y * W + x);
      }
    Object.assign(c, { x: 452, y: gy - 10, vx: 0, vy: 0, face: 1, inv: [] });
    w.step(5);
    const y0 = c.y;
    w.keys.r = 1;
    for (let i = 0; i < 160; i++) w.step(1);
    w.keys.r = 0;
    return { dx: c.x - 452, dy: c.y - y0 };
  });
  expect(r.dx).toBeGreaterThan(20);
  expect(Math.abs(r.dy)).toBeLessThan(4);
});
