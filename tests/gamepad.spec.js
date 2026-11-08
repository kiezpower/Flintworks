// Gamepads (gamepad.js): a pad (here a pretend one) starts the game from the lobby, walks, jumps,
// opens the build menu and moves through it, and B goes back: npm test
import { expect, test } from '@playwright/test';

// a pretend gamepad in the standard layout; the test moves its stick and presses its buttons
async function withPad(page) {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    window.__pad = { axes: [0, 0, 0, 0], buttons };
    navigator.getGamepads = () => [{ index: 0, connected: true, mapping: 'standard', axes: window.__pad.axes, buttons }];
  });
}
const B = { A: 0, B: 1, X: 2, Y: 3, RB: 5, DOWN: 13 };
// hold a button for a few ticks, then let go
const press = async (page, b) => {
  await page.evaluate(k => (window.__pad.buttons[k].pressed = true), B[b]);
  await page.waitForTimeout(120);
  await page.evaluate(k => (window.__pad.buttons[k].pressed = false), B[b]);
  await page.waitForTimeout(120);
};

test('with a gamepad: start from the lobby, walk, jump, build menu, back', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await withPad(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3 }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  // in the lobby: the focus on "Spielen", A starts the game
  await page.focus('#lbPlay');
  await press(page, 'A');
  await page.waitForFunction(() => window.__ww.state === 'play', null, { timeout: 8000 });
  await page.waitForTimeout(800);
  // the stick to the right: the Wühler walks right
  const x0 = await page.evaluate(() => window.__ww.crew.find(c => c.pid === window.__ww.G.myId).x);
  await page.evaluate(() => (window.__pad.axes[0] = 1));
  await page.waitForTimeout(700);
  await page.evaluate(() => (window.__pad.axes[0] = 0));
  const x1 = await page.evaluate(() => window.__ww.crew.find(c => c.pid === window.__ww.G.myId).x);
  expect(x1).toBeGreaterThan(x0 + 5);
  // A: a jump
  await page.evaluate(() => (window.__minY = 1e9));
  await page.evaluate(() => {
    const me = window.__ww.crew.find(c => c.pid === window.__ww.G.myId);
    window.__y0 = me.y;
    window.__watch = setInterval(() => (window.__minY = Math.min(window.__minY, me.y)), 16);
  });
  await press(page, 'A');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__y0 - window.__minY)).toBeGreaterThan(4);
  // RB: the build menu; the d-pad moves the focus to an option; B closes it
  await press(page, 'RB');
  await expect(page.locator('#panel')).toBeVisible();
  await page.waitForTimeout(500);
  await press(page, 'DOWN');
  expect(await page.evaluate(() => !!document.activeElement.closest('#panel'))).toBe(true);
  await press(page, 'B');
  await expect(page.locator('#panel')).toBeHidden();
  // and the arrow the pad sent did not leave a key held: the Wühler stands still
  const xa = await page.evaluate(() => window.__ww.crew.find(c => c.pid === window.__ww.G.myId).x);
  await page.waitForTimeout(500);
  const xb = await page.evaluate(() => window.__ww.crew.find(c => c.pid === window.__ww.G.myId).x);
  expect(Math.abs(xb - xa)).toBeLessThan(2);
  expect(errors).toEqual([]);
});
