import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';

// Every parallel worker owns its relay; another worker's afterAll must not close its room.
let PORT, relay;
test.beforeAll(async ({}, worker) => {
  PORT = 19000 + worker.workerIndex;
  const r = startRelay(PORT);
  relay = r.relay;
  await r.ready;
});
test.afterAll(() => relay?.kill());
async function lobby(page, extra = {}) {
  await page.goto(`/?mp=ws://localhost:${PORT}`);
  await page.evaluate(extra => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', playKind: null, ...extra }));
  }, extra);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
}
async function choose(page, kind, id) {
  await page.click('#lbKind');
  await page.click(`.ls-kind[data-kind="${kind}"]`);
  await page.locator(`.ls-card[data-id="${id}"]`).first().click();
  await page.click('.ls-go');
}
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
  test(`mode first, filters, locks and solo start at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await lobby(page, { campaign: { c1: 2 }, campaignTime: { c1: 120 } });
    await page.click('#lbPlay');
    await expect(page.locator('#levelsel')).toHaveClass('choose-kind');
    await expect(page.locator('.ls-card')).toHaveCount(0);
    for (const kind of ['coop', 'versus', 'solo']) {
      await page.click(`.ls-kind[data-kind="${kind}"]`);
      const ids = await page.locator('.ls-card').evaluateAll(cs => cs.map(c => c.dataset.id));
      if (kind === 'solo') {
        expect(ids).toContain('c2');
        expect(ids).not.toContain('festungssturm');
        await expect(page.locator('.ls-sec[data-s="rec"] .next')).toContainText('Hier geht’s weiter');
      } else {
        expect(ids).not.toContain('c1');
        expect(ids).not.toContain('daily');
        expect(ids.includes('expedition')).toBe(kind === 'coop');
        expect(ids.includes('festungssturm')).toBe(kind === 'versus');
        expect(ids).toContain('zweiburgen');
        await expect(page.locator('.ls-card[data-id="gold"] .ls-players')).toHaveText('2–8 Spieler');
      }
    }
    await page.locator('.ls-card[data-id="c3"]').click();
    await expect(page.locator('.ls-go')).toBeDisabled();
    await expect(page.locator('.ls-go')).toContainText('Erst 1 Stern');
    await page.click('.ls-back');
    await page.locator('.ls-sec[data-s="rec"] .ls-card[data-id="c2"]').click();
    await page.locator('.ls-go').scrollIntoViewIfNeeded();
    const bounds = await page.locator('.ls-go').boundingBox();
    expect(bounds.width).toBeGreaterThan(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    await page.click('.ls-go');
    await expect(page.locator('#lbKindTxt')).toContainText('Alleine');
    await expect(page.locator('#lbGModeTxt')).toContainText('2');
    expect(await page.evaluate(() => window.__ww.state)).toBe('menu');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')));
    expect(saved.campaign).toEqual({ c1: 2 });
    expect(saved.campaignTime).toEqual({ c1: 120 });
    await page.click('#lbPlay');
    await page.waitForFunction(() => window.__ww.state === 'play');
    expect(await page.evaluate(() => window.__ww.G.mode)).toBe('c2');
    expect(errors).toEqual([]);
  });
}
for (const kind of ['coop', 'versus']) {
  test(`${kind}: selection survives invitation, guest joins, host starts the same level`, async ({ browser }) => {
    const host = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await lobby(host, { name: 'Anna' });
    await lobby(guest, { name: 'Bert' });
    await choose(host, kind, kind === 'coop' ? 'expedition' : 'zweiburgen');
    if (kind === 'versus') {
      await host.reload();
      await host.waitForFunction(() => window.__ww);
      await host.click('#lbSlot1');
    } else await host.click('#lbPlay');
    await host.waitForFunction(() => performance.now() - window.__ww.G.panelT >= 500);
    await host.click('#lbCreate');
    const code = host.locator('.lb-codetap b');
    await expect(code).toHaveText(/^[A-Z0-9]{6}$/);
    await expect(host.locator('#pTitle')).toHaveText('Zusammen spielen');
    await guest.click('#lbSlot1');
    await guest.fill('#lbCodeIn', await code.textContent());
    await guest.click('#lbJoinBtn');
    await expect(host.locator('.lb-players')).toContainText('Bert');
    await expect(guest.locator('#lbKindTxt')).toContainText(kind === 'coop' ? 'Zusammen' : 'Gegeneinander');
    await expect(guest.locator('#lbKind')).toBeDisabled();
    await expect(guest.locator('#lbGModeTxt')).toContainText(kind === 'coop' ? 'Expedition' : 'Zwei Burgen');
    await guest.locator('.opt', { hasText: 'Bereit?' }).click();
    await host.locator('.opt', { hasText: 'Spiel starten' }).click();
    for (const page of [host, guest]) {
      await page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.net);
      expect(await page.evaluate(() => [window.__ww.G.mode, !!window.__ww.G.teams])).toEqual([
        kind === 'coop' ? 'expedition' : 'zweiburgen', kind === 'versus',
      ]);
      await page.close();
    }
  });
}
