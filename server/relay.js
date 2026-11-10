// Flintworks multiplayer relay. It does not run the game: it keeps rooms (a code, up to 8
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
//   {t:'watch', on}                          watch the round instead of playing (no Wühler)
//   {t:'msg', to, d}                         forward d to a player id, 'host' or 'all' (default)
//   {t:'snap', d}                            host: latest full snapshot (kept, not forwarded)
//   {t:'leave'}                              leave the room
//   {t:'ping', ts}
//   {t:'hello', token, name, friends, ignored, daily}  friends without a login: who I am (the
//                                            device token; the public friend code is derived from
//                                            it here, so nobody can claim another's code), my
//                                            friend codes, the ones whose request I turned down,
//                                            today's Tagesschicht {day, score}. Sent again after
//                                            every change
//   {t:'finvite', to}                        invite a friend (code) into my room
// Server → client:
//   {t:'room', code, pid, host, players, pub, tag} you are in (players: [{pid,name,cap,hat,skin,ready,watch,online}]);
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
//   {t:'rank', day, pos, of}                 my place in today's Tagesschicht among everybody the
//                                            relay knows (anonymous: no names, only the place and
//                                            how many played), after every hello with a score
// Friends are kept in memory only (nothing on disk): every client sends its whole list on each
// connect, so after a restart the index rebuilds itself. Users without a connection for 30 days
// are dropped.
//
// Limits (anybody can connect, so nobody may use up the server): connections per IP address,
// messages per second per connection (room and friends requests much fewer), failed room codes
// per connection, the size of a kept snapshot, users in all. Game messages only the host may
// send (start, snapshots, landscape, end, ...) are dropped when another player sends them.
import { createHash, randomInt } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const MAX = 8;
const ROOM_TTL = 10 * 60 * 1000; // an empty room survives this long
const HOST_GRACE = 5000; // a host that is gone this long hands over to another player
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const MAX_PER_IP = num(process.env.MAX_PER_IP, 16); // open connections per IP address
const MSG_RATE = 150, // game messages per second (burst: twice that)
  CTRL_RATE = 4, // room and friends requests per second
  CTRL_BURST = 20,
  MAX_DROPPED = 2000, // messages over the limit before the connection is closed
  MAX_BAD_CODES = 20, // unknown room codes per connection (no guessing private rooms)
  MAX_TOKENS = 3, // different friend tokens per connection
  MAX_SNAP = 1024 * 1024, // bytes of a kept snapshot
  MAX_USERS = num(process.env.MAX_USERS, 100000);
// game messages only the host sends (the clients check this too)
const HOST_ONLY = new Set(['start', 'snap', 'ter', 'end', 'cfg', 'toast', 'cd']);
const CTRL = new Set(['create', 'join', 'quick', 'list', 'public', 'ready', 'watch', 'hello', 'finvite', 'leave']);

const rooms = new Map(); // code → room

// ---- friends ----
const FID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FID_RE = /^[A-Z2-9]{8}$/;
const MAX_FRIENDS = 100;
const USER_TTL = 30 * 24 * 3600 * 1000;
const users = new Map(); // fid → {fid, name, friends:Set, ignored:Set, daily, ws, seen}
const fans = new Map(); // fid → Set of fids that have it in their list (whether they exist or not)
function setFriends(u, next) {
  const old = u.friends || new Set();
  for (const f of old)
    if (!next.has(f)) {
      const s = fans.get(f);
      if (s && (s.delete(u.fid), !s.size)) fans.delete(f);
    }
  for (const f of next) if (!old.has(f)) (fans.get(f) || fans.set(f, new Set()).get(f)).add(u.fid);
  u.friends = next;
}
const fansOf = u => [...(fans.get(u.fid) || [])].map(fid => users.get(fid)).filter(Boolean);
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
    // today's Tagesschicht, only when it is the same day for both (time zones)
    const today = f.daily && u.daily && f.daily.day === u.daily.day && f.daily.score != null;
    list.push({ fid, name: f.name, online: !!f.ws, ...whereIs(f), daily: today ? f.daily.score : null });
  }
  for (const f of fansOf(u))
    if (f !== u && !u.friends.has(f.fid) && !u.ignored.has(f.fid) && asks.length < 20) asks.push({ fid: f.fid, name: f.name });
  return { t: 'friends', list, asks: asks.slice(0, 20) };
}
// tell u and everybody who has u in their list (at most once a second each)
const dirty = new Set();
function touch(u) {
  if (!u) return;
  dirty.add(u);
  for (const f of fansOf(u)) if (f.ws) dirty.add(f);
  for (const fid of u.friends || []) {
    const f = users.get(fid);
    if (f && f.ws) dirty.add(f);
  }
}
setInterval(() => {
  for (const u of dirty) if (u.ws) send(u.ws, friendsMsg(u));
  dirty.clear();
}, 1000);
function hello(ws, m) {
  const token = clean(m.token, 40);
  if (!token) return send(ws, { t: 'error', e: 'bad' });
  const fid = fidOf(token);
  // one device, one token: a connection that tries many is guessing (or filling the server)
  ws.tokens ||= new Set();
  ws.tokens.add(fid);
  if (ws.tokens.size > MAX_TOKENS) return ws.close(4003, 'tokens');
  let u = users.get(fid);
  if (!u) {
    if (users.size >= MAX_USERS) return send(ws, { t: 'error', e: 'busy' });
    users.set(fid, (u = { fid }));
  }
  const old = u.friends;
  if (u.ws && u.ws !== ws) u.ws.user = null;
  if (ws.user && ws.user !== u && ws.user.ws === ws) {
    ws.user.ws = null;
    ws.user.seen = Date.now();
  }
  const next = codes(m.friends);
  next.delete(fid);
  setFriends(u, next);
  Object.assign(u, { name: clean(m.name, 16), ignored: codes(m.ignored), ws, seen: Date.now() });
  const d = m.daily;
  if (d && Number.isInteger(d.day))
    u.daily = { day: d.day, score: Number.isFinite(d.score) ? Math.max(0, Math.round(d.score)) : null };
  ws.user = u;
  send(ws, { t: 'hi', fid });
  send(ws, friendsMsg(u));
  const rk = rankOf(u);
  if (rk) send(ws, rk);
  touch(u);
  // someone I just removed should hear about it too
  if (old) for (const f of old) if (!u.friends.has(f) && users.get(f)?.ws) dirty.add(users.get(f));
}
// the place of a user in the Tagesschicht of their day, among all users of that day; a score
// above what a round can bring is not believed and not ranked (the clients count their own score)
const DAILY_MAX = num(process.env.DAILY_MAX, 20000);
const rankable = d => d && d.score != null && d.score <= DAILY_MAX;
function rankOf(u) {
  if (!rankable(u.daily)) return null;
  let pos = 1,
    of = 0;
  for (const f of users.values()) {
    if (!f.daily || f.daily.day !== u.daily.day || !rankable(f.daily)) continue;
    of++;
    if (f.daily.score > u.daily.score) pos++;
  }
  return { t: 'rank', day: u.daily.day, pos, of };
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
    const c = Array.from({ length: 6 }, () => CHARS[randomInt(CHARS.length)]).join('');
    if (!rooms.has(c)) return c;
  }
}
const pubP = p => ({ pid: p.pid, fid: p.token ? fidOf(p.token) : undefined, name: p.name, cap: p.cap, hat: p.hat, skin: p.skin, ready: p.ready, watch: !!p.watch, online: !!p.ws });
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

