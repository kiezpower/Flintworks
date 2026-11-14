import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';
test.describe.configure({ mode: 'serial' });
let relay;
test.beforeAll(async () => { const r = startRelay(8802); relay = r.relay; await r.ready; });
test.afterAll(() => relay?.kill());
async function open(page, kind = 'solo') {
  await page.goto('/?mp=ws://localhost:8802');
  await page.evaluate(kind => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', playKind: kind, gmode: 'gipfelrennen', autodig: false }));
  }, kind);
  await page.reload(); await page.waitForFunction(() => window.__ww);
}
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }])
  test(`selection and preview at ${viewport.width}×${viewport.height}: solo, co-op and Versus`, async ({ page }) => {
    await page.setViewportSize(viewport); await open(page); await page.click('#lbGMode');
    for (const kind of ['solo', 'coop', 'versus']) {
      await page.click(`[data-kind="${kind}"]`);
      const card = page.locator('.ls-card[data-id="gipfelrennen"]');
      await expect(card).toContainText('Erreiche die Bergspitze');
      await expect(card.locator('.ls-players')).toHaveText(kind === 'solo' ? '1 Spieler' : '2–8 Spieler');
      await expect.poll(() => card.locator('.ls-pv img').evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
    }
  });
test('solo: the summit is reached by walking, with mirrored terrain and no equipment', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page); await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const symmetric = await page.evaluate(() => {
    const w = window.__ww;
    w.crew.find(c => c.pid === w.G.myId).inv = [];
    return [...w.world.surf].every((y, x, s) => y === s[s.length - 1 - x]);
  });
  expect(symmetric).toBe(true);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__ww.G.state === 'won', null, { timeout: 60000 });
  await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => !!window.__ww.G.lvl?.reached['0:gipfel'])).toBe(true);
  expect(errors).toEqual([]);
});
for (const [kind, winner] of [['versus', 'host'], ['versus', 'guest'], ['coop', 'guest']])
  test(`${kind}: ${winner} reaches the summit, with correct results on both devices`, async ({ browser }) => {
    const host = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; for (const p of [host, guest]) p.on('pageerror', e => errors.push(e.message));
    try {
      await open(host, kind); await open(guest, kind);
      await host.click('#lbPlay'); await host.click('#lbCreate');
      await expect(host.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
      await guest.click('#lbSlot1'); await guest.fill('#lbCodeIn', await host.locator('.lb-codetap b').textContent());
      await guest.click('#lbJoinBtn'); await expect(host.locator('.lb-players .opt')).toHaveCount(2);
      await guest.locator('.opt', { hasText: 'Bereit?' }).click();
      await host.locator('.opt', { hasText: 'Spiel starten' }).click();
      for (const p of [host, guest]) await p.waitForFunction(() => window.__ww.G.net && window.__ww.G.state === 'play');
      expect(await host.evaluate(() => ({ teams: window.__ww.G.teams?.length || 0, minutes: window.__ww.G.mp.len / 3600 || 0 }))).toEqual({ teams: kind === 'versus' ? 2 : 0, minutes: kind === 'versus' ? 4 : 0 });
      // Walk from the real team spawn using normal keyboard/client input.
      const racer = winner === 'host' ? host : guest;
      const key = kind === 'versus' && winner === 'guest' ? 'ArrowLeft' : 'ArrowRight';
      await racer.keyboard.down(key);
      const hostState = kind === 'coop' || winner === 'host' ? 'won' : 'lost';
      const guestState = kind === 'coop' || winner === 'guest' ? 'won' : 'lost';
      await host.waitForFunction(state => window.__ww.G.state === state, hostState, { timeout: 60000 });
      await guest.waitForFunction(state => window.__ww.G.state === state, guestState, { timeout: 60000 });
      await racer.keyboard.up(key);
      expect(errors).toEqual([]);
    } finally { await host.close(); await guest.close(); }
  });
