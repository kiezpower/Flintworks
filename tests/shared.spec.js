// Shared worlds (net/shared.js, server/relay.js): the owner shares a settlement world, the relay
// keeps its latest state on disk, and friends build on in turn – also while the owner is away
// and after the relay was restarted. Runs a relay of its own: npm test
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { startRelay } from './relayproc.js';

const PORT = 8788;
let relay, dir;
test.beforeAll(async () => {
  const r = startRelay(PORT);
  relay = r.relay;
  dir = r.dir;
  await r.ready;
});
test.afterAll(() => relay?.kill());
// (one relay for the file: the tests run one after the other)
test.describe.configure({ mode: 'serial' });

async function player(browser, name) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/?mp=ws://localhost:${PORT}`);
  await page.evaluate(n => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: n, gmode: 'settlement', playKind: 'solo', diff: 'relaxed' }));
  }, name);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#lbFriends')).toBeVisible();
  return { page, errors };
}
async function friendsPanel(page) {
  if (!(await page.locator('#frCodeIn').isVisible())) await page.locator('#lbFriends').click();
  await expect(page.locator('#frMyCode')).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/, { timeout: 8000 });
  return (await page.locator('#frMyCode').textContent()).trim();
}
async function befriend(a, b) {
  const code = await friendsPanel(a.page);
  await friendsPanel(b.page);
  await b.page.locator('#frCodeIn').fill(code);
  await b.page.locator('#frAddBtn').click();
  await expect(a.page.locator('#frAsks .fr-act.yes')).toHaveCount(1, { timeout: 8000 });
  await a.page.locator('#frAsks .fr-act.yes').first().click();
  await expect(b.page.locator('#frList')).toContainText('Im Menü', { timeout: 8000 });
  await a.page.locator('#pClose').click();
  await b.page.locator('#pClose').click();
}
const state = page => page.evaluate(() => ({ name: window.__ww.G.worldName, money: window.__ww.G.money, play: window.__ww.G.state === 'play', net: !!window.__ww.G.net, host: !!window.__ww.G.netHost }));
// back to the lobby and out of the room, with the latest state saved
async function leave(page) {
  await page.evaluate(async () => {
    const { saveNet } = await import('/src/net/netsave.js');
    saveNet();
    await window.__ww.G.worldSavePending;
  });
  await page.click('#menuBtn');
  await page.locator('#pBody').getByText('Lobby', { exact: true }).click();
  await page.evaluate(async () => (await import('/src/net/room.js')).leaveRoom());
}
const stored = () => readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));

test('a shared world is built on in turn: the friend while the owner is away, and after a relay restart', async ({ browser }) => {
  test.setTimeout(180_000);
  const anna = await player(browser, 'Anna');
  const bert = await player(browser, 'Bert');
  await befriend(anna, bert);

  // Anna builds a world alone and shares it
  await anna.page.evaluate(async () => {
    const w = window.__ww;
    await w.G.createWorld({ name: 'Unser Berg', biome: 'meadow' });
    w.G.money = 1234;
    w.save();
    await w.G.worldSavePending;
  });
  await anna.page.click('#menuBtn');
  await anna.page.locator('#pBody').getByText('Lobby', { exact: true }).click();
  await anna.page.click('#lbWorlds');
  await anna.page.locator('#pBody').getByText('Unser Berg', { exact: true }).click();
  await anna.page.getByText('Mit Freunden teilen', { exact: true }).click();
  await expect(anna.page.getByText('Nicht mehr teilen', { exact: true })).toBeVisible({ timeout: 10000 });
  await anna.page.locator('#pClose').click();
  await expect.poll(() => stored().map(w => [w.name, w.ownerName, w.by, w.members.length])).toEqual([['Unser Berg', 'Anna', 'Anna', 1]]);

  // Bert is told, finds it under his worlds and plays on from Anna's state, as host of his own room
  await expect(bert.page.locator('#lbWorlds')).toHaveClass(/alert/, { timeout: 10000 });
  await bert.page.click('#lbWorlds');
  await expect(bert.page.locator('#worldShared')).toContainText('Unser Berg');
  await expect(bert.page.locator('#worldShared')).toContainText('von Anna');
  await bert.page.locator('#worldShared').getByText('Unser Berg', { exact: true }).click();
  await bert.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.worldName === 'Unser Berg', null, { timeout: 30000 });
  expect(await state(bert.page)).toEqual({ name: 'Unser Berg', money: 1234, play: true, net: true, host: true });
  // Anna sees that somebody is in it right now
  await anna.page.click('#lbWorlds');
  await expect(anna.page.locator('#worldShared')).toContainText('1 bauen gerade', { timeout: 10000 });
  await anna.page.locator('#pClose').click();

  // Bert earns something and leaves: the relay has his state, Anna hears about it
  await bert.page.evaluate(() => (window.__ww.G.money = 2000));
  await leave(bert.page);
  await expect.poll(() => stored().map(w => [w.by, JSON.parse(w.save).data.money])).toEqual([['Bert', 2000]]);
  await expect(anna.page.locator('#lbWorlds')).toHaveClass(/alert/, { timeout: 10000 });
  await anna.page.click('#lbWorlds');
  await expect(anna.page.locator('#worldShared')).toContainText('zuletzt Bert', { timeout: 10000 });
  // … and goes on from there, not from her older copy on the device
  await anna.page.locator('#worldShared').getByText('Unser Berg', { exact: true }).click();
  await anna.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.net && window.__ww.G.money === 2000, null, { timeout: 30000 });
  await anna.page.evaluate(() => (window.__ww.G.money = 3000));
  await leave(anna.page);
  await expect.poll(() => stored().map(w => [w.by, JSON.parse(w.save).data.money])).toEqual([['Anna', 3000]]);

  // the owner is gone and the relay starts again: the world is still there for Bert
  await anna.page.close();
  relay.kill();
  await new Promise(r => setTimeout(r, 500));
  const again = startRelay(PORT, { SHARED_DIR: dir });
  relay = again.relay;
  await again.ready;
  await bert.page.click('#lbWorlds');
  await expect(bert.page.locator('#worldShared')).toContainText('zuletzt Anna', { timeout: 20000 });
  await bert.page.locator('#pClose').click();
  await bert.page.click('#lbWorlds');
  await bert.page.locator('#worldShared').getByText('Unser Berg', { exact: true }).click();
  await bert.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.money === 3000, null, { timeout: 30000 });

  expect(anna.errors).toEqual([]);
  expect(bert.errors).toEqual([]);
});

