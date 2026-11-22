import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';
async function open(page, name = 'Anna', port) {
  await page.goto(port ? `/?mp=ws://localhost:${port}` : '/');
  await page.evaluate(name => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name, gmode: 'settlement', playKind: 'solo', diff: 'relaxed' }));
  }, name);
  await page.reload(); await page.waitForFunction(() => window.__ww);
}

test('named worlds can be created, renamed, switched, exported and safely imported', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  await page.click('#lbWorlds');
  await page.getByText('Neue Siedlungswelt', { exact: true }).click();
  await page.fill('#worldName', 'Abendberg');
  await page.locator('#pBody').getByText('Alleine starten', { exact: true }).click();
  await page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.worldName === 'Abendberg');
  const first = await page.evaluate(async () => {
    const w = window.__ww; w.G.money = 1234; w.save(); await w.G.worldSavePending;
    const { listWorlds } = await import('/src/worldstore.js');
    return { id: w.G.worldId, count: (await listWorlds()).length };
  });
  expect(first.count).toBe(1);
  await page.click('#menuBtn');
  await page.locator('#pBody').getByText('Lobby', { exact: true }).click();
  await page.click('#lbWorlds');
  await page.locator('#pBody').getByText('Abendberg', { exact: true }).click();
  await page.fill('#worldName', 'Unser Berg');
  await page.getByText('Umbenennen', { exact: true }).click();
  await expect(page.locator('#worldName')).toHaveValue('Unser Berg');
  const download = page.waitForEvent('download');
  await page.getByText('Sicherung exportieren', { exact: true }).click();
  expect((await download).suggestedFilename()).toBe('flintworks-Unser_Berg.json');
  await page.evaluate(async () => {
    await window.__ww.G.createWorld({ name: 'Zweiter Berg', biome: 'winter' });
  });
  expect(await page.evaluate(async () => (await (await import('/src/worldstore.js')).listWorlds()).length)).toBe(2);
  await page.evaluate(async id => {
    const { readWorld } = await import('/src/worldstore.js');
    await window.__ww.G.loadWorld(await readWorld(id));
  }, first.id);
  expect(await page.evaluate(() => [window.__ww.G.worldName, window.__ww.G.money])).toEqual(['Unser Berg', 1234]);
  const checked = await page.evaluate(async id => {
    const s = await import('/src/worldstore.js');
    const { GAME_MODES } = await import('/src/modes.js');
    const original = await s.readWorld(id);
    const copied = await s.importWorld(s.exportWorld(original), Object.keys(GAME_MODES));
    const bad = JSON.parse(s.exportWorld(original));
    bad.save.data.w = 100000000;
    let rejected = false;
    try { await s.importWorld(JSON.stringify(bad), Object.keys(GAME_MODES)); } catch { rejected = true; }
    return { distinct: copied.id !== id, rejected, count: (await s.listWorlds()).length, money: window.__ww.G.money };
  }, first.id);
  expect(checked).toEqual({ distinct: true, rejected: true, count: 3, money: 1234 });
  expect(errors).toEqual([]);
});

test('a solo settlement resumes after reload from the archive reference', async ({ page }) => {
  await open(page);
  const id = await page.evaluate(async () => {
    const w = window.__ww;
    await w.G.createWorld({ name: 'Archivberg', biome: 'meadow' });
    w.G.money = 2345;
    w.save();
    await w.G.worldSavePending;
    return w.G.worldId;
  });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wuehlwelt-save-v1')))).toEqual({ archive: id });
  await page.reload();
  // (the slot only points to the world: the lobby still knows its name)
  await expect(page.locator('#lbPlayTxt')).toHaveText('Welt fortsetzen');
  await expect(page.locator('#lbResumeName')).toHaveText('Archivberg');
  await page.click('#lbPlay');
  expect(await page.evaluate(() => [window.__ww.G.worldId, window.__ww.G.money])).toEqual([id, 2345]);
});

test('a saved cooperative settlement reclaims inventory by identity after renaming and late joining', async ({ browser }, testInfo) => {
  const port = 19500 + testInfo.workerIndex;
  const relay = startRelay(port); await relay.ready;
  const a = await browser.newPage(), b = await browser.newPage(), c = await browser.newPage();
  try {
    await open(a, 'Gleicher Name', port); await open(b, 'Gleicher Name', port);
    await a.evaluate(() => window.__ww.room.createRoom());
    await a.waitForFunction(() => window.__ww.room.NET.room && window.__ww.room.NET.status === 'waiting');
    const code = await a.evaluate(() => window.__ww.room.NET.room);
    await b.evaluate(code => window.__ww.room.joinRoom(code), code);
    // Poll concrete state: an async predicate is a truthy Promise before the room is ready.
    await b.waitForFunction(code => window.__ww.room.NET.room === code && window.__ww.room.NET.status === 'waiting', code);
    await a.waitForFunction(() => window.__ww.room.NET.players.filter(p => p.online).length === 2);
    await a.evaluate(() => window.__ww.G.createWorld({ name: 'Freundesberg', biome: 'meadow' }));
    await b.waitForFunction(() => window.__ww.G.netClient && window.__ww.G.state === 'play');
    const ids = await a.evaluate(async () => {
      const { NET } = await import('/src/net/room.js');
      const others = NET.players.find(p => p.pid !== NET.pid);
      const c = window.__ww.crew.find(c => c.pid === others.pid); c.inv = ['tnt', 'flint', 'tnt'];
      (await import('/src/net/netsave.js')).saveNet(); await window.__ww.G.worldSavePending;
      return { world: window.__ww.G.worldId, owner: others.fid, entity: c.id };
    });
    // Everybody leaves, but their device storage (and secret identity) survives a reload.
    await b.reload(); await a.reload();
    await a.waitForFunction(() => window.__ww); await b.waitForFunction(() => window.__ww);
    await b.evaluate(async () => { const { P, saveProfile } = await import('/src/profile.js'); P.name = 'Neuer Name'; saveProfile(); });
    await a.evaluate(() => window.__ww.room.createRoom());
    await a.waitForFunction(() => window.__ww.room.NET.room && window.__ww.room.NET.status === 'waiting');
    const newCode = await a.evaluate(() => window.__ww.room.NET.room);
    await a.evaluate(async id => { const { readWorld } = await import('/src/worldstore.js'); await window.__ww.G.loadWorld(await readWorld(id)); }, ids.world);
    await b.evaluate(code => window.__ww.room.joinRoom(code), newCode);
    await b.waitForFunction(() => window.__ww.G.netClient && window.__ww.G.state === 'play');
    await a.waitForFunction(owner => window.__ww.crew.some(c => c.owner === owner && c.name === 'Neuer Name' && c.pid != null), ids.owner);
    const reclaimed = await a.evaluate(owner => {
      const c = window.__ww.crew.find(c => c.owner === owner);
      return { id: c.id, inv: c.inv, count: window.__ww.crew.filter(c => c.owner === owner).length };
    }, ids.owner);
    expect(reclaimed).toEqual({ id: ids.entity, inv: ['tnt', 'flint', 'tnt'], count: 1 });
    await open(c, 'Dritter Freund', port);
    await c.evaluate(code => window.__ww.room.joinRoom(code), newCode);
    await c.waitForFunction(() => window.__ww.G.netClient && window.__ww.G.worldName === 'Freundesberg');
    expect(await c.evaluate(() => window.__ww.G.mode)).toBe('settlement');
  } finally { await Promise.allSettled([a.close(), b.close(), c.close()]); relay.relay.kill(); }
});