// a token bucket per connection: refills by rate per second up to burst
function allow(b, rate, burst, now) {
  b.n = Math.min(burst, b.n + ((now - b.t) / 1000) * rate);
  b.t = now;
  if (b.n < 1) return false;
  b.n--;
  return true;
}
function onMessage(ws, raw) {
  let m;
  try {
    m = JSON.parse(raw);
  } catch {
    return;
  }
  if (!m || typeof m !== 'object') return;
  const now = Date.now();
  const ok = allow(ws.msgB, MSG_RATE, MSG_RATE * 2, now) && (!CTRL.has(m.t) || allow(ws.ctrlB, CTRL_RATE, CTRL_BURST, now));
  if (!ok) {
    if (++ws.dropped > MAX_DROPPED) ws.close(4001, 'rate');
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
      if (!r) {
        if (++ws.badCodes > MAX_BAD_CODES) return ws.close(4002, 'codes');
        return send(ws, { t: 'error', e: 'nope' });
      }
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
    case 'watch':
      // (the host always plays)
      if (me.pid === room.host) return;
      me.watch = !!m.on;
      return broadcast(room, playersMsg(room));
    case 'snap':
      if (me.pid === room.host) room.snap = raw.length <= MAX_SNAP ? m.d : null;
      return;
    case 'public':
      if (me.pid !== room.host) return;
      room.pub = !!m.on;
      return broadcast(room, playersMsg(room));
    case 'msg': {
      const isHost = me.pid === room.host;
      // what only the host may say (the others would take over the round)
      if (m.d && typeof m.d === 'object' && HOST_ONLY.has(m.d.k) && !isHost) return;
      // what the room list shows: Koop or Versus, and whether a round is running
      const k = m.d && isHost && m.d.k;
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
  // nobody left who could come back: the room is gone right away (no pile of empty rooms)
  if (!room.players.length) {
    if (rooms.get(room.code) === room) rooms.delete(room.code);
    return;
  }
  if (p.pid === room.host) room.hostGone = Date.now();
  if (!room.players.some(q => q.ws)) room.empty = Date.now();
  broadcast(room, playersMsg(room));
}

// housekeeping: hand over the host role, drop old rooms
setInterval(() => {
  const now = Date.now();
  for (const [fid, u] of users)
    if (!u.ws && now - u.seen > USER_TTL) {
      setFriends(u, new Set());
      users.delete(fid);
    }
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

// the player's address: Caddy in front puts it last in X-Forwarded-For (it replaces whatever a
// client sent there), without a proxy it is the socket's own
function ipOf(req) {
  const xff = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return xff.length ? xff[xff.length - 1] : req.socket.remoteAddress || '?';
}
const perIp = new Map(); // ip → open connections

const wss = new WebSocketServer({ port: PORT, maxPayload: 4 * 1024 * 1024 });
wss.on('connection', (ws, req) => {
  const ip = ipOf(req);
  const n = (perIp.get(ip) || 0) + 1;
  if (n > MAX_PER_IP) return ws.close(4004, 'too many');
  perIp.set(ip, n);
  const t = Date.now();
  Object.assign(ws, { msgB: { n: MSG_RATE * 2, t }, ctrlB: { n: CTRL_BURST, t }, dropped: 0, badCodes: 0 });
  ws.on('message', raw => onMessage(ws, raw));
  ws.on('error', () => {});
  ws.on('close', () => {
    const left = (perIp.get(ip) || 1) - 1;
    if (left > 0) perIp.set(ip, left);
    else perIp.delete(ip);
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
