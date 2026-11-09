// Own volumes for effects, music and background sounds (settings.js, sound.js): npm test
import { expect, test } from '@playwright/test';

test('effects, music and ambience each have their own volume, kept in the profile', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done' }));
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbOpt');
  const fx = page.locator('#pBody .opt', { hasText: 'Effekte:' });
  await expect(fx).toContainText('Effekte: 100 %');
  await expect(page.locator('#pBody .opt', { hasText: 'Musik:' })).toContainText('Musik: 100 %');
  await expect(page.locator('#pBody .opt', { hasText: 'Umgebung:' })).toContainText('Umgebung: 100 %');
  await fx.click();
  await expect(page.locator('#pBody .opt', { hasText: 'Effekte:' })).toContainText('Effekte: 75 %');
  await page.locator('#pBody .opt', { hasText: 'Umgebung:' }).click();
  await expect(page.locator('#pBody .opt', { hasText: 'Umgebung:' })).toContainText('Umgebung: 75 %');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).vol)).toEqual({
    sfx: 0.75,
    amb: 0.75,
  });
  // the buses of the audio graph follow (when the browser gave the page an audio context)
  const gains = await page.evaluate(async () => {
    const G = window.__ww.G;
    if (!G.AC) return null;
    await new Promise(r => setTimeout(r, 400));
    return [G.SFX.gain.value, G.MUS.gain.value, G.AMB.gain.value].map(v => Math.round(v * 100) / 100);
  });
  if (gains) expect(gains).toEqual([0.75, 1, 0.75]);
  // four steps down, then back to full
  for (const want of ['50', '25', '0', '100']) {
    await page.locator('#pBody .opt', { hasText: 'Effekte:' }).click();
    await expect(page.locator('#pBody .opt', { hasText: 'Effekte:' })).toContainText(`Effekte: ${want} %`);
  }
  // after a reload the choice is still there
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbOpt');
  await expect(page.locator('#pBody .opt', { hasText: 'Umgebung:' })).toContainText('Umgebung: 75 %');
  expect(errors).toEqual([]);
});

test('the volume tiles are in English too', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'en');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done' }));
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbOpt');
  await expect(page.locator('#pBody .opt', { hasText: 'Effects:' })).toContainText('Effects: 100 %');
  await expect(page.locator('#pBody .opt', { hasText: 'Ambience:' })).toContainText('Volume of rain, wind');
});
