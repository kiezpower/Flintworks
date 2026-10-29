// Bots: opponents that play a castle like a person would, so a quick play round can start
// without waiting for others. A bot is not a helper. Helpers (helpers.js) only work for their
// own store: mine, collect, carry home. A bot plays to win: it looks at the round every second
// and picks a plan:
//   storm   – walk up to an enemy castle, aim (the throw is worked out in advance) and throw
//             flint and TNT at it
//   arm     – out of explosives: home to the castle, take them from the store or buy them
//   pickup  – supplies dropped from the sky or explosives lying close by: grab them
//   hill    – take the hill in the middle and hold it while it pays
//   defend  – an enemy at its own castle: go there, strike with the sword or throw
//   dig     – a race to the depth (Wettgraben): dig down next to its castle
//   earn    – no money for explosives: mine and sell like a helper would
//   home    – exhausted: rest in the castle
// Every bot has a style (storm, hill or earn first), so no two play the same. A bot carries a
// player id of its own (negative), so it counts like a player: it buys, throws, picks up,
// keeps its explosives at the base and shows up in the ranking. Only the host runs bots; the
// others see them like any Wühler. A person joining the round late takes over a bot's castle.
import { NOIN } from './clonk.js';
import { addClonk, insideB, midMat, spawnItem } from './entities.js';
import { swordContext } from './combat.js';
import { exec } from './commands.js';
import { helperAI } from './helpers.js';
import { mode } from './modes.js';
import { G, INV_MAX, builds, crew, items } from './state.js';
import { stock } from './store.js';
import { teamOf, useTeam } from './teams.js';
import { CASTLE_HP, castleOf } from './versus.js';
import { H, LIQ, SOLID, W, free, mat } from './world.js';

const NAMES = ['Kiesel', 'Brocken', 'Funke', 'Schotter', 'Lunte', 'Knall'];
const STYLES = ['storm', 'hill', 'earn'];
const AMMO = ['flint', 'tnt'];
const THINK = 60; // frames between two looks at the round
const SEC = 60;

const isBot = c => !!c && !!c.bot;
const botPid = t => -10 - t;
const ammo = c => c.inv.filter(t => AMMO.includes(t)).length;
const mid = b => b.x + b.w / 2;
const solidAt = (x, y) => x < 0 || y < 0 || x >= W || y >= H || SOLID[mat[y * W + x]] === 1;
// where a Wühler stands at column x (its top-left y)
function standY(x) {
  x = Math.max(0, Math.min(W - 1, Math.round(x)));
  let y = 0;
  while (y < H - 1 && !solidAt(x, y)) y++;
  return y - 10;
}

// a bot for team t at its castle (host, right after the world is made)
function addBot(t, k = t) {
  const b = castleOf(t);
  if (!b) return null;
  const c = addClonk(b.x + 12, b.gy - 10);
  Object.assign(c, {
    pid: botPid(t),
    bot: true,
    team: t,
    name: `${NAMES[k % NAMES.length]} (Bot)`,
    hat: ['helm', 'miner', 'cap'][k % 3],
    inv: ['flint', 'flint'],
  });
  c.brain = { style: STYLES[k % STYLES.length], seed: c.id * 7919 + k };
  return c;
}
// a bot's own dice (the same round plays the same way; the world's dice stay untouched)
function dice(B) {
  B.seed = (Math.imul(B.seed || 1, 1103515245) + 12345) >>> 0;
  return B.seed / 4294967296;
}
// a person joins the round and takes the castle of team t: its bot hands over its Wühler
function takeOverBot(t, p) {
  const c = crew.find(o => isBot(o) && teamOf(o) === t);
  if (!c) return null;
  Object.assign(c, { pid: p.pid, name: p.name, cap: p.cap, hat: p.hat, skin: p.skin, bot: false, brain: null, job: null, path: null });
  return c;
}

// ---- looking at the round ----
const foeCastles = c =>
  builds.filter(b => b.type === 'base' && b.hp > 0 && teamOf(b) !== teamOf(c) && !(G.mp.out || []).includes(teamOf(b)));
