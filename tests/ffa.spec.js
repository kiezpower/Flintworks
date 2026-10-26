// "Jeder gegen jeden" and quick play rounds without a network: three or four castles, a hill the
// strongest team takes, stormed castles are out and the last one standing wins; quick play
// Versus rounds last four minutes: npm test
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
// a new world as the host of a round would make it (ffa: number of castles, vsMin: the clock)
const NEW = ([mode, ffa, vsMin]) => {
  const w = window.__ww,
    G = w.G;
  Object.assign(G, { nextMode: mode, nextSeed: 5, nextBiome: 'meadow', nextDiff: 'adventure', nextVersus: true });
  Object.assign(G, { nextFfa: ffa, nextVsMin: vsMin, nextNp: ffa || 2, nextSize: ffa ? [800 + 300 * ffa, 400] : null });
  w.gen();
  Object.assign(G, { nextSeed: null, nextVersus: false, nextFfa: 0, nextVsMin: null, nextNp: 1, nextSize: null });
  const bases = w.builds.filter(b => b.type === 'base').sort((a, b) => (a.team || 0) - (b.team || 0));
  return {
    teams: G.teams.length,
    bases: bases.map(b => [b.team || 0, Math.round(b.x)]),
    helpers: bases.map((b, t) => w.crew.filter(c => (c.team || 0) === t).length),
    hill: !!G.mp.hill,
    len: G.mp.len / 3600,
    goal: w.modes.mode().goal,
  };
};

test('four castles: spread over the world, each with helpers, a hill in the middle', async ({ page }) => {
  const errors = await open(page);
  const four = await page.evaluate(NEW, ['gold', 4, null]);
  expect(four.teams).toBe(4);
  expect(four.bases.map(b => b[0])).toEqual([0, 1, 2, 3]);
  // left, right, and the two in between, well apart
  const xs = four.bases.map(b => b[1]).sort((a, b) => a - b);
  for (let k = 1; k < 4; k++) expect(xs[k] - xs[k - 1]).toBeGreaterThan(300);
  expect(four.helpers.every(n => n >= 2)).toBe(true);
  expect(four.hill).toBe(true);
  expect(four.len).toBe(8);
  // three castles: the middle one stands where the hill would be
  const three = await page.evaluate(NEW, ['gold', 3, null]);
  expect(three.teams).toBe(3);
  expect(three.hill).toBe(false);
  expect(errors).toEqual([]);
});

test('quick play Versus: a four minute clock, the same goal', async ({ page }) => {
  const errors = await open(page);
  const long = await page.evaluate(NEW, ['gold', 0, null]);
  const quick = await page.evaluate(NEW, ['gold', 0, 4]);
  expect(long.teams).toBe(2);
  expect(quick.len).toBe(4);
  expect(quick.goal).toBe(long.goal);
  expect(errors).toEqual([]);
});

test('Jeder gegen jeden: the strongest takes the hill, the last castle standing wins', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(NEW, ['gold', 4, null]);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      G = w.G,
      out = {};
    const castle = t => w.builds.find(b => b.type === 'base' && (b.team || 0) === t);
    const of = t => w.crew.filter(c => (c.team || 0) === t);
    const me = w.crew.find(c => c.pid === G.myId);
    G.state = 'play';
    // yellow alone on the hill takes it
    const h = G.mp.hill,
      put = c => Object.assign(c, { x: h.x - 3, y: h.y - 10, vx: 0, vy: 0 });
    for (let k = 0; k < 900; k++) {
      put(of(2)[0]);
      w.step(1);
    }
    out.hill1 = h.own;
    // two green ones against one yellow: green first pulls it down, then takes it
    for (let k = 0; k < 1500; k++) {
      put(of(2)[0]);
      put(of(3)[0]);
      put(of(3)[1]);
      w.step(1);
    }
    out.hill2 = h.own;
    // red storms blue: blue is out, the round goes on
    const storm = t => {
      for (let k = 0; k < 14 && castle(t).hp > 0; k++) w.explode(castle(t).x + 18, castle(t).gy - 12, 19, me);
      w.step(2);
    };
    storm(1);
    out.afterOne = [castle(1).hp, G.state];
    storm(2);
    out.afterTwo = G.state;
    storm(3);
    out.end = [G.state, document.getElementById('card').textContent.includes('Rot steht als Letzter')];
    return out;
  });
  expect(r.hill1).toBe(2);
  expect(r.hill2).toBe(3);
  expect(r.afterOne).toEqual([0, 'play']);
  expect(r.afterTwo).toBe('play');
  expect(r.end).toEqual(['won', true]);
  expect(errors).toEqual([]);
});
