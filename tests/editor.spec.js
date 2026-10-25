// The level editor (dev server only, /editor.html): paint, undo, rectangles, objects, and play
// the draft right away: npm test
import { expect, test } from '@playwright/test';

test('the level editor paints, undoes, places objects and plays the draft', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done' }));
  });
  await page.goto('/editor.html?level=wipfrettung');
  await page.waitForFunction(() => window.__editor && window.__editor.grid);
  const box = await page.locator('#cv').boundingBox();
  const sc = await page.evaluate(() => document.getElementById('cv').width / window.__editor.grid[0].length);
  const px = (cx, cy) => [box.x + (cx + 0.5) * sc, box.y + (cy + 0.5) * sc];
  const at = (cx, cy) => page.evaluate(([cx, cy]) => window.__editor.grid[cy][cx], [cx, cy]);
  const before = await at(35, 40);
  // a brush stroke of lava, undone again
  await page.click('#pal button:has-text("Lava")');
  await page.mouse.move(...px(30, 40));
  await page.mouse.down();
  await page.mouse.move(...px(40, 40), { steps: 5 });
  await page.mouse.up();
  expect(await at(35, 40)).toBe('%');
  await page.keyboard.press('Control+z');
  expect(await at(35, 40)).toBe(before);
  // a rectangle of rock
  await page.click('#pal button:has-text("Fels")');
  await page.click('#tools button:has-text("Rechteck")');
  await page.mouse.move(...px(20, 50));
  await page.mouse.down();
  await page.mouse.move(...px(26, 54), { steps: 3 });
  await page.mouse.up();
  expect(await at(23, 52)).toBe('R');
  // one more lost wipf
  const n = await page.evaluate(() => window.__editor.L.objects.length);
  await page.selectOption('#objType', { label: 'Wipf (eingeschlossen)' });
  await page.mouse.click(...px(60, 33));
  expect(await page.evaluate(() => window.__editor.L.objects.length)).toBe(n + 1);
  // play it: the game starts with the draft (rock where it was painted, five lost wipfs)
  await page.click('#playBtn');
  await page.waitForFunction(() => window.__ww && window.__ww.state === 'play');
  const game = await page.evaluate(() => {
    const w = window.__ww;
    return { mode: w.G.mode, lost: w.animals.filter(a => a.lost).length, rock: w.world.mat[210 * 800 + 92] };
  });
  expect(game).toEqual({ mode: 'wipfrettung', lost: 5, rock: 2 });
  // and back to the editor, with the draft
  await page.click('text=← Editor');
  await page.waitForFunction(() => window.__editor && window.__editor.grid);
  expect(await at(23, 52)).toBe('R');
  expect(errors).toEqual([]);
});