function nearestFoeCastle(c) {
  let best = null;
  for (const b of foeCastles(c)) if (!best || Math.abs(mid(b) - c.x) < Math.abs(mid(best) - c.x)) best = b;
  return best;
}
// an enemy Wühler at our castle
function intruder(c) {
  const home = castleOf(teamOf(c));
  if (!home) return null;
  return crew.find(o => !o.dead && teamOf(o) !== teamOf(c) && Math.abs(o.x + 3 - mid(home)) < 70 && Math.abs(o.y - home.gy) < 40);
}
// explosives lying around close by (supplies, the chest's loot, a dud)
// (B.skip: ones it could not reach)
const looseAmmo = (c, B = c.brain) =>
  items.find(
    it =>
      AMMO.includes(it.t) &&
      !(it.fuse >= 0) &&
      !it.armed &&
      !B?.skip?.has(it) &&
      Math.abs(it.x - c.x) < 220 &&
      Math.abs(it.y - c.y) < 80,
  );
const onHill = (o, h) => Math.abs(o.x + 3 - h.x) < h.r && Math.abs(o.y + 10 - h.y) < 26;
const depthGoal = () => mode().pkg?.goals?.some(g => g.t === 'depth');

// what to do next: every plan gets a score, the style and a bit of chance tip the scales
function decide(c, B) {
  const me = teamOf(c),
    h = G.mp.hill,
    a = ammo(c),
    foe = nearestFoeCastle(c),
    late = G.mp.len && G.mp.len - (G.playTicks || 0) < 90 * SEC,
    style = B.style;
  if (c.energy < 35) return 'home';
  if (intruder(c)) return 'defend';
  const S = {
    storm: a && foe ? 3 + (style === 'storm' ? 2 : 0) + (foe.hp < CASTLE_HP / 3 ? 3 : 0) + (late ? 2 : 0) : 0,
    arm: !a && foe && (G.money >= 10 || stock('flint') + stock('tnt') > 0) ? 2.5 + (style === 'storm' ? 1.5 : 0) : 0,
    pickup: c.inv.length < INV_MAX && looseAmmo(c) ? 4 : 0,
    hill:
      h && h.own !== me && !crew.some(o => o !== c && !o.dead && teamOf(o) === me && onHill(o, h))
        ? 2 + (style === 'hill' ? 2.5 : 0) + (h.own >= 0 ? 1 : 0)
        : 0,
    dig: depthGoal() ? 5 : 0,
    earn: 1.5 + (G.money < 10 ? 1.5 : 0) + (style === 'earn' ? 1.5 : 0),
  };
  let best = 'earn',
    bs = -1;
  for (const k in S) {
    const v = S[k] && S[k] + dice(B) * 1.5;
    if (v > bs) {
      bs = v;
      best = k;
    }
  }
  return best;
}
// how long a plan may run before the bot looks again from scratch
const LEN = { storm: 40, arm: 30, pickup: 15, hill: 45, defend: 20, dig: 30, earn: 25, home: 20 };

function setPlan(c, B, plan) {
  if (B.plan !== plan) {
    c.job = c.path = null;
    c.focus = plan === 'earn' ? 'ore' : 'all';
  }
  Object.assign(B, { plan, t0: G.frame, until: G.frame + LEN[plan] * SEC, spot: null, item: null, held: 0 });
}
// walk to a spot and stay there (helpers' path finding); true once there
function goTo(c, x, y, r = 5, ry = 10) {
  const j = c.job;
  if (!j || j.type !== 'goto' || Math.abs(j.x - x) > 6 || Math.abs(j.y - y) > 6) {
    c.job = { type: 'goto', x, y, r, ry, t: G.frame };
    c.path = null;
  }
  return !!(c.job && c.job.arrived);
}

