// The landscape over the network (net/terrain.js): the host sends only the changed cells of a
// chunk when every guest understands that, and whole chunks to an older guest; either way host
// and guest end up with the same ground. Runs a relay of its own (server/relay.js): npm test
import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';

const PORT = 8797;
let relay;
test.beforeAll(async () => {
  const r = startRelay(PORT);
  relay = r.relay;
  await r.ready;
});
test.afterAll(() => relay?.kill());
test.describe.configure({ mode: 'serial' });

// old: this guest strips the "td" flag from what it sends, like a version before the diffs
async function player(browser, name, { old = false } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(old => {
    window.__ter = { diff: 0, whole: 0 };
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) {
      if (old && typeof d === 'string' && d.includes('"td"')) d = d.replace(/,"td":1/, '');
      return send.call(this, d);
    };
    const C = window.WebSocket;
    window.WebSocket = function (...a) {
      const ws = new C(...a);
      ws.addEventListener('message', e => {
        if (typeof e.data !== 'string' || !e.data.includes('"ter"')) return;
        for (const s of e.data.match(/"[~A-Za-z0-9+/=]{2,}"/g) || []) window.__ter[s[1] === '~' ? 'diff' : 'whole']++;
      });
      return ws;
    };
    window.WebSocket.prototype = C.prototype;
    Object.assign(window.WebSocket, C);
  }, old);
  await page.goto(`/?mp=ws://localhost:${PORT}`);
  await page.evaluate(n => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: n, games: 3 }));
  }, name);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.locator('#lbSlot1').click();
  await expect(page.locator('#lbQuick')).toBeVisible();
  return { page, errors };
}
async function room(browser, guestOpts) {
  const h = await player(browser, 'Hanna');
  const g = await player(browser, 'Gus', guestOpts);
  await h.page.locator('#lbCreate').click();
  await expect(h.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  const code = await h.page.locator('.lb-codetap b').textContent();
  await g.page.locator('#lbCodeIn').fill(code);
  await g.page.locator('#lbJoinBtn').click();
  await expect(h.page.locator('.lb-players')).toContainText('Gus', { timeout: 15000 });
  await g.page.locator('.opt', { hasText: 'Bereit?' }).click();
  await h.page.locator('.opt', { hasText: 'Spiel starten' }).click();
  for (const p of [h, g]) await p.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.net, null, { timeout: 30000 });
  // (past the first seconds, in which the host sends whole chunks anyway)
  await h.page.waitForFunction(() => window.__ww.G.frame > 400, null, { timeout: 20000 });
  return { h, g };
}
// the host digs short tunnels into several chunks, cell by cell, like a Wühler would
const dig = page =>
  page.evaluate(() => {
    const { mat, bg, W, surf, paint, AIR, SOLID, GRANITE } = window.__ww.world;
    let n = 0;
    for (let k = 0; k < 6; k++) {
      const x0 = 200 + k * 70,
        y0 = surf[x0] + 20;
      for (let x = x0; x < x0 + 8; x++)
        for (let y = y0; y < y0 + 4; y++) {
          const i = y * W + x;
          if (!SOLID[mat[i]] || mat[i] === GRANITE) continue;
          mat[i] = AIR;
          bg[i] = 1;
          paint(i);
          n++;
        }
    }
    return n;
  });
// a checksum of the solid ground and the dug background (liquids slosh about on their own)
const ground = page =>
  page.evaluate(() => {
    const { mat, bg, W, H, SOLID } = window.__ww.world;
    let h = 0;
    for (let i = 0; i < W * H; i++) h = (Math.imul(h, 31) + (SOLID[mat[i]] ? mat[i] : 0) + (bg[i] << 4)) >>> 0;
    return h;
  });

test('a guest that knows the diffs gets only the changed cells, and has the same ground', async ({ browser }) => {
  const { h, g } = await room(browser);
  const before = await g.page.evaluate(() => ({ ...window.__ter }));
  expect(await dig(h.page)).toBeGreaterThan(50);
  await expect.poll(async () => (await ground(g.page)) === (await ground(h.page)), { timeout: 10000 }).toBe(true);
  const after = await g.page.evaluate(() => ({ ...window.__ter }));
  expect(after.diff - before.diff).toBeGreaterThan(0);
  for (const p of [h, g]) expect(p.errors).toEqual([]);
  for (const p of [h, g]) await p.page.close();
});

test('an older guest without the diffs gets whole chunks and has the same ground', async ({ browser }) => {
  const { h, g } = await room(browser, { old: true });
  const before = await g.page.evaluate(() => ({ ...window.__ter }));
  expect(await dig(h.page)).toBeGreaterThan(50);
  await expect.poll(async () => (await ground(g.page)) === (await ground(h.page)), { timeout: 10000 }).toBe(true);
  const after = await g.page.evaluate(() => ({ ...window.__ter }));
  expect(after.diff).toBe(0);
  expect(after.whole - before.whole).toBeGreaterThan(0);
  for (const p of [h, g]) expect(p.errors).toEqual([]);
  for (const p of [h, g]) await p.page.close();
});
