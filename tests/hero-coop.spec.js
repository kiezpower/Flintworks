import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';

test('guest ability executes on the host and guest receives only its own mastery', async ({ browser }, worker) => {
  const port = 27300 + worker.workerIndex, relay = startRelay(port);
  await relay.ready;
  const host = await browser.newPage(), guest = await browser.newPage();
  const errors = [];
  try {
    for (const [page, name, hero] of [[host, 'Host', 'bruno'], [guest, 'Gast', 'anna']]) {
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({ name, hero }) => {
        localStorage.setItem('flintworks-lang', 'de');
        localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name,
          playKind: 'coop', gmode: 'gold', games: 3, hero }));
      }, { name, hero });
      await page.goto(`/?mp=ws://localhost:${port}`);
      await page.waitForFunction(() => window.__ww);
      await page.click('#lbTogether');
    }
    await host.click('#lbCreate');
    await expect(host.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
    await guest.fill('#lbCodeIn', await host.locator('.lb-codetap b').textContent());
    await guest.click('#lbJoinBtn');
    await expect(host.locator('.lb-players')).toContainText('Gast');
    await host.keyboard.press('Escape'); await host.click('#lbPlay');
    for (const page of [host, guest]) await page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.crew.length >= 2);
    await expect(guest.locator('#heroAbility')).toBeVisible();
    await guest.keyboard.press('r');
    await expect.poll(() => host.evaluate(() => window.__ww.crew.find(c => c.name === 'Gast').heroActive || 0)).toBeGreaterThan(0);
    await expect(guest.locator('#heroAbility')).toBeDisabled();
    // Only the host issues productive actions; the network must deliver the reward to its owner.
    await host.evaluate(async () => {
      const { heroEvent } = await import('/src/heroskills.js');
      heroEvent(window.__ww.crew.find(c => c.name === 'Gast'), 'dig', 350);
    });
    await expect.poll(() => guest.evaluate(async () => {
      const { P } = await import('/src/profile.js'); return P.heroMastery?.anna?.rewarded || 0;
    })).toBe(1);
    expect(await host.evaluate(async () => (await import('/src/profile.js')).P.heroMastery?.anna || null)).toBeNull();
    expect(errors).toEqual([]);
  } finally { await host.close(); await guest.close(); relay.relay.kill(); }
});
