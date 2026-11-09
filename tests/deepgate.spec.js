// The gate in the depth (digger.js, gen.js): in free play rock deeper than 45 m gives only to the
// diamond pick, also for the helpers' path finding; above it the steel pick is enough; levels and
// the campaign have no gate: npm test
import { expect, test } from '@playwright/test';

async function round(page, profile = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(p => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', ...p }));
  }, profile);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  return errors;
}
// whether a rock cell at a depth (cells below the surface) gives to a stroke (digger.js digCell,
// where the game decides for players, helpers and machines alike)
const digAt = (page, depth) =>
  page.evaluate(async depth => {
    const w = window.__ww,
      { digCell } = await import('/src/digger.js'),
      { mat, W, surf, paint, ROCK } = w.world,
      x = w.G.base.x + 200,
      y = surf[x] + depth;
    mat[y * W + x] = ROCK;
    paint(y * W + x);
    return digCell(x, y, true, w.crew[0]) === ROCK && mat[y * W + x] !== ROCK;
  }, depth);

test('deep rock gives only to the diamond pick; above the gate the steel pick does', async ({ page }) => {
  const errors = await round(page);
  await page.evaluate(() => {
    const G = window.__ww.G;
    G.money = 9999;
    G.tools = { ...(G.tools || {}), pick: true, r_metal: true, r_harden: true };
  });
  const shallow = await digAt(page, 100);
  const deepSteel = await digAt(page, 230);
  // the hint why, for the player in front of deep rock with the steel pick (once in 20 s)
  const hint = await page.evaluate(async () => {
    const w = window.__ww,
      { gateHint } = await import('/src/digger.js'),
      { mat, W, surf, paint, ROCK, AIR } = w.world,
      me = w.crew.find(c => c.pid === w.G.myId),
      x0 = w.G.base.x + 320,
      y0 = surf[x0] + 230;
    for (let y = y0 - 12; y < y0 + 2; y++)
      for (let x = x0 - 10; x < x0 + 10; x++) {
        mat[y * W + x] = x < x0 && y < y0 ? AIR : ROCK;
        paint(y * W + x);
      }
    Object.assign(me, { x: x0 - 8, y: y0 - 10 });
    w.G.gateHintT = null;
    gateHint(me, 1);
    const first = w.G.gateHintT != null && document.getElementById('toast').textContent.includes('Tiefenfels');
    const t = w.G.gateHintT;
    gateHint(me, 1);
    return { first, once: w.G.gateHintT === t };
  });
  expect(hint).toEqual({ first: true, once: true });
  // the helpers' path finding sees the same rule
  const helperView = await page.evaluate(async () => {
    const w = window.__ww,
      { diggable } = await import('/src/digger.js'),
      { surf, ROCK } = w.world,
      x = w.G.base.x + 200;
    return [diggable(ROCK, x, surf[x] + 100), diggable(ROCK, x, surf[x] + 230)];
  });
  await page.evaluate(() => (window.__ww.G.tools = { ...window.__ww.G.tools, dpick: true }));
  const deepDiamond = await digAt(page, 230);
  expect(shallow).toBe(true);
  expect(deepSteel).toBe(false);
  expect(helperView).toEqual([true, false]);
  expect(deepDiamond).toBe(true);
  expect(errors).toEqual([]);
});

test('a hand-built level has no gate in the depth', async ({ page }) => {
  const errors = await round(page, { gmode: 'altemine', campaign: { fluffelrettung: 1 } });
  const gate = await page.evaluate(async () => {
    const { getDeepGate } = await import('/src/world.js');
    return [window.__ww.G.mode, getDeepGate()];
  });
  expect(gate).toEqual(['altemine', 0]);
  expect(errors).toEqual([]);
});
