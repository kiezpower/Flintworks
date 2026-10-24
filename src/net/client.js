// A multiplayer client shows the host's game. It sends its stick and buttons to the host,
// moves its own Wühler right away (prediction, corrected by the host's answer) and eases
// everything else towards the positions the host reports.
import { context, updClonk } from '../clonk.js';
import { addFloat, updFloats } from '../floats.js';
import { inp } from '../input.js';
import { updParts } from '../objects.js';
import { playAnnounce } from '../announce.js';
import { playShot, updArrows, updCombat } from '../combat.js';
import { playBomb, updEvents } from '../events.js';
import { clonkOf } from '../players.js';
import { sfx } from '../sound.js';
import { G, flashes } from '../state.js';
import { tapGotoInput } from '../tapgo.js';
import { openBase, openBuild, toast } from '../ui.js';
import { updWeather } from '../weather.js';
import { onGameMsg, sendTo } from './room.js';
import { KINDS, MOVING, applyGame } from './sync.js';
import { applyChunks } from './terrain.js';

let seq = 0,
  gameRaw = {},
  lastSnap = 0;
const raw = {}; // kind → Map(id → last full data from the host)
const hist = []; // own predicted positions per input number: {sq, x, y}
const pend = { j: false, ju: false, t: false, a: false }; // button presses since the last send

function startClient() {
  G.netClient = true;
  G.sendCmd = (n, a) => sendTo('host', { k: 'cmd', n, a });
  // the host's snapshots fill these
  for (const k of ['crew', 'items', 'animals', 'lorries']) KINDS[k].list.length = 0;
  hist.length = 0;
  seq = 0;
  gameRaw = {};
  lastSnap = performance.now();
  for (const k in raw) delete raw[k];
}
function stopClient() {
  G.netClient = false;
}

onGameMsg('snap', d => {
  if (!G.netClient) return;
  lastSnap = performance.now();
  applySnap(d);
});
onGameMsg('ter', d => {
  if (G.netClient) applyChunks(d.c);
});
onGameMsg('toast', d => toast(d.key, d.params));
onGameMsg('end', d => G.netClient && G.onNetEnd?.(d.won, d.winner));

const OWN = ['x', 'y', 'vx', 'vy', 'face', 'digging', 'digDir', 'climb', 'hangle'];
function applySnap(d) {
  if (d.g) applyGame((gameRaw = { ...gameRaw, ...d.g }));
  if (d.day != null) G.dayT = d.day;
  for (const kind in KINDS) {
    const p = d[kind];
    if (!p) continue;
    const K = KINDS[kind],
      list = K.list,
      byId = new Map(list.map(e => [e.id, e]));
    const raws = (raw[kind] ||= new Map());
    for (const part of p.c) {
      // deltas: merge with what we know about this entity
      const e = { ...raws.get(part.id), ...part };
      raws.set(e.id, e);
      let o = byId.get(e.id);
      if (!o) {
        o = K.create(e);
        list.push(o);
        byId.set(e.id, o);
      }
      const own = kind === 'crew' && e.pid === G.myId;
      const keep = own ? OWN.map(k => o[k]) : null;
      K.apply(o, e);
      if (own) {
        // your own Wühler: keep the prediction, nudge it where the host disagrees
        if (!o.netBusy) OWN.forEach((k, i) => (o[k] = keep[i]));
        reconcile(o, e);
      } else if (MOVING.has(kind)) {
        o.tx = e.x;
        o.ty = e.y;
        if (Math.abs(o.x - e.x) + Math.abs(o.y - e.y) > 40) {
          o.x = e.x;
          o.y = e.y;
        }
      }
    }
    const drop = new Set(p.g);
    if (p.all) {
      const all = new Set(p.all);
      for (const o of list) if (!all.has(o.id)) drop.add(o.id);
    }
    if (drop.size) {
      for (let k = list.length - 1; k >= 0; k--) if (drop.has(list[k].id)) list.splice(k, 1);
      for (const id of drop) raws.delete(id);
    }
  }
  for (const e of d.ev || []) playEvent(e);
}
function reconcile(c, e) {
  if (c.netBusy) {
    // the host moves it (falling, felling, building stairs, exhausted): just follow
    c.x = e.x;
    c.y = e.y;
    hist.length = 0;
    return;
  }
  const h = hist.find(q => q.sq === e.sq);
  if (!h) return;
  const dx = e.x - h.x,
    dy = e.y - h.y,
    err = Math.abs(dx) + Math.abs(dy);
  if (err < 1.5) return;
  const k = err > 24 ? 1 : 0.3;
  c.x += dx * k;
  c.y += dy * k;
  for (const q of hist) {
    q.x += dx * k;
    q.y += dy * k;
  }
}
function playEvent(e) {
  if (playAnnounce(e) || playShot(e) || playBomb(e)) return;
  if (e[0] === 's') sfx(e[1], e[2], e[3], e[4]);
  else if (e[0] === 'f') addFloat(e[1], e[2], e[3], e[4], e[5]);
  else if (e[0] === 'x') {
    flashes.push({ x: e[1], y: e[2], r: e[3] + 4, l: 7 });
    G.shake = Math.max(G.shake || 0, e[3] > 15 ? 9 : 5);
  }
}

// one tick on a client (instead of the full simulation)
function clientStep(paused) {
  G.frame++;
  const me = clonkOf(G.myId);
  if (G.state === 'play' && !paused) {
    tapGotoInput(me);
    if (me && !me.dead && !me.netBusy) updClonk(me, { ...inp, throwP: false, actP: false });
    if (inp.actP && me) {
      const cx = context(me);
      if (cx.ui) (cx.ui === 'base' ? openBase : openBuild)();
    }
    sendInput(me);
    ease();
    // nothing from the host for a while (app in the background, dead spot)
    if (performance.now() - lastSnap > 3000 && G.frame % 180 === 0) toast('Warte auf den Host …');
    updFloats();
    updArrows();
    updCombat();
    updEvents();
  }
  if (!paused) {
    updWeather();
    updParts();
  }
}
function sendInput(me) {
  pend.j ||= inp.jumpP;
  pend.ju ||= inp.jumpUp;
  pend.t ||= inp.throwP;
  pend.a ||= inp.actP;
  if (G.frame % 2) return;
  seq++;
  sendTo('host', {
    k: 'in',
    sq: seq,
    ax: Math.round(inp.ax * 100) / 100,
    ay: Math.round(inp.ay * 100) / 100,
    dg: inp.dig ? 1 : 0,
    au: inp.auto ? 1 : 0,
    j: pend.j ? 1 : 0,
    ju: pend.ju ? 1 : 0,
    t: pend.t ? 1 : 0,
    a: pend.a ? 1 : 0,
  });
  pend.j = pend.ju = pend.t = pend.a = false;
  if (me) {
    hist.push({ sq: seq, x: me.x, y: me.y });
    if (hist.length > 90) hist.shift();
  }
}
// everything else glides to where the host says it is
function ease() {
  for (const kind of MOVING) {
    for (const o of KINDS[kind].list) {
      if (o.tx == null || (kind === 'crew' && o.pid === G.myId)) continue;
      o.x += (o.tx - o.x) * 0.35;
      o.y += (o.ty - o.y) * 0.35;
      if (kind === 'crew') o.anim = (o.anim || 0) + (o.digging || o.hammer ? 0.3 : Math.abs(o.vx) * 0.35);
      else if (kind === 'animals') o.anim = (o.anim || 0) + Math.abs(o.vx) * 0.3;
    }
  }
}

export { clientStep, startClient, stopClient };