test('only the owner’s friends get a shared world, one world per owner, and only the room that plays it may save', async ({ browser }) => {
  const cleo = await player(browser, 'Cleo');
  const dora = await player(browser, 'Dora');
  const r = await cleo.page.evaluate(async () => {
    const w = window.__ww;
    await w.G.createWorld({ name: 'Cleos Tal', biome: 'winter' });
    const first = w.G.worldId;
    const sh = await import('/src/net/shared.js');
    const a = await sh.shareWorld(first);
    await w.G.createWorld({ name: 'Zweites Tal', biome: 'desert' });
    const b = await sh.shareWorld(w.G.worldId);
    return { first, a, b };
  });
  expect(r.a).toBe('ok');
  expect(r.b).toContain('Du teilst schon eine andere Welt');
  // Dora is no friend of Cleo's: the world is not in her list, and asking for it by id gets nothing
  const got = await dora.page.evaluate(async id => {
    const { on, send } = await import('/src/net/transport.js');
    const sh = await import('/src/net/shared.js');
    const fr = await import('/src/net/friends.js');
    fr.watchFriends(true);
    await new Promise(done => setTimeout(done, 2000));
    const out = [];
    on('werr', m => out.push(m.e));
    on('world', () => out.push('world'));
    send({ t: 'wopen', id });
    send({ t: 'wput', id, save: '{}' });
    send({ t: 'wunshare', id });
    await new Promise(done => setTimeout(done, 1500));
    return { list: sh.sharedWorlds().length, out };
  }, r.first);
  expect(got).toEqual({ list: 0, out: ['nope', 'nope'] });
  expect(stored().some(w => w.id === r.first && w.name === 'Cleos Tal')).toBe(true);
  // Cleo takes it off the server again
  await cleo.page.evaluate(async id => (await import('/src/net/shared.js')).unshareWorld(id), r.first);
  await expect.poll(() => stored().some(w => w.id === r.first)).toBe(false);
  expect(cleo.errors).toEqual([]);
  expect(dora.errors).toEqual([]);
});

test('a friend joins a shared world that is being played, and carries it on when the host leaves', async ({ browser }) => {
  test.setTimeout(180_000);
  const eva = await player(browser, 'Eva');
  const finn = await player(browser, 'Finn');
  await befriend(eva, finn);
  // Eva shares a world and plays it
  const id = await eva.page.evaluate(async () => {
    const w = window.__ww;
    await w.G.createWorld({ name: 'Evas Hof', biome: 'meadow' });
    const sh = await import('/src/net/shared.js');
    const id = w.G.worldId;
    if ((await sh.shareWorld(id)) !== 'ok') return null;
    await new Promise(done => setTimeout(done, 1500));
    return (await sh.openShared(id)) === 'ok' ? id : null;
  });
  expect(id).toBeTruthy();
  await eva.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.netHost);
  // Finn opens it: he lands in Eva's room, not in a copy of his own
  await expect.poll(() => finn.page.evaluate(async id => (await import('/src/net/shared.js')).sharedInfo(id)?.room || '', id), { timeout: 10000 }).toMatch(/^[A-Z0-9]{5}$/);
  expect(await finn.page.evaluate(async id => (await import('/src/net/shared.js')).openShared(id), id)).toBe('joined');
  await finn.page.waitForFunction(() => window.__ww.G.netClient && window.__ww.G.state === 'play' && window.__ww.G.worldName === 'Evas Hof', null, { timeout: 30000 });
  await expect.poll(() => eva.page.evaluate(async () => (await import('/src/net/room.js')).NET.players.length), { timeout: 10000 }).toBe(2);

  // Eva saves and is gone: Finn becomes host, and his saves reach the relay
  await eva.page.evaluate(async () => {
    window.__ww.G.money = 777;
    (await import('/src/net/netsave.js')).saveNet();
    await window.__ww.G.worldSavePending;
  });
  await expect.poll(() => stored().filter(w => w.id === id).map(w => [w.by, JSON.parse(w.save).data.money])).toEqual([['Eva', 777]]);
  await eva.page.close();
  await finn.page.waitForFunction(() => window.__ww.G.netHost && window.__ww.G.state === 'play', null, { timeout: 30000 });
  await expect.poll(() => finn.page.evaluate(async () => (await import('/src/net/shared.js')).SH.open), { timeout: 10000 }).toBe(id);
  await finn.page.waitForTimeout(5200); // (saves go to the relay at most every five seconds)
  await finn.page.evaluate(async () => {
    window.__ww.G.money = 888;
    (await import('/src/net/netsave.js')).saveNet();
    await window.__ww.G.worldSavePending;
  });
  await expect.poll(() => stored().filter(w => w.id === id).map(w => [w.by, JSON.parse(w.save).data.money]), { timeout: 10000 }).toEqual([['Finn', 888]]);
  expect(finn.errors).toEqual([]);
});
