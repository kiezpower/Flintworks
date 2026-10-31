// Digging through each material straight, slanted down and slanted up: the Wühler never gets
// stuck, each material has its own pace and the loot lands next to the one digging: npm test
import { expect, test } from '@playwright/test';

async function field(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#veilGo'); // a fresh player starts in the tutorial world
  // (only its quiet world: the tutorial's own help, which may carry the Wühler home, is off)
  await page.evaluate(() => window.__ww.endTutorial());
  await page.evaluate(() => {
    const w = window.__ww;
    w.crew.splice(1);
    w.animals.length = 0;
    w.G.autoDig = true;
  });
  return errors;
}

// fills a test field with one material (air above), digs for n frames and reports the way
// made, whether the Wühler got stuck and the items that fell out
const DIG = ([name, dir, n, pick]) => {
  const w = window.__ww,
    { mat, W, AIR, paint } = w.world,
    M = w.world[name],
    c = w.crew[0];
  const X0 = 380,
    X1 = 700,
    gy = 200,
    wall = 440;
  for (let x = X0; x < X1; x++)
    for (let y = 60; y < gy + 60; y++) {
      mat[y * W + x] = y < gy && x < wall ? AIR : M;
      paint(y * W + x);
    }
  // the wall starts at x = wall, the floor at gy (both of the material)
  w.items.length = 0;
  w.G.tools = pick ? { pick: true } : {};
  c.x = wall - 8;
  c.y = gy - 10;
  c.vx = c.vy = 0;
  c.face = 1;
  c.inv = [];
  c.energy = 100;
  w.step(5);
  const x0 = c.x,
    y0 = c.y;
  let stuck = 0,
    digF = 0;
  w.keys.r = 1;
  w.keys.dig = 1;
  if (dir === 'down') w.keys.d = 1;
  if (dir === 'up') w.keys.u = 1;
  for (let i = 0; i < n; i++) {
    const px = c.x,
      py = c.y;
    w.step(1);
    if (c.digging) digF++;
    if (c.x === px && c.y === py) stuck++;
    else stuck = 0;
    if (stuck > 60) break;
  }
  w.keys.r = w.keys.dig = w.keys.d = w.keys.u = 0;
  return {
    dx: +(c.x - x0).toFixed(1),
    dy: +(c.y - y0).toFixed(1),
    stuck: stuck > 60,
    digF,
    items: w.items.map(t => t.t),
  };
};

const MATS = ['SAND', 'EARTH', 'LOAM', 'GOLD', 'COAL', 'ORE', 'GEM'];

test('digging goes on through every material in all three directions', async ({ page }) => {
  const errors = await field(page);
  const out = {};
  for (const m of [...MATS, 'ROCK'])
    for (const dir of ['side', 'down', 'up']) out[`${m} ${dir}`] = await page.evaluate(DIG, [m, dir, 240, m === 'ROCK']);
  console.log(JSON.stringify(out));
  for (const [k, r] of Object.entries(out)) {
    const [m, dir] = k.split(' ');
    expect(r.stuck, `${k}: ${JSON.stringify(r)}`).toBe(false);
    // sand runs into the tunnel behind you, so it is slow going
    if (m !== 'SAND') expect(r.dx, `${k}: ${JSON.stringify(r)}`).toBeGreaterThan(m === 'ROCK' ? 25 : 40);
    if (dir === 'down') expect(r.dy, `${k}: ${JSON.stringify(r)}`).toBeGreaterThan(3);
    if (dir === 'up' && m !== 'SAND') expect(r.dy, `${k}: ${JSON.stringify(r)}`).toBeLessThan(-8);
  }
  expect(errors).toEqual([]);
});

