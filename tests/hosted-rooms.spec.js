import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { startRelay } from './relayproc.js';
const { WebSocket } = createRequire(new URL('../server/package.json', import.meta.url))('ws');
let relay;
const sockets = [];
test.beforeAll(async () => { relay = startRelay(8804); await relay.ready; });
test.afterAll(() => { for (const s of sockets) s.close(); relay?.relay.kill(); });
async function client() {
  const ws = new WebSocket('ws://127.0.0.1:8804'); sockets.push(ws);
  const messages = [];
  ws.on('message', d => messages.push(JSON.parse(d)));
  await new Promise((r, fail) => { ws.once('open', r); ws.once('error', fail); });
  return {
    ws, messages, send: m => ws.send(JSON.stringify(m)),
    async wait(t) { await expect.poll(() => messages.some(m => m.t === t)).toBe(true); return messages.findLast(m => m.t === t); },
  };
}

test('a hosted room reserves its server slot, accepts four humans and keeps ownership and its code on reconnect', async () => {
  const host = await client(), token = randomBytes(16).toString('hex');
  host.send({ t: 'create', hosted: true, token, name: 'Dauerwelt', pub: true });
  const room = await host.wait('room');
  expect(room.hosted).toBe(true);
  expect(room.players).toMatchObject([{ serverHost: true, watch: true }]);
  expect(JSON.stringify(room)).not.toContain(token);
  const guests = [];
  for (let n = 0; n < 4; n++) {
    const g = await client(); guests.push(g);
    g.send({ t: 'join', code: room.code, token: randomBytes(16).toString('hex'), name: 'Freund ' + n });
    expect((await g.wait('room')).players.length).toBe(n + 2);
  }
  const extra = await client();
  extra.send({ t: 'join', code: room.code, token: randomBytes(16).toString('hex'), name: 'Zu viel' });
  expect((await extra.wait('error')).e).toBe('full');
  host.ws.close();
  await new Promise(r => setTimeout(r, 6500)); // beyond the ordinary host-migration grace
  expect(guests[0].messages.filter(m => m.t === 'players').every(m => m.host === room.pid)).toBe(true);
  const reconnected = await client();
  reconnected.send({ t: 'create', hosted: true, token, pub: true, name: 'Dauerwelt' });
  const same = await reconnected.wait('room');
  expect([same.code, same.host, same.pid]).toEqual([room.code, room.host, room.pid]);
  expect(same.players).toHaveLength(5);
});
