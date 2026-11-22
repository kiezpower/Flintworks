import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';
let relay;
test.beforeAll(async () => { const r = startRelay(8801); relay = r.relay; await r.ready; });
test.afterAll(() => relay?.kill());
async function open(page, kind = 'solo') {
  await page.goto('/?mp=ws://localhost:8801');
  await page.evaluate(kind => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', gmode: 'fluffelstollen', playKind: kind }));
  }, kind);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
}
// Reach the real rescue trigger with a player's digger, without simulating the
// entire digging route. Terrain accessibility is checked by levels.spec.js.
const rescue = ([pid, count]) => {
  const w = window.__ww, c = w.crew.find(c => c.pid === pid);
  // Keep the remaining animals away from all diggers while directing this rescue.
  // Otherwise wandering animals can meet the other player during the test ticks.
  const lost = w.animals.filter(a => a.lost);
  const waiting = lost.slice(count).map(a => ({ a, x: a.x, y: a.y }));
  for (const { a } of waiting) a.lost = false;
  for (const a of lost.slice(0, count))
    for (let k = 0; k < 60 && a.lost; k++) {
      Object.assign(c, { x: a.x, y: a.y - 6, vx: 0, vy: 0 });
      w.step(1);
    }
  for (const { a, x, y } of waiting) Object.assign(a, { x, y, lost: true });
  return { rescued: w.G.rescued, lost: w.animals.filter(a => a.lost).length, state: w.G.state };
};
test('the mobile selection offers Fluffelstollen for solo and co-op, with a loaded preview, but not Versus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.click('#lbGMode');
  for (const kind of ['solo', 'coop']) {
    await page.click(`[data-kind="${kind}"]`);
    const card = page.locator('.ls-card[data-id="fluffelstollen"]');
    await expect(card).toContainText('Rettet 6 Fluffel');
    await expect(card.locator('.ls-players')).toHaveText(kind === 'solo' ? '1 Spieler' : '2–8 Spieler');
    await expect(card.locator('.ls-pv img')).toBeAttached();
    await expect.poll(() => card.locator('.ls-pv img').evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
  }
  await page.click('[data-kind="versus"]');
  await expect(page.locator('.ls-card[data-id="fluffelstollen"]')).toHaveCount(0);
});
test('solo: six reachable fluffels, saved half-way progress and an actual rescue win', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await open(page);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => [window.__ww.world.W, window.__ww.world.H, window.__ww.animals.filter(a => a.lost).length])).toEqual([1200, 420, 6]);
  expect(await page.evaluate(() => window.__ww.G.evRate)).toBe(0);
  const pid = await page.evaluate(() => window.__ww.G.myId);
  expect(await page.evaluate(rescue, [pid, 3])).toMatchObject({ rescued: 3, lost: 3, state: 'play' });
  await page.evaluate(() => window.__ww.save());
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#lbPlayTxt')).toHaveText('Weiterspielen');
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.G.rescued])).toEqual(['fluffelstollen', 3]);
  expect(await page.evaluate(rescue, [pid, 3])).toMatchObject({ rescued: 6, lost: 0, state: 'won' });
  expect(errors).toEqual([]);
});
test('co-op: both players contribute to the same six-fluffel goal and win together', async ({ browser }) => {
  const host = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  for (const p of [host, guest]) p.on('pageerror', e => errors.push(e.message));
  try {
    await open(host, 'coop'); await open(guest, 'coop');
    await host.click('#lbPlay'); await host.click('#lbCreate');
    await expect(host.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/, { timeout: 15_000 });
    await guest.click('#lbSlot1');
    await guest.fill('#lbCodeIn', await host.locator('.lb-codetap b').textContent());
    await guest.click('#lbJoinBtn');
    await expect(host.locator('.lb-players .opt')).toHaveCount(2);
    await guest.locator('.opt', { hasText: 'Bereit?' }).click();
    await host.locator('.opt', { hasText: 'Spiel starten' }).click();
    for (const p of [host, guest]) await p.waitForFunction(() => window.__ww.G.net && window.__ww.G.state === 'play');
    const own = await host.evaluate(() => window.__ww.G.myId);
    const other = await guest.evaluate(() => window.__ww.G.myId);
    expect(await host.evaluate(rescue, [own, 3])).toMatchObject({ rescued: 3, state: 'play' });
    await expect(guest.locator('#goalTxt')).toContainText('3/6');
    expect(await host.evaluate(rescue, [other, 2])).toMatchObject({ rescued: 5, state: 'play' });
    await expect(guest.locator('#goalTxt')).toContainText('5/6');
    expect(await host.evaluate(rescue, [other, 1])).toMatchObject({ rescued: 6, state: 'won' });
    await guest.waitForFunction(() => window.__ww.G.state === 'won');
    expect(errors).toEqual([]);
  } finally { await host.close(); await guest.close(); }
});
