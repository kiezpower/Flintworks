// Shared helpers for the browser tests. window.__ww exists only in the dev build (src/debug.js).
import { expect } from '@playwright/test';

export async function startGame(page, button = '#goBtn') {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?seed=7');
  await page.click(button);
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.__ww.freeze());
  return errors;
}

export const steps = (page, n) => page.evaluate(n => window.__ww.step(n), n);

// Put the first digger on flat ground near x and return the spot (or -1)
export const placeOnFlatGround = (page, x) =>
  page.evaluate(x0 => {
    const w = window.__ww,
      c = w.crew[0];
    for (let X = x0; X < x0 + 400; X += 3) {
      if (w.builds.some(b => X + 30 > b.x - 4 && X - 30 < b.x + b.w + 4)) continue;
      const ys = [];
      for (let k = -12; k <= 12; k += 2) {
        let y = 0;
        while (y < 399 && !w.solidAt(X + k, y)) y++;
        ys.push(y);
      }
      if (Math.max(...ys) - Math.min(...ys) <= 1) {
        c.x = X - 3;
        c.y = Math.min(...ys) - 11;
        c.vx = c.vy = 0;
        return X;
      }
    }
    return -1;
  }, x);

// Panels ignore taps in their first 450 ms (protection against ghost taps), so wait first
export async function clickInPanel(page, selector) {
  await page.waitForTimeout(500);
  await page.click(selector);
}