// far away or no path found (the helpers' search is made for short ways around the castle):
// walk like a person, towards the spot, jumping onto ledges and digging through walls; stuck
// (rock, a cave): turn round for a moment, and when nothing helps go back to the castle
function steer(c, I, j, B) {
  const dx = j.x - (c.x + 3);
  if (Math.abs(dx) <= (j.r || 5) && Math.abs(j.y - c.y) <= (j.ry || 8) + 4) {
    j.arrived = true;
    return;
  }
  const S = B.st || (B.st = { x: c.x, y: c.y, t: G.frame, n: 0, back: 0 });
  if (G.frame - S.t > 120) {
    const moved = Math.abs(c.x - S.x) + Math.abs(c.y - S.y);
    S.n = moved < 4 ? S.n + 1 : 0;
    Object.assign(S, { x: c.x, y: c.y, t: G.frame });
    if (S.n === 1) S.back = G.frame + 50;
    if (S.n === 2) S.up = G.frame + 90;
    if (S.n >= 3) {
      backHome(c);
      S.n = 0;
      B.done = true;
      return;
    }
  }
  let dir = Math.sign(dx) || c.face;
  if (S.back > G.frame) dir = -dir;
  I.ax = dir;
  // in water: swim up and across
  if (LIQ[midMat(c, 0.1)]) {
    I.ay = -1;
    return;
  }
  const grounded = !free(c.x, c.y + 1, 6, 10),
    wall = !free(c.x + dir * 1.5, c.y, 6, 10);
  // a step or a ledge: jump first, dig only into a wall that stays
  S.wall = wall ? (S.wall || 0) + 1 : 0;
  if (wall && grounded && G.frame - (c.jumpT || 0) > 30) {
    I.jumpP = true;
    c.jumpT = G.frame;
  }
  // the spot is far below (a pit, the race to the depth): dig down at a slant; above (in a cave,
  // a pit, or stuck for the second time): dig up at a slant
  if (j.y - c.y > 30 && Math.abs(dx) < 20) Object.assign(I, { ay: 1, ax: dir * 0.3, dig: true });
  else if (c.y - j.y > 12 || S.up > G.frame) Object.assign(I, { ay: -1, dig: true });
  else if (wall && S.wall > 40) I.dig = true;
}
// lost for good: back into the castle (like a helper that finds no way home)
function backHome(c) {
  const b = castleOf(teamOf(c)) || G.base;
  Object.assign(c, { x: b.x + 12, y: b.gy - 11, vx: 0, vy: 0, job: null, path: null });
}

// ---- aiming: fly the three throws (normal, high, low) like the item would and pick one that
// lands on the target (a box); returns { ay, land } with the best miss when nothing hits ----
function aim(c, face, box) {
  const vx0 = c.vx * 0.5;
  let best = null;
  for (const [ay, vx, vy] of [
    [0, face * 2.5 + vx0, -2],
    [-1, face * 1.4, -3.2],
    [1, face * 0.5, 0],
  ]) {
    let x = c.x + 2 + face * 3,
      y = c.y + 1,
      u = vx,
      v = vy;
    for (let k = 0; k < 160; k++) {
      x += u;
      v += 0.15;
      y += v;
      const hit = x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1;
      if (hit) return { ay, land: x, hit: true };
      if (solidAt(Math.round(x + 1), Math.round(y + 2)) || y > H) break;
    }
    if (!best || Math.abs(x - (box.x0 + box.x1) / 2) < Math.abs(best.land - (box.x0 + box.x1) / 2)) best = { ay, land: x };
  }
  return best;
}
// throw what is in the pockets (flint first) with the chosen arc
function throwAt(c, I, face, ay) {
  if (G.frame - (c.brain.thrown || -999) < 45 || c.tumble || c.climb) return false;
  const k = c.inv.indexOf('flint') >= 0 ? c.inv.indexOf('flint') : c.inv.indexOf('tnt');
  if (k < 0) return false;
  c.face = face;
  c.isel = k;
  I.ax = 0;
  I.ay = ay;
  I.throwP = true;
  c.brain.thrown = G.frame;
  return true;
}

