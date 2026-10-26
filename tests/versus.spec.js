// Multiplayer rules without a network: Versus castles can be stormed, the hill in the middle
// pays its holder, the clock ends the round; Koop goals grow with the players: npm test
import { expect, test } from '@playwright/test';

async function open(page) {
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
  return errors;
}
// a new world as the host of a round would make it
const NEW = ([mode, np, versus]) => {
  const w = window.__ww,
    G = w.G;
  Object.assign(G, { nextMode: mode, nextSeed: 5, nextBiome: 'meadow', nextDiff: 'adventure', nextVersus: versus });
  G.nextNp = np;
  w.gen();
  G.nextSeed = null;
  G.nextVersus = false;
  G.nextNp = 1;
  return w.modes.mode().goal;
};

test('goals grow with the players in Koop and shrink in Versus', async ({ page }) => {
  const errors = await open(page);
  const goals = {};
  for (const args of [
    ['gold', 1, false],
    ['gold', 3, false],
    ['gold', 2, true],
    ['treasure', 2, false],
    ['zweiburgen', 2, false],
    ['zweiburgen', 2, true],
    ['wettgraben', 2, true],
  ])
    goals[args.join(' ')] = await page.evaluate(NEW, args);
  expect(goals).toEqual({
    'gold 1 false': 800,
    'gold 3 false': 1600,
    'gold 2 true': 520,
    'treasure 2 false': 6,
    'zweiburgen 2 false': 900,
    'zweiburgen 2 true': 390,
    'wettgraben 2 true': 100, // (depth does not change)
  });
  // the treasure hunt gets enough chests for the bigger goal
  await page.evaluate(NEW, ['treasure', 2, false]);
  const chests = await page.evaluate(() => window.__ww.G.chests.length);
  expect(chests).toBeGreaterThanOrEqual(8);
  expect(errors).toEqual([]);
});

test('Versus: castles are stormed, the hill pays, the clock decides', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(NEW, ['burgsturm', 2, true]);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      G = w.G,
      out = {};
    const castle = t => w.builds.find(b => b.type === 'base' && (b.team || 0) === t);
    const red = castle(0),
      blue = castle(1),
      a = w.crew.find(c => (c.team || 0) === 0),
      b = w.crew.find(c => c.team === 1);
    out.start = [red.hp, blue.hp];
    out.round = { len: G.mp.len / 3600, hill: !!G.mp.hill, chest: G.chests.filter(c => c.re).length };
    // a blast at your own castle does nothing, at the other one it hurts and spills gold
    w.explode(red.x + 5, red.gy - 10, 19, a);
    const nugs = w.items.filter(i => i.t === 'nug').length;
    w.explode(blue.x + 5, blue.gy - 10, 19, a);
    out.after = [red.hp, blue.hp];
    out.spilled = w.items.filter(i => i.t === 'nug').length > nugs;
    // a blue Wühler stands on the hill until it is blue's
    G.state = 'play';
    const h = G.mp.hill;
    for (let k = 0; k < 900; k++) {
      Object.assign(b, { x: h.x - 3, y: h.y - 10, vx: 0, vy: 0 });
      w.step(1);
    }
    out.hill = h.own;
    // a sword hit on a Wühler of the other team
    G.tools.sword = true;
    const me = w.crew.find(c => c.pid === G.myId);
    Object.assign(me, { x: b.x - 6, y: b.y, face: 1, swingCd: 0 });
    const e0 = b.energy;
    w.combat.swordContext(me).fn();
    out.sword = b.energy < e0;
    // the clock runs out: somebody wins and the end screen says why
    G.playTicks = G.mp.len - 1;
    w.step(31);
    out.end = [G.state, document.getElementById('card').textContent.includes('Zeit um')];
    return out;
  });
  expect(r.start).toEqual([400, 400]);
  expect(r.round).toEqual({ len: 8, hill: true, chest: 1 });
  expect(r.after[0]).toBe(400);
  expect(r.after[1]).toBeLessThan(400);
  expect(r.spilled).toBe(true);
  expect(r.hill).toBe(1);
  expect(r.sword).toBe(true);
  expect(['won', 'lost']).toContain(r.end[0]);
  expect(r.end[1]).toBe(true);
  expect(errors).toEqual([]);
});

test('Versus: a stormed castle ends the round', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(NEW, ['gold', 2, true]);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      G = w.G,
      blue = w.builds.find(b => b.type === 'base' && b.team === 1),
      a = w.crew.find(c => c.pid === G.myId);
    G.state = 'play';
    for (let k = 0; k < 12 && blue.hp > 0; k++) w.explode(blue.x + 18, blue.gy - 12, 19, a);
    w.step(2);
    return { hp: blue.hp, state: G.state, center: G.chests.some(c => c.re === 2) };
  });
  expect(r).toEqual({ hp: 0, state: 'won', center: true });
  expect(errors).toEqual([]);
});
