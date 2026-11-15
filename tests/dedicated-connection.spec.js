import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';

test('a dedicated host pauses immediately when its relay connection disappears with players still recorded online', async ({ browser }) => {
  const relay = startRelay(8813); await relay.ready;
  const host = await browser.newPage(), guest = await browser.newPage();
  try {
    await host.addInitScript(() => {
      localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: 'Host', gmode: 'settlement' }));
      window.__flintWorldHost = { name: 'Verbindungstest', biome: 'meadow', diff: 'relaxed', public: false };
      window.__flintCheckpoint = async () => {};
      window.__flintHostError = message => { window.__hostFailure = message; };
    });
    await host.goto('/?mp=ws://localhost:8813');
    await host.waitForFunction(() => window.__flintHostReady);
    const code = await host.evaluate(() => window.__flintHostStatus().room);
    await guest.goto('/?mp=ws://localhost:8813');
    await guest.evaluate(() => localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: 'Freund' })));
    await guest.reload(); await guest.waitForFunction(() => window.__ww);
    await guest.evaluate(async code => (await import('/src/net/room.js')).joinRoom(code), code);
    await host.waitForFunction(() => window.__ww.G.netHost && !window.__ww.G.serverIdle);
    await host.evaluate(async () => {
      const { disconnect } = await import('/src/net/transport.js');
      disconnect('room'); disconnect('friends');
    });
    await host.waitForFunction(() => window.__ww.G.serverIdle);
    const before = await host.evaluate(() => window.__ww.G.frame);
    await host.waitForTimeout(150);
    const after = await host.evaluate(async () => ({ frame: window.__ww.G.frame,
      recordedOnline: (await import('/src/net/room.js')).NET.players.some(p => p.online && !p.watch && !p.serverHost) }));
    expect(after).toEqual({ frame: before, recordedOnline: true });
  } finally { await guest.close(); await host.close(); relay.relay.kill(); }
});