// ---- the plans ----
function storm(c, B, I) {
  const b = nearestFoeCastle(c);
  if (!b || !ammo(c)) return true;
  const side = Math.sign(c.x + 3 - mid(b)) || 1;
  // stand about a throw away, on the side the bot comes from; the aim moves the spot after a miss
  if (!B.spot || B.spot.b !== b) B.spot = { b, x: mid(b) + side * (b.w / 2 + 42) };
  const sx = Math.max(8, Math.min(W - 10, B.spot.x));
  const face = Math.sign(mid(b) - (c.x + 3)) || 1;
  const box = { x0: b.x - 2, x1: b.x + b.w + 2, y0: b.gy - b.h - 2, y1: b.gy + 3 };
  if (!goTo(c, sx, standY(sx + 3), 6)) {
    // on the way, close by: a throw that already hits goes now
    if (Math.abs(mid(b) - c.x) < 120 && G.frame % 15 === 0) {
      const a = aim(c, face, box);
      if (a.hit) throwAt(c, I, face, a.ay);
    }
    return false;
  }
  const a = aim(c, face, box);
  if (a.hit) throwAt(c, I, face, a.ay);
  else if (G.frame - (B.moved || 0) > 30) {
    // short or too far: step so the throw lands in the middle of the castle
    B.spot.x += mid(b) - a.land;
    B.moved = G.frame;
    if (Math.abs(B.spot.x - mid(b)) < b.w / 2 + 8) B.spot.x = mid(b) + side * (b.w / 2 + 10);
  }
  return false;
}
function arm(c, B) {
  const home = castleOf(teamOf(c));
  if (!home) return true;
  if (!goTo(c, mid(home), home.gy - 10, home.w / 2 - 4) && !insideB(c, home)) return false;
  // from the store first, then bought (like a person in the base panel): TNT hits hardest, so
  // two of those when the cash allows, then flint; an order switches back to this device's team
  // afterwards, so switch to the bot's again
  const order = (name, t) => {
    const k = c.inv.length;
    exec(c.pid, name, { t });
    useTeam(teamOf(c));
    return c.inv.length > k;
  };
  const room = () => ammo(c) < 6 && c.inv.length < INV_MAX;
  for (const t of AMMO) while (stock(t) > 0 && room() && order('take', t));
  while (G.money >= 60 && c.inv.filter(t => t === 'tnt').length < 2 && room() && order('buy', 'tnt'));
  while (G.money >= 10 && room() && order('buy', 'flint'));
  return true;
}
// a bot keeps explosives and valuables; stones, wood and the like it picks up on the way go
// back on the ground (except while it earns: then it carries them home)
const KEEP = new Set([...AMMO, 'nug', 'gem']);
function dropJunk(c) {
  for (let k = c.inv.length - 1; k >= 0; k--) {
    if (KEEP.has(c.inv[k])) continue;
    const t = c.inv.splice(k, 1)[0];
    spawnItem(t, c.x + 2, c.y + 2, -c.face * 0.6, -1, 120);
  }
  c.isel = Math.min(c.isel, Math.max(0, c.inv.length - 1));
}
function home(c) {
  const b = castleOf(teamOf(c)) || G.base;
  goTo(c, mid(b), b.gy - 10, 6);
  return c.energy > 85;
}
function pickup(c, B) {
  const it = B.item && items.includes(B.item) ? B.item : (B.item = looseAmmo(c));
  if (!it || c.inv.length >= INV_MAX) return true;
  // out of reach (in the rock, across water): leave it
  if (G.frame - B.t0 > 12 * SEC) {
    (B.skip ||= new WeakSet()).add(it);
    return true;
  }
  goTo(c, it.x - 1, it.y - 7, 2);
  return false;
}
function hill(c, B) {
  const h = G.mp.hill;
  if (!h) return true;
  const x = h.x + (((c.id * 7) % 13) - 6);
  const there = goTo(c, x, h.y - 10, Math.max(4, h.r / 2), 20);
  // (where it counts as on the hill is enough)
  if (!there && onHill(c, h) && !c.dead) c.job.arrived = true;
  if (!there && !onHill(c, h)) return false;
  // stay while it pays and a little longer, then something else
  if (h.own === teamOf(c) && ++B.held > 12 * SEC) return true;
  return false;
}
function defend(c, B, I) {
  const o = intruder(c);
  if (!o) return true;
  const sw = swordContext(c);
  if (sw) {
    sw.fn();
    return false;
  }
  const dx = o.x - c.x;
  if (Math.abs(dx) < 70 && Math.abs(o.y - c.y) < 20 && ammo(c)) {
    const face = Math.sign(dx) || 1;
    const a = aim(c, face, { x0: o.x - 3, x1: o.x + 9, y0: o.y - 3, y1: o.y + 12 });
    if (a.hit && throwAt(c, I, face, a.ay)) return false;
  }
  goTo(c, Math.round(o.x), Math.round(o.y), 8);
  return false;
}
// dig down beside the castle in a zigzag (the stroke goes down at a slant)
function dig(c, B, I) {
  const home = castleOf(teamOf(c));
  if (!B.spot) B.spot = { x: home ? mid(home) + (mid(home) < W / 2 ? 50 : -50) : c.x, dir: 1 };
  if (!B.spot.down) {
    if (!goTo(c, B.spot.x, standY(B.spot.x + 3), 4)) return false;
    B.spot.down = true;
    c.job = c.path = null;
  }
  if (G.frame % 90 === 0) B.spot.dir *= -1;
  Object.assign(I, { ax: B.spot.dir * 0.3, ay: 1, dig: true });
  return false;
}

