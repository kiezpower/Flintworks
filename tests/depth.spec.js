// Going deep pays (digger.js goldStep): in free play deeper gold gives more nuggets; the HUD shows
// how deep you are: npm test
import { expect, test } from '@playwright/test';

test('deeper gold is richer in free play, and the HUD shows the depth', async ({ page }) => {
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
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const { goldStep } = await import('/src/digger.js');
    const { surf } = await import('/src/world.js');
    const x = G.base.x + 300;
    const steps = [0, 100, 180, 260].map(d => goldStep(x, surf[x] + d));
    // the player 30 m down: the HUD says so
    const me = w.crew.find(c => c.pid === G.myId);
    Object.assign(me, { x: x - 3, y: surf[x] + 120 - 10, vx: 0, vy: 0 });
    await new Promise(r => setTimeout(r, 400));
    const el = document.getElementById('depthTxt');
    return { steps, shown: !el.hidden, text: el.textContent, rich: el.classList.contains('rich') };
  });
  expect(r).toEqual({ steps: [16, 14, 12, 10], shown: true, text: '↓ 30 m', rich: true });
  expect(errors).toEqual([]);
});

test('choosing a thing in the bag shows its name for a moment', async ({ page }) => {
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3 }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  await page.evaluate(() => {
    const me = window.__ww.crew.find(c => c.pid === window.__ww.G.myId);
    me.inv = ['potHeal', 'potGlow'];
    me.isel = 0;
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window.__ww.crew.find(c => c.pid === window.__ww.G.myId).isel = 1));
  await expect(page.locator('#itemName')).toBeVisible();
  await expect(page.locator('#itemName')).toHaveText('Leuchttrank');
  await expect(page.locator('#itemName')).toBeHidden({ timeout: 4000 });
});
