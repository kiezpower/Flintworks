// A fortress: walls, the gate, towers and the cannon tower hold monsters off. They have hit points
// (fhp): a monster that walks into a wall or a closed gate strikes it, and a Wühler standing next
// to a damaged piece mends it once the fighting there has stopped. The cannon tower shoots iron
// balls at monsters that burst on impact; it fires with coal from the store (1 coal, 3 shots).
// Walls are solid for everybody (world.js free), the gate only lets your crew through; above the
// gate a stone lintel closes the gap a monster could jump through.
import { drawCrafted } from './bldart.js';
import { tr } from './i18n.js';
import { SPR } from './sprites.js';
import { explode } from './objects.js';
import { sfx } from './sound.js';
import { G, animals, builds, crew, onNewWorld, parts } from './state.js';
import { stock, takeStock } from './store.js';
import { toast } from './ui.js';
import { isFoe } from './entities.js';
import { addFloat } from './floats.js';
import { W, free, rnd, solid } from './world.js';
import { fireArrow } from './combat.js';
import { teamOf } from './teams.js';

// how much a piece takes; and the height everything of a fortress closes off
// (the castle only takes blows in a siege, siege.js; it never crumbles away, the level is lost)
const FORT_HP = { wall: 600, gate: 400, tower: 360, cannon: 420, base: 1000 };
const FORT_H = 24;
const isFort = b => !!FORT_HP[b.type];
const fortHp = b => b.fhp ?? FORT_HP[b.type];
// fortress pieces may stand right next to each other (a wall against the gate or a tower)
const joins = (a, b) => !!(FORT_HP[a] && FORT_HP[b]);

// a piece in the way of a creature that bumped into something going its way
function fortAhead(a) {
  const x0 = a.face > 0 ? a.x + a.w : a.x - 3,
    x1 = x0 + 3;
  for (const b of builds) {
    if (!b.done || (b.type !== 'wall' && b.type !== 'gate')) continue;
    if (x1 > b.x && x0 < b.x + b.w && a.y < b.gy && a.y + a.h > b.gy - FORT_H) return b;
  }
  return null;
}
// called when a monster is blocked: it strikes the wall or gate in front of it
function strikeFort(a, dmg, cd) {
  if (G.netClient || a.atk > 0) return false;
  const b = fortAhead(a);
  if (!b) return false;
  a.atk = cd;
  // (claws do less to dressed stone than to a Wühler)
  hitFort(b, dmg * 0.5, a.x + (a.face > 0 ? a.w : 0), a.y + a.h / 2);
  return true;
}
function hitFort(b, dmg, x, y) {
  b.fhp = fortHp(b) - dmg;
  b.fhitT = G.frame;
  for (let k = 0; k < 5; k++)
    parts.push({ x, y, vx: (rnd() - 0.5) * 1.6, vy: -rnd() * 1.4, l: 20, c: rnd() < 0.5 ? '#a69e92' : '#80796f', b: 1 });
  sfx('clack', x, y, 0.8);
  if (b.fhp <= 0) breakFort(b);
}
function breakFort(b) {
  if (b.type === 'base') {
    b.fhp = 0;
    G.shake = Math.max(G.shake || 0, 8);
    sfx('thud', b.x, b.gy);
    return;
  }
  const k = builds.indexOf(b);
  if (k >= 0) builds.splice(k, 1);
  for (let q = 0; q < 26; q++)
    parts.push({
      x: b.x + rnd() * b.w,
      y: b.gy - rnd() * b.h,
      vx: (rnd() - 0.5) * 2.4,
      vy: -rnd() * 2,
      l: 40 + rnd() * 30,
      c: rnd() < 0.6 ? '#a69e92' : '#6f6a64',
      s: rnd() < 0.4 ? 2 : 1,
      b: 1,
    });
  G.shake = Math.max(G.shake || 0, 5);
  sfx('thud', b.x, b.gy);
  toast('{name} zerstört!', { name: tr(b.type === 'wall' ? 'Mauer' : b.type === 'gate' ? 'Tor' : 'Turm') });
}
// a finished wall must not hold anybody inside it: Wühler and creatures step out to the nearer side
function clearWall(b) {
  if (b.type !== 'wall') return;
  for (const e of [...crew, ...animals]) {
    if (e.x + (e.w || 6) <= b.x || e.x >= b.x + b.w || e.y >= b.gy || e.y + (e.h || 10) <= b.gy - FORT_H) continue;
    const left = b.x - (e.w || 6) - 1,
      right = b.x + b.w + 1;
    e.x = Math.abs(e.x - left) < Math.abs(e.x - right) ? left : right;
  }
}

