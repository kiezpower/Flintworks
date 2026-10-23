import { expect, test } from '@playwright/test';
import { clickInPanel, placeOnFlatGround, startGame, steps } from './helpers.js';

test('the tutorial can be played to the end', async ({ page }) => {
  const errors = await startGame(page, '#tutBtn');
  const stepNo = () => page.evaluate(() => window.__ww.tut?.i ?? null);
  const teleport = fn => page.evaluate(fn);

  await page.keyboard.down('ArrowRight');
  await steps(page, 60);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space');
  await steps(page, 20);
  await page.keyboard.down('Shift');
  await steps(page, 220);
  await page.keyboard.up('Shift');
  expect(await stepNo()).toBe(3);

  await teleport(() => {
    const w = window.__ww,
      c = w.crew[0];
    const t = w.trees.filter(t => !t.fall).sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0];
    c.x = t.x - 10;
    c.y = t.gy - 11;
    c.vx = c.vy = 0;
    c.face = 1;
  });
  await steps(page, 40);
  await page.keyboard.press('f');
  await steps(page, 300);
  for (let k = 0; k < 3; k++) {
    await teleport(() => {
      const w = window.__ww,
        c = w.crew[0],
        it = w.items.find(i => i.t === 'wood');
      if (it) {
        c.x = it.x;
        c.y = it.y - 8;
      }
    });
    await steps(page, 30);
  }
  expect(await stepNo()).toBe(5);

  const base = await page.evaluate(() => window.__ww.base.x + window.__ww.base.w + 20);
  expect(await placeOnFlatGround(page, base)).toBeGreaterThan(0);
  await steps(page, 40);
  await page.click('#buildBtn');
  await clickInPanel(page, '#pBody .opt >> nth=0');
  await steps(page, 320);
  expect(await stepNo()).toBe(7);

  await teleport(() => {
    const w = window.__ww,
      c = w.crew[0];
    c.inv = [];
    let best = null,
      bd = 1e9;
    for (let y = 0; y < 400; y++)
      for (let x = Math.max(0, c.x - 200); x < c.x + 200; x++)
        if (w.matAt(x, y) === 3) {
          const d = Math.hypot(x - c.x, y - c.y);
          if (d < bd) {
            bd = d;
            best = [x, y];
          }
        }
    c.x = best[0] - 14;
    c.y = best[1] - 6;
  });
  await page.keyboard.down('Shift');
  await page.keyboard.down('ArrowRight');
  await steps(page, 80);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('Shift');
  for (let k = 0; k < 4; k++) {
    await teleport(() => {
      const w = window.__ww,
        c = w.crew[0],
        it = w.items.find(i => i.t === 'nug');
      if (it) {
        c.x = it.x - 2;
        c.y = it.y - 8;
      }
    });
    await steps(page, 40);
  }
  expect(await stepNo()).toBe(8);

  await teleport(() => {
    const w = window.__ww,
      c = w.crew[0];
    c.x = w.base.x + 15;
    c.y = w.base.gy - 11;
  });
  await steps(page, 30);
  await page.keyboard.press('f');
  await clickInPanel(page, '#pBody .sellrow .go');
  await page.keyboard.press('Escape');
  await steps(page, 30);
  expect(await stepNo()).toBe(null);
  await expect(page.locator('#quest')).toBeHidden();
  expect(errors).toEqual([]);
});
