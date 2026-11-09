// Torches (torches.js) and a storage chest deep down (crate.js): npm test
import { expect, test } from '@playwright/test';

async function start(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', diff: 'relaxed' }),
    );
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  return errors;
}
// a room 30 m down, the player standing in it facing its right wall
const ROOM = async () => {
  const w = window.__ww,
    G = w.G;
  const { mat, W, AIR, ROCK, surf } = await import('/src/world.js');
  const x = G.base.x + 320,
    y = surf[x] + 120;
  for (let yy = y - 16; yy < y; yy++) for (let xx = x - 20; xx < x + 20; xx++) mat[yy * W + xx] = AIR;
  for (let yy = y; yy < y + 3; yy++) for (let xx = x - 22; xx < x + 22; xx++) mat[yy * W + xx] = ROCK;
  for (let yy = y - 16; yy < y; yy++) for (let xx = x + 20; xx < x + 24; xx++) mat[yy * W + xx] = ROCK;
  return { x, y };
};

test('the workshop makes torches, a player takes three, sets one at a wall: it lights and shows on the map', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async ROOM => {
    const w = window.__ww,
      G = w.G;
    const { arriveAtBase } = await import('/src/store.js');
    const { knownAt } = await import('/src/fog.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    // the workshop makes them from wood and coal
    w.builds.push({ id: 9971, type: 'shop', x: G.base.x - 30, gy: G.base.gy, w: 22, h: 16, prog: 1, done: true, busy: 0 });
    G.store.wood = 6;
    G.store.coal = 3;
    for (let q = 0; q < 400; q++) w.step(1);
    const made = G.store.torch || 0;
    me.inv = [];
    arriveAtBase(me);
    const took = me.inv.filter(t => t === 'torch').length;
    // down in a room, at its right wall
    const { x, y } = await eval(ROOM)();
    Object.assign(me, { x: x + 13, y: y - 10, vx: 0, vy: 0, face: 1 });
    me.isel = me.inv.indexOf('torch');
    w.step(3);
    const cx = w.context(me);
    const label = cx.label;
    cx.fn();
    const [tx, ty] = G.torches[0];
    const bag = me.inv.filter(t => t === 'torch').length;
    // far away the map gets to know the torch's place
    Object.assign(me, { x: G.base.x + 10, y: G.base.gy - 10 });
    const { fogTick } = await import('/src/fog.js');
    fogTick();
    return { made: made >= 3, took, label, set: G.torches.length, wall: tx > x + 15, seen: knownAt(tx, ty), bag };
  }, ROOM.toString());
  expect(r).toEqual({ made: true, took: 3, label: 'Fackel setzen', set: 1, wall: true, seen: true, bag: 2 });
  expect(errors).toEqual([]);
});

test('a storage chest deep down takes the finds; a helper carries them to the castle', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async ROOM => {
    const w = window.__ww,
      G = w.G;
    const { x, y } = await eval(ROOM)();
    const me = w.crew.find(c => c.pid === G.myId);
    // a finished chest in the room; on the surface one cannot be built
    w.builds.push({ id: 9970, type: 'crate', x: x - 5, gy: y, w: 10, h: 7, prog: 1, done: true, busy: 0 });
    Object.assign(me, { x: x - 3, y: y - 10, vx: 0, vy: 0 });
    me.inv = ['nug', 'nug', 'gem', 'ore', 'coal', 'rock', 'rock', 'tnt'];
    w.step(2);
    const cx = w.context(me);
    const label = cx.label;
    cx.fn();
    const chest = w.builds.find(b => b.id === 9970);
    const stored = chest.items.length,
      kept = [...me.inv];
    // a helper with nothing to do fetches them
    const h = w.crew.find(c => c.pid == null && !c.dead);
    for (const c of [...w.crew]) if (c !== me && c !== h) w.crew.splice(w.crew.indexOf(c), 1);
    Object.assign(h, { x: x + 4, y: y - 10, vx: 0, vy: 0, job: null, path: null, inv: [] });
    me.x = G.base.x + 10;
    me.y = G.base.gy - 10;
    let k = 0;
    while (chest.items.length && k++ < 600) w.step(1);
    return { label, stored, kept, fetched: chest.items.length === 0, carry: h.inv.length };
  }, ROOM.toString());
  expect(r).toEqual({ label: 'Ablegen', stored: 7, kept: ['tnt'], fetched: true, carry: 7 });
  expect(errors).toEqual([]);
});
