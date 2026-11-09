// Load check for a full room (only on demand: MPLOAD=1 npx playwright test tests/mpload.spec.js
// --workers 1): 2 and 8 players in one room against a relay of its own, everybody walks for 10 s;
// prints what the host sends and a guest receives per second, the frame rates and how long a tick
// of the host takes. Numbers of v1.85.1 in docs/MULTIPLAYER_PLAN.md.
import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';
const PORT = 8799;
let relay;
test.beforeAll(async () => { const r = startRelay(PORT); relay = r.relay; await r.ready; });
test.afterAll(() => relay?.kill());
test.setTimeout(300000);
test.skip(!process.env.MPLOAD, 'only on demand: MPLOAD=1');
async function player(browser, name) {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.__tx = 0; window.__rx = 0;
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) { window.__tx += d.length || d.byteLength || 0; return send.call(this, d); };
    const C = window.WebSocket;
    window.WebSocket = function (...a) { const ws = new C(...a); ws.addEventListener('message', e => (window.__rx += e.data.length || e.data.byteLength || 0)); return ws; };
    window.WebSocket.prototype = C.prototype; Object.assign(window.WebSocket, C);
  });
  await page.goto(`/?mp=ws://localhost:${PORT}`);
  await page.evaluate(n => { localStorage.clear(); localStorage.setItem('flintworks-lang', 'de'); localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: n, games: 3 })); }, name);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.locator('#lbSlot1').click();
  await expect(page.locator('#lbQuick')).toBeVisible();
  return page;
}
for (const N of [2, 8]) test(`load ${N}`, async ({ browser }) => {
  const ps = [];
  for (let k = 0; k < N; k++) ps.push(await player(browser, 'P' + k));
  const [h, ...rest] = ps;
  await h.locator('#lbCreate').click();
  await expect(h.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  const code = await h.locator('.lb-codetap b').textContent();
  for (const p of rest) { await p.waitForTimeout(300); await p.locator('#lbCodeIn').fill(code); await p.locator('#lbJoinBtn').click(); }
  await expect(h.locator('.lb-players')).toContainText('P' + (N - 1), { timeout: 15000 });
  for (const p of rest) { await p.waitForTimeout(300); await p.locator('.opt', { hasText: 'Bereit?' }).click(); }
  await h.locator('.opt', { hasText: 'Spiel starten' }).click();
  for (const p of ps) await p.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.net, null, { timeout: 30000 });
  await h.waitForTimeout(3000);
  // everybody walks around and digs for 10 s
  for (const p of ps) await p.evaluate(() => { let d = 1; window.__walk = setInterval(() => { d = Math.random() < 0.3 ? -d : d; window.dispatchEvent(new KeyboardEvent('keydown', { code: d > 0 ? 'ArrowRight' : 'ArrowLeft' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: d > 0 ? 'ArrowLeft' : 'ArrowRight' })); }, 700); });
  // (bytes counted on the sockets, frames from the game's own counter)
  const t0 = await Promise.all(ps.map(p => p.evaluate(() => [window.__tx, window.__rx, window.__ww.G.frame])));
  // host tick time: time step() over a while
  await h.evaluate(() => { window.__st = []; const w = window.__ww; window.__probe = setInterval(() => { const a = performance.now(); w.step(1); window.__st.push(performance.now() - a); }, 250); });
  await h.waitForTimeout(10000);
  await h.evaluate(() => clearInterval(window.__probe));
  const t1 = await Promise.all(ps.map(p => p.evaluate(() => [window.__tx, window.__rx, window.__ww.G.frame])));
  const st = await h.evaluate(() => { const s = window.__st.sort((a, b) => a - b); return { med: s[s.length >> 1], p90: s[Math.floor(s.length * 0.9)] }; });
  const kb = (a, b) => Math.round((b - a) / 1024 / 10 * 10) / 10;
  console.log(JSON.stringify({ N, hostTxKBs: kb(t0[0][0], t1[0][0]), guestRxKBs: kb(t0[1][1], t1[1][1]), hostFps: Math.round((t1[0][2] - t0[0][2]) / 10), guestFps: Math.round((t1[1][2] - t0[1][2]) / 10), stepMs: st, crew: await h.evaluate(() => window.__ww.crew.length) }));
  for (const p of ps) await p.close();
});
