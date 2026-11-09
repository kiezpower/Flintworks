// The host runs the game for everybody. It takes the other players' input and orders, and
// sends what happened: entity changes 15× a second, changed landscape chunks 20× a second,
// plus sounds, floating texts and messages for single players.
import { exec } from '../commands.js';
import { diggerOf, consumeEdges, setInput } from '../players.js';
import { G, crew } from '../state.js';
import { NET, onGameMsg, sendTo } from './room.js';
import { KINDS, packGame } from './sync.js';
import { allChunks, chunksOf, resetSent, takeChunks } from './terrain.js';

const last = {}; // kind → Map(id → last sent JSON)
let lastGame = null,
  events = [];

function startHost() {
  G.netHost = true;
  for (const k in KINDS) last[k] = new Map();
  lastGame = null;
  events = [];
  tdOK.clear();
  wholeUntil = 0;
  resetSent();
}
function stopHost() {
  G.netHost = false;
}
// sounds, floating texts and blasts the clients should see too (hooks in sound/floats/objects)
G.netEvent = e => {
  if (G.netHost && events.length < 60) events.push(e);
};
// orders run on the host get their messages sent to the player who gave them
G.toastHook = (key, params) => {
  if (!G.netHost || G.cmdPid == null || G.cmdPid === G.myId) return false;
  sendTo(G.cmdPid, { k: 'toast', key, params });
  return true;
};

onGameMsg('in', (d, from) => {
  if (!G.netHost) return;
  setInput(from, {
    ax: d.ax,
    ay: d.ay,
    dig: !!d.dg,
    auto: !!d.au,
    jumpP: !!d.j,
    jumpUp: !!d.ju,
    throwP: !!d.t,
    actP: !!d.a,
  });
  const c = diggerOf(from);
  if (c) c.netSeq = d.sq;
  if (d.td) tdOK.add(from);
});
// the players whose client understands landscape diffs (terrain.js); diffs only when all do
const tdOK = new Set();
let wholeUntil = 0;
const allDiffs = () =>
  G.frame > wholeUntil && NET.players.every(p => !p.online || p.pid === NET.pid || tdOK.has(p.pid));
// a client is unsure about some ground: send it again
onGameMsg('rq', (d, from) => {
  if (G.netHost && Array.isArray(d.c)) sendTo(from, { k: 'ter', c: chunksOf(d.c) });
});
onGameMsg('cmd', (d, from) => {
  if (G.netHost) exec(from, d.n, d.a || {});
});

// after every tick
function hostTick() {
  if (!G.netHost) return;
  consumeEdges();
  if (G.frame % 3 === 0) {
    const c = takeChunks(G.frame, allDiffs());
    if (c.length) sendTo('all', { k: 'ter', c });
  }
  if (G.frame % 4 === 0) {
    sendSnapshot(G.frame % 120 === 0 || G.netKey);
    G.netKey = false;
  }
}
// only what changed: per entity the fields that differ from what was sent last time
// (new entities and every 2 s a keyframe go out complete)
const same = (a, b) => a === b || (typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b));
function delta(d, prev, full) {
  if (full || !prev) return d;
  let out = null;
  for (const k in d)
    if (!same(d[k], prev[k])) {
      out ||= { id: d.id };
      out[k] = d[k];
    }
  return out;
}
// (further than a wide screen from every player's Wühler)
const farFromAll = e => {
  for (const c of crew) if (c.pid != null && !c.dead && Math.abs(c.x - e.x) < 420 && Math.abs(c.y - e.y) < 260) return false;
  return true;
};
function sendSnapshot(full) {
  const snap = { k: 'snap', day: Math.round(G.dayT * 10000) / 10000, ev: events };
  events = [];
  // animals only every second snapshot (they are many and not important)
  const slow = G.frame % 8 !== 0;
  for (const kind in KINDS) {
    if (kind === 'animals' && slow && !full) continue;
    const K = KINDS[kind],
      m = last[kind],
      seen = new Set(),
      ch = [];
    for (const e of K.list) {
      if (e.id == null) continue;
      // an animal far from every player (off everybody's screen) goes out twice a second only
      if (kind === 'animals' && !full && G.frame % 32 && farFromAll(e)) {
        seen.add(e.id);
        continue;
      }
      const d = K.pack(e),
        x = delta(d, m.get(e.id), full);
      seen.add(e.id);
      if (x) ch.push(x);
      m.set(e.id, d);
    }
    const gone = [];
    for (const id of m.keys())
      if (!seen.has(id)) {
        gone.push(id);
        m.delete(id);
      }
    if (ch.length || gone.length || full) snap[kind] = { c: ch, g: gone, all: full ? [...seen] : undefined };
  }
  const g = packGame(),
    gd = full ? g : delta({ id: 0, ...g }, lastGame, false);
  if (gd) snap.g = gd;
  lastGame = { id: 0, ...g };
  sendTo('all', snap);
}
// the round is over for everybody: who won, why, and what every player did
function hostEnd(won, winner, why, stats) {
  if (G.netHost) sendTo('all', { k: 'end', won, winner, why: why || null, stats: stats || null });
}

// a player joins late or comes back: same world, the whole landscape, then a full snapshot
function welcome(pid, start) {
  sendTo(pid, { ...start, k: 'start', late: true });
  sendTo(pid, { k: 'ter', c: allChunks() });
  G.netKey = true;
  // (the newcomer has the ground as it is now, also in chunks not yet sent to the others: for
  // a while only whole chunks, until every changed chunk has gone out once)
  wholeUntil = G.frame + 180;
}

// a new host sends its landscape to everybody once, so all start from the same ground
function sendWorld() {
  sendTo('all', { k: 'ter', c: allChunks() });
  G.netKey = true;
  wholeUntil = G.frame + 180;
}

export { hostEnd, hostTick, sendWorld, startHost, stopHost, welcome };
