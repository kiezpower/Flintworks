// What the host tells the others about the game: compact copies of every entity and of the
// shared game values. pack*() runs on the host, apply*() on the clients. Entities are matched
// by their id; a client only shows them (it does not simulate anything but its own Wühler).
import { mkLorry } from '../buildings.js';
import { mkAnimal } from '../entities.js';
import { ITEM, treeSprite } from '../sprites.js';
import { CAPS, G, NAMES, animals, builds, crew, items, lorries, trees } from '../state.js';

const r4 = v => Math.round(v * 4) / 4;
const r2 = v => Math.round(v * 100) / 100;

// ---- one entry per entity kind: list, pack (host), create + apply (client) ----
const KINDS = {
  crew: {
    list: crew,
    pack: c => ({
      id: c.id,
      pid: c.pid,
      nm: c.name,
      cap: c.cap,
      hat: c.hat,
      x: r4(c.x),
      y: r4(c.y),
      f: c.face,
      vx: r2(c.vx),
      vy: r2(c.vy),
      dg: c.digging ? 1 : 0,
      dd: c.digging ? [r2(c.digDir[0]), r2(c.digDir[1])] : 0,
      inv: c.inv,
      is: c.isel,
      dead: c.dead ? 1 : 0,
      tm: c.tumble ? 1 : 0,
      rot: c.tumble ? r2(c.rot) : 0,
      cl: c.climb ? 1 : c.hangle ? 2 : 0,
      e: Math.round(c.energy),
      ch: c.chop ? 1 : 0,
      br: c.bridge ? 1 : 0,
      hm: c.hammer ? 1 : 0,
      fo: c.focus,
      bu: c.burn > 0 ? 1 : 0,
      sq: c.netSeq,
    }),
    create: d => ({
      id: d.id,
      kind: 'clonk',
      name: d.nm || NAMES[0],
      cap: d.cap || CAPS[0],
      w: 6,
      h: 10,
      x: d.x,
      y: d.y,
      vx: 0,
      vy: 0,
      face: 1,
      energy: 100,
      breath: 100,
      inv: [],
      isel: 0,
      anim: 0,
      hurt: 0,
      rot: 0,
      digDir: [1, 0],
      deadT: 0,
      burn: 0,
    }),
    apply: (c, d) => {
      Object.assign(c, {
        pid: d.pid,
        name: d.nm,
        cap: d.cap,
        hat: d.hat,
        face: d.f,
        vx: d.vx,
        vy: d.vy,
        digging: !!d.dg,
        digDir: d.dd || c.digDir,
        inv: d.inv,
        isel: d.is,
        dead: !!d.dead,
        tumble: !!d.tm,
        rot: d.rot,
        climb: d.cl === 1,
        hangle: d.cl === 2,
        energy: d.e,
        hammer: !!d.hm,
        focus: d.fo,
        burn: d.bu ? 30 : 0,
        netBusy: !!(d.ch || d.br || d.tm || d.dead),
      });
    },
  },
  items: {
    list: items,
    pack: it => ({ id: it.id, t: it.t, x: r4(it.x), y: r4(it.y), fu: it.fuse, ar: it.armed ? 1 : 0 }),
    create: d => {
      const [w, h] = (ITEM[d.t] && ITEM[d.t].s) || [3, 3];
      return { id: d.id, t: d.t, x: d.x, y: d.y, vx: 0, vy: 0, w, h, pd: 0, fuse: -1, armed: false, thrower: null };
    },
    apply: (it, d) => {
      it.fuse = d.fu;
      it.armed = !!d.ar;
    },
  },
  animals: {
    list: animals,
    pack: a => ({
      id: a.id,
      k: a.kind,
      x: r4(a.x),
      y: r4(a.y),
      f: a.face,
      vx: r2(a.vx),
      hp: a.hp,
      hu: a.hurt > 0 ? 1 : 0,
    }),
    create: d => ({ ...mkAnimal(d.k, d.x, d.y), id: d.id }),
    apply: (a, d) => {
      a.face = d.f;
      a.vx = d.vx;
      a.hp = d.hp;
      a.hurt = d.hu ? 4 : 0;
    },
  },
  lorries: {
    list: lorries,
    pack: L => ({ id: L.id, x: r4(L.x), y: r4(L.y), vx: r2(L.vx), it: L.items }),
    create: d => ({ ...mkLorry(d.x, d.y), id: d.id }),
    apply: (L, d) => {
      L.vx = d.vx;
      L.items = d.it;
    },
  },
  builds: {
    list: builds,
    pack: b => ({
      id: b.id,
      ty: b.type,
      x: b.x,
      gy: b.gy,
      w: b.w,
      h: b.h,
      pr: r2(b.prog),
      dn: b.done ? 1 : 0,
      bs: b.busy > 0 ? 1 : 0,
      out: b.out,
      lv: b.lvl,
      op: r2(b.open || 0),
      cs: b.cs ? r4(b.cs.y) : null,
      mv: b.moving,
      on: b.on ? 1 : 0,
      pp: b.pipe,
    }),
    create: d => {
      const b = { id: d.id, type: d.ty, x: d.x, gy: d.gy, w: d.w, h: d.h, prog: 0, done: false, busy: 0 };
      if (d.cs != null) b.cs = { x: d.x + 2, y: d.cs, home: d.cs };
      return b;
    },
    apply: (b, d) => {
      Object.assign(b, { prog: d.pr, done: !!d.dn, busy: d.bs, out: d.out, lvl: d.lv, open: d.op, moving: d.mv });
      Object.assign(b, { on: !!d.on, pipe: d.pp });
      if (b.cs && d.cs != null) b.cs.y = d.cs;
      if (b.type === 'base') G.base = b;
    },
  },
  trees: {
    list: trees,
    pack: t => ({
      id: t.id,
      x: t.x,
      gy: t.gy,
      ty: t.type,
      st: t.stage,
      fa: t.fall,
      an: r2(t.ang),
      bu: t.burn > 0 ? 1 : 0,
    }),
    create: d => ({ id: d.id, x: d.x, gy: d.gy, type: d.ty, stage: d.st, hp: 1, fall: 0, ang: 0, grow: 0, burn: 0 }),
    apply: (t, d) => {
      if (!t.spr || t.stage !== d.st) t.spr = treeSprite(d.ty, d.st);
      Object.assign(t, { stage: d.st, fall: d.fa, ang: d.an, burn: d.bu ? 30 : 0 });
    },
  },
};
// entities that move are eased towards the reported position on the client
const MOVING = new Set(['crew', 'items', 'animals', 'lorries']);

// ---- shared game values ----
function packGame() {
  return {
    money: G.money,
    earned: G.earned,
    store: G.store,
    tools: G.tools,
    mark: G.mineMark,
    beams: G.beams,
    mis: G.mis,
    gold: G.goldSold,
    chests: G.chests && G.chests.map(c => (c.open ? 1 : 0)),
    rainT: G.rainT,
    ticks: G.playTicks,
  };
}
function applyGame(d) {
  Object.assign(G, {
    money: d.money,
    earned: d.earned,
    store: d.store,
    tools: d.tools,
    mineMark: d.mark,
    beams: d.beams,
    mis: d.mis,
    goldSold: d.gold,
    rainT: d.rainT,
    playTicks: d.ticks,
  });
  if (G.chests && d.chests) G.chests.forEach((c, k) => (c.open = !!d.chests[k]));
}

export { KINDS, MOVING, applyGame, packGame };