test('every strike throws crumbs and plays the sound of the ground', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww;
    w.audioInit();
    await w.G.AC.resume();
    // every dig sound plays, panned to the side of the screen it comes from
    for (const n of ['dig', 'digSand', 'digLoam', 'digCoal', 'digOre', 'digRock', 'nug', 'ting'])
      w.sfx(n, w.crew[0].x + 40, w.crew[0].y, 1, 1.25);
    const out = {};
    for (const m of ['EARTH', 'SAND', 'ROCK']) {
      const { mat, W, AIR, paint } = w.world;
      for (let x = 380; x < 700; x++)
        for (let y = 60; y < 260; y++) {
          mat[y * W + x] = y < 200 && x < 440 ? AIR : w.world[m];
          paint(y * W + x);
        }
      w.G.tools = { pick: true };
      w.parts().length = 0;
      const c = w.crew[0];
      Object.assign(c, { x: 432, y: 190, vx: 0, vy: 0, face: 1 });
      w.step(5);
      w.keys.r = w.keys.dig = 1;
      let crumbs = 0,
        hits = 0,
        ph = c.digPh || 0;
      for (let i = 0; i < 120; i++) {
        w.step(1);
        if (c.digPh < ph) hits++;
        ph = c.digPh;
        crumbs = Math.max(crumbs, w.parts().filter(p => p.b).length);
      }
      w.keys.r = w.keys.dig = 0;
      out[m] = { crumbs, hits, extra: w.parts().filter(p => !p.b).length };
    }
    return out;
  });
  console.log(JSON.stringify(r));
  // a beat of a few strikes per second, faster in sand than in rock
  expect(r.EARTH.hits).toBeGreaterThan(6);
  expect(r.SAND.hits).toBeGreaterThan(r.ROCK.hits);
  for (const m of ['EARTH', 'SAND', 'ROCK']) expect(r[m].crumbs, m).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('loot falls where it was dug, and the end of a small vein still gives its nugget', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, AIR, EARTH, GOLD, paint } = w.world,
      c = w.crew[0];
    for (let x = 380; x < 700; x++)
      for (let y = 60; y < 260; y++) {
        mat[y * W + x] = y < 200 && x < 440 ? AIR : EARTH;
        paint(y * W + x);
      }
    // a little vein of 12 cells in the way: less than one nugget's worth (16)
    for (let x = 470; x < 474; x++) for (let y = 194; y < 197; y++) mat[y * W + x] = GOLD;
    for (let x = 470; x < 474; x++) for (let y = 194; y < 197; y++) paint(y * W + x);
    w.items.length = 0;
    w.G.goldDust = 0;
    Object.assign(c, { x: 432, y: 190, vx: 0, vy: 0, face: 1, goldDust: 0, inv: [] });
    w.step(5);
    w.keys.r = w.keys.dig = 1;
    w.step(160);
    w.keys.r = w.keys.dig = 0;
    // (the Wühler picks up what falls at its feet)
    return {
      lying: w.items.filter(t => t.t === 'nug').map(t => Math.round(t.x)),
      carried: c.inv.filter(t => t === 'nug').length,
      world: w.G.goldDust,
      own: c.goldDust,
    };
  });
  console.log(JSON.stringify(r));
  expect(r.lying.length + r.carried).toBe(1);
  // lying in the tunnel next to the vein, if not already in the pack
  for (const x of r.lying) {
    expect(x).toBeGreaterThan(455);
    expect(x).toBeLessThan(500);
  }
  // the dust was counted for the Wühler, not for the world
  expect(r.world).toBe(0);
  expect(r.own).toBe(0);
  expect(errors).toEqual([]);
});

test('after a short pause digging goes on at once, a fresh start needs a moment of pushing', async ({ page }) => {
  const errors = await field(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, AIR, EARTH, paint } = w.world,
      c = w.crew[0];
    for (let x = 380; x < 700; x++)
      for (let y = 60; y < 260; y++) {
        mat[y * W + x] = y < 200 && x < 440 ? AIR : EARTH;
        paint(y * W + x);
      }
    Object.assign(c, { x: 432, y: 190, vx: 0, vy: 0, face: 1 });
    w.step(5);
    // automatic digging only: walk against the wall
    const until = () => {
      for (let i = 1; i < 60; i++) {
        w.step(1);
        if (c.digging) return i;
      }
      return 99;
    };
    w.keys.r = 1;
    const first = until();
    w.step(40);
    w.keys.r = 0;
    w.step(12);
    w.keys.r = 1;
    const again = until();
    w.keys.r = 0;
    // long after, it takes the push again
    w.step(120);
    w.keys.r = 1;
    const later = until();
    w.keys.r = 0;
    return { first, again, later };
  });
  console.log(JSON.stringify(r));
  expect(r.first).toBeGreaterThan(5);
  expect(r.first).toBeLessThan(40);
  // (only the few pixels back to the face are walked first)
  expect(r.again).toBeLessThan(10);
  expect(r.again).toBeLessThan(r.first - 10);
  expect(r.later).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});
