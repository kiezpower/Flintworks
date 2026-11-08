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
import { G, animals, builds, crew, parts } from './state.js';
import { stock, takeStock } from './store.js';
import { toast } from './ui.js';
import { isFoe } from './entities.js';
import { addFloat } from './floats.js';
import { W, rnd, solid } from './world.js';

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

// every frame: damaged pieces are mended by a Wühler nearby, cannon balls fly
const balls = [];
function updFort() {
  if (G.frame % 20 === 0)
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
      for (const m of animals)
        if (isFoe(m) && o.x > m.x - 1 && o.x < m.x + m.w + 1 && o.y > m.y - 1 && o.y < m.y + m.h + 1) {
          hit = true;
          break;
        }
    if (!hit) continue;
    balls.splice(k, 1);
    if (xi >= 0 && xi < W) explode(o.x, o.y, 4);
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
  for (const a of animals) {
    if (!isFoe(a) || a.kind === 'bat') continue;
    // (never at one right next to your own Wühler: the blast would hit them too)
    if (crew.some(c => !c.dead && Math.abs(c.x + 3 - (a.x + a.w / 2)) < 22 && Math.abs(c.y - a.y) < 20)) continue;
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
  balls.push({ x: ox + b.aim * 7, y: oy, vx: (tx - ox - b.aim * 7) / t, vy: (ty - oy) / t - 0.03 * t, l: 240 });
  b.cd = 150;
  b.fireT = G.frame;
  for (let k = 0; k < 6; k++)
    parts.push({ x: ox + b.aim * 8, y: oy, vx: b.aim * rnd() * 0.8, vy: -rnd() * 0.4, l: 30, c: 'rgba(200,196,188,0.6)', s: 2, g: -0.004 });
  G.shake = Math.max(G.shake || 0, 1.5);
  sfx('thud', ox, oy, 0.7);
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

export { FORT_H, FORT_HP, breakFort, cannonUpd, clearWall, drawFort, fortHp, hitFort, isFort, joins, strikeFort, updFort };
