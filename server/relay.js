// Flintworks multiplayer relay. It does not run the game: it keeps rooms (a code, up to 4
// players, who is host), forwards messages between the players of a room and remembers the
// host's latest full snapshot for players who join late or reconnect.
//
// Messages are JSON. Client → server:
//   {t:'create', name, cap, hat, token}      open a room, you are host
//   {t:'join', code, name, cap, hat, token}  join a room (same token = same player again)
//   {t:'quick', tag, name, cap, hat, token}  join an open room with space (one for the mode
//                                            of the hour, tag, first), or open a new one
//   {t:'list'}                               which open rooms are there?
//   {t:'public', on}                         host: open the room to everybody (or not)
//   {t:'ready', ready}                       lobby ready flag
//   {t:'msg', to, d}                         forward d to a player id, 'host' or 'all' (default)
//   {t:'snap', d}                            host: latest full snapshot (kept, not forwarded)
//   {t:'leave'}                              leave the room
//   {t:'ping', ts}
// Server → client:
//   {t:'room', code, pid, host, players, pub, tag} you are in (players: [{pid,name,cap,hat,ready,online}]);
//                                            tag: the mode of a quick play room (it starts by itself)
//   {t:'players', players, host, pub}        someone joined, left, got ready or became host
//   {t:'rooms', rooms}                       open rooms: [{code, host, n, versus, ffa, playing, tag}]
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
const pubP = p => ({ pid: p.pid, name: p.name, cap: p.cap, hat: p.hat, ready: p.ready, online: !!p.ws });
function send(ws, m) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
}
function broadcast(room, m, except) {
  for (const p of room.players) if (p !== except) send(p.ws, m);
}
function playersMsg(room) {
  return { t: 'players', host: room.host, pub: room.pub, players: room.players.map(pubP) };
}
function newRoom(pub, tag = null) {
  const r = { code: newCode(), players: [], host: 0, nextPid: 0, snap: null, empty: 0, hostGone: 0 };
  Object.assign(r, { pub, tag, versus: false, ffa: false, playing: false });
  rooms.set(r.code, r);
  return r;
}
// open rooms someone can join right now: public, somebody there, a place free
const online = r => r.players.filter(p => p.ws).length;
const joinable = r => r.pub && online(r) > 0 && r.players.length < MAX;
function openRooms() {
  const out = [];
  for (const r of rooms.values()) {
    if (!joinable(r)) continue;
    const h = r.players.find(p => p.pid === r.host);
    const { code, versus, ffa, playing, tag } = r;
    out.push({ code, host: h ? h.name : '', n: r.players.length, versus, ffa, playing, tag });
  }
  // fullest first: a room that already has company gets going sooner
  return out.sort((a, b) => b.n - a.n).slice(0, 20);
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
  const players = room.players.map(pubP);
  send(ws, { t: 'room', code: room.code, pid: p.pid, host: room.host, pub: room.pub, tag: room.tag, players });
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
    case 'create':
      return join(ws, newRoom(!!m.pub), m);
    case 'quick': {
      // a room with the mode of the hour first, then one still in the lobby, the fullest first
      const tag = clean(m.tag, 24) || null;
      const all = [...rooms.values()].filter(joinable);
      all.sort((a, b) => (b.tag === tag) - (a.tag === tag) || a.playing - b.playing || b.players.length - a.players.length);
      return join(ws, all[0] || newRoom(true, tag), m);
    }
    case 'list':
      return send(ws, { t: 'rooms', rooms: openRooms() });
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
    case 'public':
      if (me.pid !== room.host) return;
      room.pub = !!m.on;
      return broadcast(room, playersMsg(room));
    case 'msg': {
      // what the room list shows: Koop or Versus, and whether a round is running
      const k = m.d && me.pid === room.host && m.d.k;
      if (k === 'cfg') Object.assign(room, { versus: !!m.d.versus, ffa: !!m.d.ffa });
      else if (k === 'start' && m.to === 'all') room.playing = true;
      else if (k === 'end') room.playing = false;
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
