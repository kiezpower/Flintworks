// A multiplayer round, first stage: every device builds the same world from the host's seed
// and simulates it itself; the players' Wühler are shared. Your own Wühler sends where it is
// 15 times a second, the others appear as "puppets" that follow those messages.
// (Next stage: the host simulates everything and sends the world – see docs/MULTIPLAYER_PLAN.md.)
import { addClonk } from '../entities.js';
import { clonkOf } from '../players.js';
import { G, crew } from '../state.js';
import { NET, onGameMsg, sendTo } from './room.js';

// add a Wühler for every other player of the room
function addNetPlayers(list) {
  for (const p of list) {
    if (p.pid === G.myId || clonkOf(p.pid)) continue;
    const c = addClonk(G.base.x + 8 + (p.pid % 4) * 6, G.base.gy - 10);
    Object.assign(c, { pid: p.pid, name: p.name, cap: p.cap, hat: p.hat, puppet: true, inv: [] });
  }
}

// every tick while a network game runs
function netTick() {
  if (!G.net || G.frame % 4) return;
  const c = clonkOf(G.myId);
  if (!c) return;
  sendTo('all', {
    k: 'pos',
    x: Math.round(c.x * 4) / 4,
    y: Math.round(c.y * 4) / 4,
    f: c.face,
    vx: Math.round(c.vx * 100) / 100,
    dg: c.digging ? 1 : 0,
    dd: c.digDir,
    it: c.inv[c.isel] || '',
    dead: c.dead ? 1 : 0,
    tm: c.tumble ? 1 : 0,
    rot: c.rot,
    cl: c.climb ? 1 : c.hangle ? 2 : 0,
  });
}
onGameMsg('pos', (d, from) => {
  const c = clonkOf(from);
  if (c && c.puppet) c.net = d;
});

// a puppet glides towards the last reported position (snaps when far off)
function updPuppet(c) {
  const d = c.net;
  if (!d) return;
  const dx = d.x - c.x,
    dy = d.y - c.y;
  if (Math.abs(dx) + Math.abs(dy) > 40) {
    c.x = d.x;
    c.y = d.y;
  } else {
    c.x += dx * 0.3;
    c.y += dy * 0.3;
  }
  c.face = d.f;
  c.vx = d.vx;
  c.digging = !!d.dg;
  c.digDir = d.dd || c.digDir;
  c.inv = d.it ? [d.it] : [];
  c.isel = 0;
  c.dead = !!d.dead;
  c.tumble = !!d.tm;
  c.rot = d.rot || 0;
  c.climb = d.cl === 1;
  c.hangle = d.cl === 2;
  c.anim += c.digging ? 0.3 : Math.abs(c.vx) * 0.35;
}

// the start message the host sends to everybody
function startMessage() {
  return {
    k: 'start',
    seed: (Math.random() * 4294967296) >>> 0,
    players: NET.players.filter(p => p.online).map(({ pid, name, cap, hat }) => ({ pid, name, cap, hat })),
  };
}
const isNetGame = () => !!G.net;
function endNet() {
  G.net = false;
  for (let k = crew.length - 1; k >= 0; k--) if (crew[k].puppet) crew.splice(k, 1);
}

export { addNetPlayers, endNet, isNetGame, netTick, startMessage, updPuppet };