// one tick of a bot (host, instead of a person's input)
function botAI(c, n) {
  const B = c.brain || (c.brain = { style: STYLES[0] });
  if (!G.teams || !G.mp) return helperAI(c, n);
  // a fresh look: when the plan is done, has run its time, or something urgent happened
  const urgent = G.frame % THINK === 0 && B.plan !== 'defend' && intruder(c);
  if (!B.plan || G.frame >= B.until || B.done || urgent) {
    B.done = false;
    setPlan(c, B, decide(c, B));
  }
  // the walking comes from the helpers' path finding (earning: their jobs too); the bot adds
  // what it does there
  const there = c.job && c.job.type === 'goto' && c.job.arrived && !c.path;
  const walk = B.plan === 'earn' || (c.job && !there && !(B.plan === 'dig' && B.spot?.down));
  const j = c.job && c.job.type === 'goto' && !c.job.arrived ? c.job : null;
  // no path for a while: walk on its own for a few seconds, then try the path finding again
  B.np = j && !c.path ? (B.np || 0) + 1 : 0;
  if (B.np > 45) {
    B.steerT = G.frame + 150;
    B.np = 0;
  }
  const self = j && B.steerT > G.frame;
  const I = self ? { ...NOIN } : walk ? { ...helperAI(c, n) } : { ...NOIN };
  if (self) steer(c, I, j, B);
  else B.st = null;
  let done = false;
  if (B.plan === 'storm') done = storm(c, B, I);
  else if (B.plan === 'arm') done = arm(c, B);
  else if (B.plan === 'pickup') done = pickup(c, B);
  else if (B.plan === 'hill') done = hill(c, B);
  else if (B.plan === 'defend') done = defend(c, B, I);
  else if (B.plan === 'dig') done = dig(c, B, I);
  else if (B.plan === 'home') done = home(c);
  else if (B.plan === 'earn') done = G.frame - B.t0 > 10 * SEC && G.money >= 20 && !!nearestFoeCastle(c);
  if (B.plan !== 'earn' && G.frame % 60 === n % 60) dropJunk(c);
  // a sword hit at an enemy right in front, whatever the plan
  if (B.plan !== 'defend' && G.frame % 20 === n % 20) swordContext(c)?.fn();
  B.done = done;
  return I;
}

export { addBot, botAI, isBot, takeOverBot };