// "Auf die Mauer": a Wühler standing right at a wall or a gate climbs up onto it
const TOPS = { wall: 1, gate: 1 };
function wallContext(c) {
  if (c.climb || c.tumble || c.ride != null || free(c.x, c.y + 1, 6, 10)) return null;
  for (const b of builds) {
    if (!b.done || !TOPS[b.type] || Math.abs(c.y + 10 - b.gy) > 4) continue;
    // (in Versus only onto your own team's walls)
    if (G.teams && teamOf(b) !== teamOf(c)) continue;
    const touch = Math.abs(c.x + 6 - b.x) < 2.5 || Math.abs(c.x - (b.x + b.w)) < 2.5;
    if (!touch) continue;
    const nx = b.x + b.w / 2 - 3,
      ny = b.gy - FORT_H - 10;
    if (!free(nx, ny, 6, 10)) continue;
    return {
      label: 'Auf die Mauer',
      fn: () => {
        Object.assign(c, { x: nx, y: ny, vx: 0, vy: 0 });
        sfx('jump', c.x, c.y);
      },
    };
  }
  return null;
}
// the piece a Wühler stands on top of (a post on the wall), or null
const postOf = c =>
  builds.find(
    b => b.done && TOPS[b.type] && c.x + 6 > b.x && c.x < b.x + b.w && Math.abs(c.y + 10 - (b.gy - FORT_H)) < 1.5,
  ) || null;
// what a post or a cannon of this side shoots at: monsters, and in Versus the other teams' Wühler
function foesOf(side) {
  const list = animals.filter(a => isFoe(a) && a.kind !== 'bat');
  if (G.teams) for (const c of crew) if (!c.dead && teamOf(c) !== teamOf(side)) list.push(c);
  return list;
}
// explosions of the other team (Versus) knock pieces of a fortress down; your own do not
function blastForts(cx, cy, r, by) {
  if (!G.teams || !by || G.netClient) return;
  for (const b of [...builds]) {
    if (!isFort(b) || b.type === 'base' || !b.done || teamOf(b) === (by.team || 0)) continue;
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w)),
      ny = Math.max(b.gy - (b.type === 'wall' || b.type === 'gate' ? FORT_H : b.h), Math.min(cy, b.gy));
    if (Math.hypot(nx - cx, ny - cy) < r + 4) hitFort(b, r * 8, nx, ny);
  }
}
// a Wühler on a wall shoots at monsters below by himself: an arrow a second, no bow needed
const POST_RANGE = 150;
function postShoot(c) {
  if (c.dead || c.ride != null || !postOf(c)) return;
  if (c.postCd > 0) {
    c.postCd--;
    return;
  }
  const ox = c.x + 3,
    oy = c.y + 3;
  let tgt = null,
    bd = POST_RANGE;
  for (const a of foesOf(c)) {
    const d = Math.hypot(a.x + a.w / 2 - ox, a.y + a.h / 2 - oy);
    if (d < bd) {
      bd = d;
      tgt = a;
    }
  }
  if (!tgt) return;
  const dx = tgt.x + tgt.w / 2 - ox,
    dy = tgt.y + tgt.h / 2 - oy,
    t = Math.max(8, Math.hypot(dx, dy) / 4.2);
  c.face = Math.sign(dx) || c.face;
  fireArrow({ x: ox, y: oy, vx: dx / t, vy: dy / t - 0.03 * t, l: 120, dmg: 16, tm: G.teams ? teamOf(c) : undefined, by: c.pid });
  c.postCd = 60;
  sfx('bow', ox, oy);
}

