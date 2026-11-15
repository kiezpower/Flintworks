import { expect, test } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startRelay } from './relayproc.js';

test.setTimeout(180000);
let relay;
test.beforeAll(async () => {
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'pipe' });
  relay = startRelay(8803); await relay.ready;
});
test.afterAll(() => relay?.relay.kill());
function host(dir) {
  const proc = spawn(process.execPath, ['server/world-host.mjs'], {
    env: { ...process.env, WORLD_DATA_DIR: dir, WORLD_RELAY_URL: 'ws://127.0.0.1:8803', WORLD_NAME: 'Dauerberg', WORLD_DIFFICULTY: 'relaxed' }, stdio: 'pipe',
  });
  let errors = '', output = '';
  proc.stderr.on('data', d => errors += d);
  const exited = new Promise(resolve => proc.once('exit', code => resolve(code)));
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Host startup timed out: ' + errors)), 60000);
    proc.stdout.on('data', d => {
      output += d;
      for (const line of output.split('\n')) {
        try { const v = JSON.parse(line); if (v.ready) { clearTimeout(timer); resolve(v); } } catch {}
      }
    });
    proc.once('exit', code => { clearTimeout(timer); reject(new Error(`Host exited ${code}: ${errors}`)); });
  });
  const stop = async () => { proc.kill('SIGTERM'); const code = await exited; if (code !== 0) throw new Error('Host shutdown failed: ' + errors); return code; };
  return { proc, ready, exited, stop };
}

test('a dedicated production world survives a restart, keeps its code and allows friends to return without the original player', async ({ browser }) => {
  const dir = await mkdtemp(join(tmpdir(), 'flintworld-'));
  let h = host(dir);
  const page = await browser.newPage();
  try {
    const first = await h.ready;
    expect((await fetch(`http://127.0.0.1:${first.healthPort}/health`)).status).toBe(200);
    await page.goto('/?mp=ws://localhost:8803');
    await page.evaluate(() => {
      localStorage.setItem('flintworks-lang', 'de');
      localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: 'Freund', gmode: 'settlement' }));
    });
    await page.reload(); await page.waitForFunction(() => window.__ww);
    await page.evaluate(async code => (await import('/src/net/room.js')).joinRoom(code), first.room);
    await page.waitForFunction(() => window.__ww.G.netClient && window.__ww.G.worldName === 'Dauerberg');
    const mine = await page.evaluate(async () => {
      const w = window.__ww;
      const { NET } = await import('/src/net/room.js');
      const c = w.crew.find(c => c.pid === w.G.myId);
      return { id: c.id, owner: c.owner, world: w.G.worldId, players: NET.players.length };
    });
    expect(mine.players).toBe(1); // the server is not presented as a human companion
    await page.evaluate(async () => (await import('/src/net/room.js')).leaveRoom());
    expect(await h.stop()).toBe(0);
    const saved = JSON.parse(await readFile(join(dir, 'world.json'), 'utf8'));
    expect(saved.id).toBe(mine.world);
    expect(saved.save.data.crew.find(c => c.owner === mine.owner).id).toBe(mine.id);
    h = host(dir);
    const second = await h.ready;
    expect(second.room).toBe(first.room);
    const resumed = JSON.parse(await readFile(join(dir, 'world.json'), 'utf8'));
    expect(resumed.save.data.world).toBe(saved.save.data.world);
    expect(resumed.save.data.playTicks).toBe(saved.save.data.playTicks); // empty worlds pause
    await page.reload(); await page.waitForFunction(() => window.__ww);
    await page.evaluate(async code => (await import('/src/net/room.js')).joinRoom(code), second.room);
    await page.waitForFunction(() => window.__ww.G.netClient && window.__ww.G.worldName === 'Dauerberg');
    await expect.poll(() => page.evaluate(() => {
      const w = window.__ww; const c = w.crew.find(c => c.pid === w.G.myId); return c?.owner;
    })).toBe(mine.owner);
    expect(await page.evaluate(() => window.__ww.G.worldId)).toBe(mine.world);
    await page.evaluate(async () => (await import('/src/net/room.js')).leaveRoom());
    expect(await h.stop()).toBe(0);
    expect(JSON.parse(await readFile(join(dir, 'world.json.bak'), 'utf8')).id).toBe(mine.world);
  } finally {
    if (h.proc.exitCode == null) await h.stop();
    await page.close(); await rm(dir, { recursive: true, force: true });
  }
});
