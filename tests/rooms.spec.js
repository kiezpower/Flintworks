// Playing without a code: "quick play" puts strangers into the same open room, the list shows
// open rooms, a room for friends stays hidden. Runs a relay of its own (server/relay.js): npm test
import { spawn } from 'node:child_process';
import { expect, test } from '@playwright/test';

const PORT = 8791;
let relay;
test.beforeAll(async () => {
  relay = spawn(process.execPath, ['server/relay.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
  await new Promise(ok => relay.stdout.once('data', ok));
});
test.afterAll(() => relay?.kill());

async function player(browser, name) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/?mp=ws://localhost:${PORT}`);
  await page.evaluate(n => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: n }));
  }, name);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.locator('#lbSlot1').click();
  await expect(page.locator('#lbQuick')).toBeVisible();
  return { page, errors };
}

test.describe.configure({ mode: 'serial' });

test('quick play brings two strangers into one room, friends rooms stay hidden', async ({ browser }) => {
  const a = await player(browser, 'Anna');
  const b = await player(browser, 'Bert');
  const c = await player(browser, 'Cleo');

  // nobody there yet: the list says so
  await expect(a.page.locator('#lbRooms')).toContainText('kein Raum offen');

  // a room for friends does not show up in the list
  await c.page.waitForTimeout(500);
  await c.page.locator('#lbCreate').click();
  await expect(c.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);

  // Anna plays quick: nothing open, so she opens a room
  await a.page.waitForTimeout(500);
  await a.page.locator('#lbQuick').click();
  await expect(a.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  const code = await a.page.locator('.lb-codetap b').textContent();

  // Bert sees exactly Anna's room in the list (not Cleo's)
  await expect(b.page.locator('#lbRooms .opt')).toHaveCount(1, { timeout: 8000 });
  await expect(b.page.locator('#lbRooms')).toContainText('Raum von Anna');
  // quick play takes him in without a code
  await b.page.locator('#lbQuick').click();
  await expect(b.page.locator('.lb-codetap b')).toHaveText(code);
  await expect(a.page.locator('.lb-players')).toContainText('Bert');

  // the host closes the room: it leaves the list, quick play opens a new one
  await a.page.waitForTimeout(500);
  await a.page.locator('.opt', { hasText: 'Offener Raum' }).click();
  await expect(a.page.locator('.opt', { hasText: 'Offener Raum' })).toContainText('Nur mit Code');
  const d = await player(browser, 'Dora');
  await d.page.waitForTimeout(3500);
  await expect(d.page.locator('#lbRooms .opt')).toHaveCount(0);
  await d.page.locator('#lbQuick').click();
  await expect(d.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  expect(await d.page.locator('.lb-codetap b').textContent()).not.toBe(code);

  for (const p of [a, b, c, d]) expect(p.errors).toEqual([]);
  for (const p of [a, b, c, d]) await p.page.close();
});

test('a quick play room counts down and starts the mode of the hour by itself', async ({ browser }) => {
  const e = await player(browser, 'Emil');
  const f = await player(browser, 'Fine');
  await e.page.waitForTimeout(500);
  await e.page.locator('#lbQuick').click();
  await expect(e.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  // alone: waiting for somebody, the mode of the hour is shown
  await expect(e.page.locator('#mpCountdown')).toContainText('Warte auf Mitspieler');
  await f.page.waitForTimeout(500);
  await f.page.locator('#lbQuick').click();
  await expect(f.page.locator('.lb-codetap b')).toHaveText(await e.page.locator('.lb-codetap b').textContent());
  // two players: the countdown runs for both
  await expect(e.page.locator('#mpCountdown')).toContainText('Nächste Runde in');
  await expect(f.page.locator('#mpCountdown')).toContainText('Nächste Runde in');
  // the guest is ready: it starts within a few seconds, nobody pressed "Spielen"
  await f.page.waitForTimeout(500);
  await f.page.locator('.opt', { hasText: 'Bereit?' }).click();
  for (const p of [e, f])
    await p.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.net, null, { timeout: 8000 });
  const modes = await Promise.all([e, f].map(p => p.page.evaluate(() => window.__ww.G.mode)));
  expect(modes[0]).toBe(modes[1]);
  await expect(e.page.locator('#mpCountdown')).toBeHidden();
  for (const p of [e, f]) expect(p.errors).toEqual([]);
});
