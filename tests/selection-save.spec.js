import { expect, test } from '@playwright/test';

test('an existing solo save resumes its world and keeps setup locked until it is discarded', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    // A profile made before playKind existed.
    localStorage.setItem('flintworks-profile', JSON.stringify({
      tutorialDone: true, installAsked: 'done', name: 'Kurt', gmode: 'gold',
      campaign: { c1: 2 }, campaignTime: { c1: 120 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#lbKindTxt')).toContainText('Alleine');
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  await page.evaluate(() => {
    window.__ww.G.money = 777;
    window.__ww.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#lbKind')).toBeDisabled();
  await expect(page.locator('#lbGMode')).toBeDisabled();
  await expect(page.locator('#lbPlayTxt')).toHaveText('Weiterspielen');
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.G.money])).toEqual(['gold', 777]);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')));
  expect(saved.campaign).toEqual({ c1: 2 });
  expect(saved.campaignTime).toEqual({ c1: 120 });
});

test('a saved Versus round can still be resumed from an invitation room while alone', async ({ browser }) => {
  const { startRelay } = await import('./relayproc.js');
  const r = startRelay(8800);
  await r.ready;
  const host = await browser.newPage();
  const guest = await browser.newPage();
  try {
    for (const [page, name] of [[host, 'Anna'], [guest, 'Bert']]) {
      await page.goto('/?mp=ws://localhost:8800');
      await page.evaluate(name => {
        localStorage.clear();
        localStorage.setItem('flintworks-lang', 'de');
        localStorage.setItem('flintworks-profile', JSON.stringify({
          tutorialDone: true, installAsked: 'done', name, playKind: 'versus', gmode: 'zweiburgen',
        }));
      }, name);
      await page.reload();
      await page.waitForFunction(() => window.__ww);
    }
    async function create() {
      await host.click('#lbPlay');
      await host.waitForFunction(() => performance.now() - window.__ww.G.panelT >= 500);
      await host.click('#lbCreate');
      await expect(host.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{5}$/);
    }
    await create();
    await guest.click('#lbSlot1');
    await guest.fill('#lbCodeIn', await host.locator('.lb-codetap b').textContent());
    await guest.click('#lbJoinBtn');
    await expect(host.locator('.pt-grid')).toContainText('Bert');
    await host.locator('.pt-go', { hasText: 'Spiel starten' }).click();
    await host.waitForFunction(() => window.__ww.G.net && window.__ww.G.state === 'play');
    await host.evaluate(async () => (await import('/src/net/netsave.js')).saveNet());
    expect(await host.evaluate(() => !!localStorage.getItem('flintworks-netsave'))).toBe(true);
    await guest.close();
    await host.reload();
    await host.waitForFunction(() => window.__ww);
    await create();
    await host.locator('.opt', { hasText: 'Gespeicherte Runde fortsetzen' }).click();
    await host.waitForFunction(() => window.__ww.G.net && window.__ww.G.state === 'play');
    expect(await host.evaluate(() => [window.__ww.G.mode, !!window.__ww.G.teams])).toEqual(['zweiburgen', true]);
  } finally {
    await host.close();
    if (!guest.isClosed()) await guest.close();
    r.relay.kill();
  }
});
