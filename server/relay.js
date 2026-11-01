// Flintworks multiplayer relay. It does not run the game: it keeps rooms (a code, up to 4
// players, who is host), forwards messages between the players of a room and remembers the
// host's latest full snapshot for players who join late or reconnect.
//
// Messages are JSON. Client → server:
//   {t:'create', name, cap, hat, skin, token} open a room, you are host (skin: "outfit.style")
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
//   {t:'hello', token, name, friends, ignored, daily}  friends without a login: who I am (the
//                                            device token; the public friend code is derived from
//                                            it here, so nobody can claim another's code), my
//                                            friend codes, the ones whose request I turned down,
//                                            today's Tagesschacht {day, score}. Sent again after
//                                            every change
//   {t:'finvite', to}                        invite a friend (code) into my room
// Server → client:
//   {t:'room', code, pid, host, players, pub, tag} you are in (players: [{pid,name,cap,hat,skin,ready,online}]);
//                                            tag: the mode of a quick play room (it starts by itself)
//   {t:'players', players, host, pub}        someone joined, left, got ready or became host
//   {t:'rooms', rooms}                       open rooms: [{code, host, n, versus, ffa, playing, tag}]
//   {t:'msg', from, d}                       forwarded message
//   {t:'snap', d}                            latest snapshot (sent on join/reconnect while a game runs)
//   {t:'error', e}                           'full' | 'nope' (room unknown) | 'bad'
//   {t:'pong', ts}
//   {t:'hi', fid}                            my own friend code
//   {t:'friends', list, asks}                list: mutual friends only [{fid, name, online, room,
//                                            n, daily}] (room: only when it has space; daily: the
//                                            score of the same day, or null); asks: who
//                                            has me in their list but is not in mine [{fid, name}]
//   {t:'finvite', from, name, room}          a friend invites me into their room
// Friends are kept in memory only (nothing on disk): every client sends its whole list on each
// connect, so after a restart the index rebuilds itself. Users without a connection for 30 days
// are dropped.
import { createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const MAX = 4;
const ROOM_TTL = 10 * 60 * 1000; // an empty room survives this long
const HOST_GRACE = 5000; // a host that is gone this long hands over to another player
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const rooms = new Map(); // code → room

// ---- friends ----
const FID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FID_RE = /^[A-Z2-9]{8}$/;
const MAX_FRIENDS = 100;
const USER_TTL = 30 * 24 * 3600 * 1000;
const users = new Map(); // fid → {fid, name, friends:Set, ignored:Set, daily, ws, seen}
function fidOf(token) {
  const h = createHash('sha256').update('fw-friend:' + token).digest();
  let s = '';
  for (let i = 0; i < 8; i++) s += FID_CHARS[h[i] & 31];
  return s;
}
const codes = a => new Set((Array.isArray(a) ? a : []).map(String).filter(c => FID_RE.test(c)).slice(0, MAX_FRIENDS));
const mutual = (a, b) => a.friends.has(b.fid) && b.friends.has(a.fid);
// where a friend is: a room with space (code, players), only while online
function whereIs(u) {
  const r = u.ws && u.ws.room;
  if (!r || r.players.length >= MAX || !r.players.includes(u.ws.player)) return {};
  return { room: r.code, n: r.players.length };
}
function friendsMsg(u) {
  const list = [],
    asks = [];
  for (const fid of u.friends) {
    const f = users.get(fid);
    if (!f || !mutual(u, f)) continue;
    // today's Tagesschacht, only when it is the same day for both (time zones)
    const today = f.daily && u.daily && f.daily.day === u.daily.day && f.daily.score != null;
    list.push({ fid, name: f.name, online: !!f.ws, ...whereIs(f), daily: today ? f.daily.score : null });
  }
  for (const f of users.values())
    if (f !== u && f.friends.has(u.fid) && !u.friends.has(f.fid) && !u.ignored.has(f.fid)) asks.push({ fid: f.fid, name: f.name });
  return { t: 'friends', list, asks: asks.slice(0, 20) };
}
// tell u and everybody who has u in their list (at most once a second each)
const dirty = new Set();
function touch(u) {
  if (!u) return;
  dirty.add(u);
  for (const f of users.values()) if (f.ws && (f.friends.has(u.fid) || u.friends.has(f.fid))) dirty.add(f);
}
setInterval(() => {
  for (const u of dirty) if (u.ws) send(u.ws, friendsMsg(u));
  dirty.clear();
}, 1000);
function hello(ws, m) {
  const token = clean(m.token, 40);
  if (!token) return send(ws, { t: 'error', e: 'bad' });
  const fid = fidOf(token);
  let u = users.get(fid);
  if (!u) users.set(fid, (u = { fid }));
  const old = u.friends;
  if (u.ws && u.ws !== ws) u.ws.user = null;
  Object.assign(u, { name: clean(m.name, 16), friends: codes(m.friends), ignored: codes(m.ignored), ws, seen: Date.now() });
  u.friends.delete(fid);
  const d = m.daily;
  if (d && Number.isInteger(d.day))
    u.daily = { day: d.day, score: Number.isFinite(d.score) ? Math.max(0, Math.round(d.score)) : null };
  ws.user = u;
  send(ws, { t: 'hi', fid });
  send(ws, friendsMsg(u));
  touch(u);
  // someone I just removed should hear about it too
  if (old) for (const f of old) if (!u.friends.has(f) && users.get(f)?.ws) dirty.add(users.get(f));
}
function finvite(ws, m) {
  const u = ws.user,
    f = users.get(String(m.to));
  const r = ws.room;
  if (!u || !f || !f.ws || !mutual(u, f) || !r || r.players.length >= MAX) return;
  send(f.ws, { t: 'finvite', from: u.fid, name: u.name, room: r.code });
}

function newCode() {
  for (;;) {
    const c = Array.from({ length: 6 }, () => CHARS[(Math.random() * CHARS.length) | 0]).join('');
    if (!rooms.has(c)) return c;
  }
}
const pubP = p => ({ pid: p.pid, fid: p.token ? fidOf(p.token) : undefined, name: p.name, cap: p.cap, hat: p.hat, skin: p.skin, ready: p.ready, online: !!p.ws });
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
  if (ws.room && ws.room !== room && ws.player) leave(ws.room, ws.player, true);
  if (p.ws && p.ws !== ws) p.ws.close(4000, 'replaced');
  Object.assign(p, { ws, name: clean(m.name, 16), cap: clean(m.cap, 9), hat: clean(m.hat, 12), skin: clean(m.skin, 20), gone: 0 });
  ws.room = room;
  ws.player = p;
  room.empty = 0;
  if (room.host === p.pid) room.hostGone = 0;
  const players = room.players.map(pubP);
  send(ws, { t: 'room', code: room.code, pid: p.pid, host: room.host, pub: room.pub, tag: room.tag, players });
  if (room.snap) send(ws, { t: 'snap', d: room.snap });
  broadcast(room, playersMsg(room), p);
  touch(ws.user);
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
    case 'hello':
      return hello(ws, m);
    case 'finvite':
      return finvite(ws, m);
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
  const u = p.ws && p.ws.user;
  if (p.ws) {
    p.ws.room = null;
    p.ws.player = null;
  }
  p.ws = null;
  touch(u);
  if (forGood) room.players = room.players.filter(q => q !== p);
  else p.gone = Date.now();
  if (p.pid === room.host) room.hostGone = Date.now();
  if (!room.players.some(q => q.ws)) room.empty = Date.now();
  broadcast(room, playersMsg(room));
}

// housekeeping: hand over the host role, drop old rooms
setInterval(() => {
  const now = Date.now();
  for (const [fid, u] of users) if (!u.ws && now - u.seen > USER_TTL) users.delete(fid);
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
  ws.on('close', () => {
    if (ws.room && ws.player && ws.player.ws === ws) leave(ws.room, ws.player, false);
    const u = ws.user;
    if (u && u.ws === ws) {
      u.ws = null;
      u.seen = Date.now();
      touch(u);
    }
  });
});
console.log(`Flintworks relay on :${PORT}`);
