// Dangerous nights (nights.js): in free play the first night is quiet, from the second on monsters
// come out on the surface near the Wühler; at dawn the ones nobody is near are gone; not in the
// relaxed setting: npm test
import { expect, test } from '@playwright/test';

async function play(page, profile = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(p => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', ...p }));
  }, profile);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  return errors;
}
// run through a night (dusk, some of the night, dawn) and count the roamers on the way
const night = page =>
  page.evaluate(() => {
    const w = window.__ww,
      roam = () => w.animals.filter(a => a.night).length;
    // (night counts from a little after sunset)
    w.G.dayT = 0.5;
    for (let k = 0; k < 900; k++) w.step(1);
    const inNight = roam();
    // the Wühler at home, far from the roamers, then morning
    for (const c of w.crew) Object.assign(c, { x: w.G.base.x + 14, y: w.G.base.gy - 10, vx: 0, vy: 0 });
    for (const a of w.animals) if (a.night) a.x = Math.min(w.world.W - 20, w.G.base.x + 400);
    // (just before morning, so they have no time to come close again)
    w.G.dayT = 0.007;
    for (let k = 0; k < 300; k++) w.step(1);
    return { inNight, after: roam() };
  });

test('the first night is quiet, the second brings roamers, at dawn they are gone', async ({ page }) => {
  const errors = await play(page);
  const first = await night(page);
  const second = await night(page);
  expect(first.inNight).toBe(0);
  expect(second.inNight).toBeGreaterThan(0);
  expect(second.after).toBe(0);
  expect(errors).toEqual([]);
});

test('in the relaxed setting the nights stay quiet', async ({ page }) => {
  const errors = await play(page, { diff: 'relaxed' });
  await night(page);
  const second = await night(page);
  expect(second.inNight).toBe(0);
  expect(errors).toEqual([]);
});
