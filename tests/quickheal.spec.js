// Quick heal (potions.js): a key, the gamepad's right stick or the heart button drinks the first
// healing potion in the bag, whatever is chosen: npm test
import { expect, test } from '@playwright/test';

test('H drinks the healing potion; without one a note; the heart button shows only with one', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, diff: 'relaxed' }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const me = () => 'window.__ww.crew.find(c => c.pid === window.__ww.G.myId)';
  // a potion in the bag, loam chosen: H drinks the potion anyway
  await page.evaluate(m => {
    const c = eval(m);
    c.inv = ['loam', 'potHeal'];
    c.isel = 0;
    c.energy = 30;
  }, me());
  await expect(page.locator('#btns')).toHaveClass(/healon/);
  await page.keyboard.press('KeyH');
  await page.waitForTimeout(200);
  expect(await page.evaluate(m => [eval(m).energy, eval(m).inv], me())).toEqual([100, ['loam']]);
  await expect(page.locator('#btns')).not.toHaveClass(/healon/);
  // none left: a note
  await page.keyboard.press('KeyH');
  await expect(page.locator('#toast')).toContainText('Kein Heiltrank');
  // the gamepad's right stick, through the same command
  await page.evaluate(async m => {
    const { send } = await import('/src/commands.js');
    const c = eval(m);
    c.inv = ['potHeal'];
    c.energy = 40;
    send('quickheal', {});
  }, me());
  await page.waitForTimeout(200);
  expect(await page.evaluate(m => eval(m).energy, me())).toBe(100);
  expect(errors).toEqual([]);
});