// every frame: damaged pieces are mended by a Wühler nearby, cannon balls fly, Wühler on the
// walls shoot
const balls = [];
onNewWorld.push(() => (balls.length = 0));
function updFort() {
  if (!G.netClient) for (const c of crew) postShoot(c);
  if (G.frame % 20 === 0 && !G.netClient)
    for (const b of builds) {
      if (!isFort(b) || !b.done || fortHp(b) >= FORT_HP[b.type] || G.frame - (b.fhitT || 0) < 300) continue;
      const near = crew.some(c => !c.dead && c.x + 6 > b.x - 10 && c.x < b.x + b.w + 10 && Math.abs(c.y + 10 - b.gy) < 14);
      if (!near) continue;
      b.fhp = Math.min(FORT_HP[b.type], fortHp(b) + 8);
      if (G.frame % 60 === 0) addFloat(b.x + b.w / 2, b.gy - b.h - 4, '+', '#cfe8a8');
    }
  for (let k = balls.length - 1; k >= 0; k--) {
    const o = balls[k];
    o.vy += 0.06;
    o.x += o.vx;
    o.y += o.vy;
    if (G.frame % 2 === 0) parts.push({ x: o.x, y: o.y, vx: 0, vy: -0.15, l: 14, c: 'rgba(120,116,110,0.6)', g: -0.002 });
    const xi = Math.floor(o.x),
      yi = Math.floor(o.y);
    let hit = xi < 0 || xi >= W || --o.l <= 0 || solid(xi, yi);
    if (!hit)
      for (const m of foesOf({ team: o.tm || 0 }))
        if (o.x > m.x - 1 && o.x < m.x + m.w + 1 && o.y > m.y - 1 && o.y < m.y + m.h + 1) {
          hit = true;
          break;
        }
    if (!hit) continue;
    balls.splice(k, 1);
    // (on a client the ball is only a picture: the blast comes from the host)
    if (xi >= 0 && xi < W && !G.netClient) explode(o.x, o.y, 4);
  }
}
// the cannon tower: aims at the nearest monster within reach and fires an arcing ball
const CANNON_RANGE = 230;
function cannonUpd(b) {
  if (b.cd > 0) {
    b.cd--;
    return;
  }
  const ox = b.x + b.w / 2,
    oy = b.gy - b.h + 4;
  let tgt = null,
    bd = CANNON_RANGE;
  for (const a of foesOf(b)) {
    // (never at one right next to your own Wühler: the blast would hit them too)
    if (crew.some(c => c !== a && !c.dead && teamOf(c) === teamOf(b) && Math.abs(c.x + 3 - (a.x + a.w / 2)) < 22 && Math.abs(c.y - a.y) < 20))
      continue;
    const d = Math.hypot(a.x + a.w / 2 - ox, a.y - oy);
    if (d < bd && Math.abs(a.x + a.w / 2 - ox) > 14) {
      bd = d;
      tgt = a;
    }
  }
  b.cd = 30;
  if (!tgt) return;
  if (!(b.ammo > 0)) {
    if (stock('coal') < 1) {
      if (G.frame - (b.noAmmoT || -9999) > 900) {
        b.noAmmoT = G.frame;
        addFloat(ox, oy - 8, tr('Keine Kohle'), '#ffb0a0');
      }
      return;
    }
    takeStock('coal', 1);
    b.ammo = 3;
  }
  b.ammo--;
  // flight time from the distance; aim where it will be and lift for the fall
  const tx = tgt.x + tgt.w / 2 + tgt.vx * (bd / 3.2),
    ty = tgt.y + tgt.h / 2,
    t = Math.max(18, Math.hypot(tx - ox, ty - oy) / 3.2);
  b.aim = Math.sign(tx - ox);
  const ball = { x: ox + b.aim * 7, y: oy, vx: (tx - ox - b.aim * 7) / t, vy: (ty - oy) / t - 0.03 * t, l: 240, tm: teamOf(b) };
  balls.push(ball);
  if (G.netHost) G.netEvent(['cb', Math.round(ball.x), Math.round(ball.y), ball.vx, ball.vy]);
  b.cd = 150;
  b.fireT = G.frame;
  for (let k = 0; k < 6; k++)
    parts.push({ x: ox + b.aim * 8, y: oy, vx: b.aim * rnd() * 0.8, vy: -rnd() * 0.4, l: 30, c: 'rgba(200,196,188,0.6)', s: 2, g: -0.004 });
  G.shake = Math.max(G.shake || 0, 1.5);
  sfx('thud', ox, oy, 0.7);
}

