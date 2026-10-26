// Bots without a network: a bot is an opponent, not a helper. It storms the other castle with
// flint it buys, takes the hill, and hands its castle to a person who joins: npm test
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
// a Versus world (gmode) with bots for the given teams (k: their style, 0 storm, 1 hill, 2 earn)
const NEW = ([mode, ffa, bots]) => {
  const w = window.__ww,
    G = w.G;
  Object.assign(G, { nextMode: mode, nextSeed: 5, nextBiome: 'meadow', nextDiff: 'relaxed', nextVersus: true });
  Object.assign(G, { nextFfa: ffa, nextNp: 1, nextSize: ffa ? [800 + 300 * ffa, 400] : null });
  w.gen();
  Object.assign(G, { nextSeed: null, nextVersus: false, nextFfa: 0, nextNp: 1, nextSize: null });
  for (const [t, k] of bots) w.bots.addBot(t, k);
  G.state = 'play';
};
// run the game for some seconds, noting the plans the bots pick
const RUN = sec => {
  const w = window.__ww,
    plans = {};
  for (let f = 0; f < sec * 60; f++) {
    w.step(1);
    if (f % 30 === 0)
      for (const c of w.crew) if (c.bot && c.brain?.plan) (plans[c.name] ||= new Set()).add(c.brain.plan);
  }
  return Object.fromEntries(Object.entries(plans).map(([k, v]) => [k, [...v]]));
};
const hp = t => window.__ww.builds.find(b => b.type === 'base' && (b.team || 0) === t).hp;

test('helpers never attack: without a bot both castles stay whole', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(NEW, ['gold', 0, []]);
  await page.evaluate(RUN, 60);
  expect(await page.evaluate(hp, 0)).toBe(400);
  expect(await page.evaluate(hp, 1)).toBe(400);
  expect(errors).toEqual([]);
});

test('a storming bot walks over, aims and blasts the other castle', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(NEW, ['gold', 0, [[1, 0]]]);
  const info = await page.evaluate(() => {
    const c = window.__ww.crew.find(o => o.bot);
    return { pid: c.pid, team: c.team, name: c.name, inv: [...c.inv] };
  });
  expect(info.team).toBe(1);
  expect(info.pid).toBeLessThan(0);
  expect(info.name).toContain('(Bot)');
  // (a castle mends itself after ten quiet seconds: the lowest it got counts)
  const r = await page.evaluate(() => {
    const w = window.__ww,
      red = w.builds.find(b => b.type === 'base' && !b.team),
      blue = w.builds.find(b => b.type === 'base' && b.team === 1),
      c = w.crew.find(o => o.bot),
      plans = new Set();
    let low = 400;
    for (let f = 0; f < 120 * 60; f++) {
      w.step(1);
      plans.add(c.brain.plan);
      low = Math.min(low, red.hp);
    }
    return { plans: [...plans], low, blue: blue.hp };
  });
  expect(r.plans).toContain('storm');
  expect(r.low).toBeLessThan(400);
  expect(r.blue).toBe(400);
  expect(errors).toEqual([]);
});

test('a bot out of explosives buys flint at its castle', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(NEW, ['gold', 0, [[1, 0]]]);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      G = w.G,
      c = w.crew.find(o => o.bot);
    c.inv = [];
    w.teams?.useTeam?.(1);
    G.teams[1].money = 100;
    const plans = new Set();
    for (let f = 0; f < 60 * 60; f++) {
      w.step(1);
      if (c.brain?.plan) plans.add(c.brain.plan);
      if (plans.has('arm') && c.inv.includes('flint')) break;
    }
    return { plans: [...plans], flint: c.inv.filter(t => t === 'flint').length, money: G.teams[1].money };
  });
  expect(r.plans).toContain('arm');
  expect(r.flint).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a hill bot takes the hill, a person joining takes over the bot', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(NEW, ['gold', 0, [[1, 1]]]);
  const plans = await page.evaluate(RUN, 75);
  expect(Object.values(plans)[0]).toContain('hill');
  expect(await page.evaluate(() => window.__ww.G.mp.hill.own)).toBe(1);
  // four castles, three bots: a person takes over the yellow one
  await page.evaluate(NEW, ['gold', 4, [[1, 0], [2, 1], [3, 2]]]);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.bots.takeOverBot(2, { pid: 7, name: 'Nora', cap: '#fff', hat: 'cap' });
    return { pid: c.pid, bot: c.bot, name: c.name, left: w.crew.filter(o => o.bot).length };
  });
  expect(r).toEqual({ pid: 7, bot: false, name: 'Nora', left: 2 });
  expect(errors).toEqual([]);
});
