// "Spielen" on the start screen, then skip the story intro like a player would (any key after
// the first half second): the tutorial world is running afterwards.
export async function playPastIntro(page) {
  await page.click('#veilGo');
  // (a saved tutorial goes on without the intro)
  const intro = await page
    .locator('.introSkip')
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true, () => false);
  if (intro) {
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
  }
  await page.waitForFunction(() => window.__ww.G.state === 'play' && !document.querySelector('.introSkip:not([hidden])')?.offsetParent, null, { timeout: 10000 });
}