// on a client: a ball the host fired, to show it flying
function playBall(e) {
  if (e[0] !== 'cb') return false;
  balls.push({ x: e[1], y: e[2], vx: e[3], vy: e[4], l: 240 });
  G.ballsSeen = (G.ballsSeen || 0) + 1; // (how many came in; the tests read it)
  return true;
}

// drawing: the lintel over every gate, the cannon's barrel, cracks and a bar on damaged pieces,
// and the balls in flight
function drawFort(ctx, cx, cy) {
  for (const b of builds) {
    if (!isFort(b) || !b.done) continue;
    const sx = b.x - cx,
      sy = b.gy - cy;
    if (sx > G.VW + 4 || sx + b.w < -4) continue;
    // a stone lintel with two merlons above the gate, in the same dressed stone as the wall
    if (b.type === 'gate') drawCrafted(ctx, SPR.lintel, sx, sy - FORT_H - 2);
    if (b.type === 'cannon') {
      // the barrel points at the last target and kicks back when it fires
      const d = b.aim || 1,
        kick = G.frame - (b.fireT || -99) < 8 ? 1 : 0,
        bx = sx + b.w / 2 + d * (2 - kick),
        by = sy - b.h + 3;
      ctx.fillStyle = '#3a3836';
      ctx.fillRect(d > 0 ? bx : bx - 6, by, 6, 3);
      ctx.fillStyle = '#5a5652';
      ctx.fillRect(d > 0 ? bx : bx - 6, by, 6, 1);
    }
    const hp = fortHp(b),
      max = FORT_HP[b.type];
    if (hp >= max) continue;
    // cracks that grow with the damage, and the hit points over it
    ctx.fillStyle = '#3c3a38';
    const n = hp < max * 0.35 ? 3 : hp < max * 0.7 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const x = sx + 2 + ((k * 5 + b.x) % Math.max(1, b.w - 3)),
        y = sy - 6 - k * 6;
      ctx.fillRect(x, y, 1, 2);
      ctx.fillRect(x + 1, y + 2, 1, 2);
      ctx.fillRect(x, y + 4, 1, 1);
    }
    const top = sy - (b.type === 'wall' || b.type === 'gate' ? FORT_H : b.h) - 5,
      w = Math.max(8, b.w);
    ctx.fillStyle = 'rgba(20,12,6,0.6)';
    ctx.fillRect(sx + b.w / 2 - w / 2, top, w, 2);
    ctx.fillStyle = hp < max * 0.35 ? '#e8504a' : '#8fd06a';
    ctx.fillRect(sx + b.w / 2 - w / 2, top, Math.ceil((w * hp) / max), 2);
  }
  for (const o of balls) {
    ctx.fillStyle = '#2a2826';
    ctx.fillRect(Math.round(o.x - cx) - 1, Math.round(o.y - cy) - 1, 2, 2);
  }
}

export { blastForts, playBall, FORT_H, FORT_HP, breakFort, cannonUpd, clearWall, drawFort, fortHp, hitFort, isFort, joins, postOf, strikeFort, updFort, wallContext };
