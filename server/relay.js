// Flintworks multiplayer relay. It does not run the game: it keeps rooms (a code, up to 4
// players, who is host), forwards messages between the players of a room and remembers the
// host's latest full snapshot for players who join late or reconnect.
//
// Messages are JSON. Client → server:
//   {t:'create', name, cap, hat, token}      open a room, you are host
//   {t:'join', code, name, cap, hat, token}  join a room (same token = same player again)
//   {t:'ready', ready}                       lobby ready flag
//   {t:'msg', to, d}                         forward d to a player id, 'host' or 'all' (default)
//   {t:'snap', d}                            host: latest full snapshot (kept, not forwarded)
//   {t:'leave'}                              leave the room
//   {t:'ping', ts}
// Server → client:
//   {t:'room', code, pid, host, players}     you are in (players: [{pid,name,cap,hat,ready,host,online}])
//   {t:'players', players, host}             someone joined, left, got ready or became host
//   {t:'msg', from, d}                       forwarded message
//   {t:'snap', d}                            latest snapshot (sent on join/reconnect while a game runs)
//   {t:'error', e}                           'full' | 'nope' (room unknown) | 'bad'
//   {t:'pong', ts}
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const MAX = 4;
const ROOM_TTL = 10 * 60 * 1000; // an empty room survives this long
const HOST_GRACE = 5000; // a host that is gone this long hands over to another player
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const rooms = new Map(); // code → room

function newCode() {
  for (;;) {
    const c = Array.from({ length: 6 }, () => CHARS[(Math.random() * CHARS.length) | 0]).join('');
    if (!rooms.has(c)) return c;
  }
}
const pub = p => ({ pid: p.pid, name: p.name, cap: p.cap, hat: p.hat, ready: p.ready, online: !!p.ws });
function send(ws, m) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
}
function broadcast(room, m, except) {
  for (const p of room.players) if (p !== except) send(p.ws, m);
}
function playersMsg(room) {
  return { t: 'players', host: room.host, players: room.players.map(pub) };
}
function clean(s, n) {
  return String(s || '').slice(0, n);
}

function join(ws, room, m) {
  let p = room.players.find(q => q.token && q.token === m.token);
  if (!p) {
    if (room.players.length >= MAX) return send(ws, { t: 'error', e: 'full' });
    p = { pid: room.nextPid++, token: clean(m.token, 40), ready: false };
    room.players.push(p);
  }
  if (p.ws && p.ws !== ws) p.ws.close(4000, 'replaced');
  Object.assign(p, { ws, name: clean(m.name, 16), cap: clean(m.cap, 9), hat: clean(m.hat, 12), gone: 0 });
  ws.room = room;
  ws.player = p;
  room.empty = 0;
  if (room.host === p.pid) room.hostGone = 0;
  send(ws, { t: 'room', code: room.code, pid: p.pid, host: room.host, players: room.players.map(pub) });
  if (room.snap) send(ws, { t: 'snap', d: room.snap });
  broadcast(room, playersMsg(room), p);
}

function onMessage(ws, raw) {
  let m;
  try {
    m = JSON.parse(raw);
  } catch {
    return;
  }
  const room = ws.room,
    me = ws.player;
  switch (m.t) {
    case 'ping':
      return send(ws, { t: 'pong', ts: m.ts });
    case 'create': {
      const r = { code: newCode(), players: [], host: 0, nextPid: 0, snap: null, empty: 0, hostGone: 0 };
      rooms.set(r.code, r);
      return join(ws, r, m);
    }
    case 'join': {
      const r = rooms.get(clean(m.code, 6).toUpperCase());
      if (!r) return send(ws, { t: 'error', e: 'nope' });
      return join(ws, r, m);
    }
    case 'leave':
      if (room) leave(room, me, true);
      return;
  }
  if (!room) return send(ws, { t: 'error', e: 'bad' });
  switch (m.t) {
    case 'ready':
      me.ready = !!m.ready;
      return broadcast(room, playersMsg(room));
    case 'snap':
      if (me.pid === room.host) room.snap = m.d;
      return;
    case 'msg': {
      const out = { t: 'msg', from: me.pid, d: m.d };
      if (m.to === 'host') {
        const h = room.players.find(p => p.pid === room.host);
        return send(h && h.ws, out);
      }
      if (typeof m.to === 'number') {
        const p = room.players.find(q => q.pid === m.to);
        return send(p && p.ws, out);
      }
      return broadcast(room, out, me);
    }
  }
}

// a player is gone for good (left) or just lost the connection (may come back)
function leave(room, p, forGood) {
  p.ws = null;
  if (forGood) room.players = room.players.filter(q => q !== p);
  else p.gone = Date.now();
  if (p.pid === room.host) room.hostGone = Date.now();
  if (!room.players.some(q => q.ws)) room.empty = Date.now();
  broadcast(room, playersMsg(room));
}

// housekeeping: hand over the host role, drop old rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.empty && now - room.empty > ROOM_TTL) {
      rooms.delete(code);
      continue;
    }
    if (room.hostGone && now - room.hostGone > HOST_GRACE) {
      const next = room.players.find(p => p.ws);
      if (next) {
        room.host = next.pid;
        room.hostGone = 0;
        broadcast(room, playersMsg(room));
      }
    }
  }
}, 1000);

const wss = new WebSocketServer({ port: PORT, maxPayload: 4 * 1024 * 1024 });
wss.on('connection', ws => {
  ws.on('message', raw => onMessage(ws, raw));
  ws.on('close', () => ws.room && ws.player && ws.player.ws === ws && leave(ws.room, ws.player, false));
});
console.log(`Flintworks relay on :${PORT}`);
