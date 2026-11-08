import { cam } from './render.js';
import { buzz } from './sound.js';
import { addFloat } from './floats.js';
import { track } from './profile.js';
import { FX_PAL, rainSplash, ripple, sparks, splash } from './effects.js';
import { guard } from './combat.js';
import { hurt, startTumble } from './digger.js';
import { isFoe, midMat, moveBody, overlap, spawnItem, unstuck } from './entities.js';
import { canPlantAt, plantTree } from './gen.js';
import { sfx } from './sound.js';
import { treeSprite } from './sprites.js';
import { INV_MAX, G, animals, builds, crew, flashes, items, lorries, parts, trees } from './state.js';
import { damageCastle } from './versus.js';
import { toast } from './ui.js';
import { blastForts, hitFort, strikeFort } from './fort.js';
import { atCastle, siegeMarch } from './siege.js';
import { wormUpd } from './boss.js';
import { announceBanner } from './announce.js';
import { igniteNear } from './fire.js';
import {
  ACID,
  AIR,
  BLAST,
  COAL,
  EARTH,
  GOLD,
  H,
  LAVA,
  LIQ,
  LOAM,
  ORE,
  PLANK,
  ROCK,
  SAND,
  W,
  WATER,
  OIL,
  bg,
  free,
  mat,
  matAt,
  paint,
  ri,
  rnd,
  setMat,
  solid,
} from './world.js';

// ---- Items, trees, animals, explosions, particles ----
function updItems() {
  // explosions and cave-ins leave lots of rubble: keep the item count bounded
  if (items.length > 160 && G.frame % 60 === 0)
    for (let k = 0; k < items.length && items.length > 140; k++) {
      const it = items[k];
      if (it.t === 'rock' && it.fuse < 0 && Math.abs(it.x - cam.x - G.VW / 2) > G.VW) items.splice(k--, 1);
    }
  for (let k = items.length - 1; k >= 0; k--) {
    const it = items[k];
    if (it.pd > 0) it.pd--;
    if (it.fuse > 0) {
      if (it.t === 'tnt' && G.frame % 3 === 0)
        parts.push({
          x: it.x + 1,
          y: it.y - 1,
          vx: (rnd() - 0.5) * 0.6,
          vy: -rnd() * 0.8,
          l: 8,
          c: rnd() < 0.5 ? '#ffe066' : '#ff7a2f',
        });
      if (--it.fuse === 0) {
        items.splice(k, 1);
        explode(it.x + 1, it.y + 1, it.t === 'tnt' ? 19 : 11, it.thrower);
        continue;
      }
    }
    const inL = midMat(it, 0.5);
    if (inL === LAVA && (it.t === 'wood' || it.t === 'loam')) {
      items.splice(k, 1);
      for (let q = 0; q < 6; q++)
        parts.push({ x: it.x, y: it.y, vx: rnd() - 0.5, vy: -rnd(), l: 20, c: '#ffb03a', g: -0.02 });
      continue;
    }
    if (inL === LAVA && (it.t === 'flint' || it.t === 'tnt')) {
      items.splice(k, 1);
      explode(it.x + 1, it.y + 1, it.t === 'tnt' ? 19 : 11, it.thrower);
      continue;
    }
    const inW = LIQ[inL];
    if (inW && !it.wasLiq && it.vy > 1.5) splash(it.x, it.y, 5);
    it.wasLiq = inW;
    const floats = it.t === 'wood';
    if (inW && floats) {
      it.vy -= 0.08;
      it.vy *= 0.85;
      it.vx *= 0.95;
    }
    it.vy += inW ? 0.04 : 0.15;
    if (inW) {
      it.vx *= 0.92;
      it.vy *= 0.92;
    }
    unstuck(it);
    let impact = 0;
    const vx0 = it.vx,
      vy0 = it.vy;
    const [bx] = moveBody(it, it.vx, 0, 0);
    if (bx) {
      impact = Math.abs(vx0);
      it.vx = -vx0 * 0.35;
    }
    const [, by2] = moveBody(it, 0, it.vy, 0);
    let onG = false;
    if (by2) {
      impact = Math.max(impact, Math.abs(vy0));
      onG = vy0 >= 0;
      it.vy = -vy0 * 0.3;
      it.vx *= 0.75;
      if (Math.abs(it.vy) < 0.5) it.vy = 0;
      if (impact > 1.8 && !inW) sfx('clack', it.x, it.y, impact / 4);
    }
    if (!onG) onG = !free(it.x, it.y + 1, it.w, it.h);
    // roll down slopes
    if (onG && (it.t === 'rock' || it.t === 'flint' || it.t === 'nug')) {
      const l = free(it.x - 1, it.y + 1, it.w, it.h),
        r = free(it.x + 1, it.y + 1, it.w, it.h);
      if (l && !r) it.vx -= 0.06;
      else if (r && !l) it.vx += 0.06;
      else it.vx *= 0.9;
    } else if (onG) it.vx *= 0.85;
    if (Math.abs(it.vx) < 0.03) it.vx = 0;
    if (it.armed && impact > 0.8 && it.pd < 34) {
      items.splice(k, 1);
      explode(it.x + 1, it.y + 1, 11, it.thrower);
      continue;
    }
    // hits
    const sp = Math.hypot(it.vx, it.vy);
    // only thrown things and cave-in rubble hurt; dug-out lumps falling down a shaft do not
    if (sp > 2 && it.t !== 'nug' && (it.thrower || it.rubble)) {
      for (const e of [...crew, ...animals]) {
        if (e.dead || (e === it.thrower && it.pd > 0) || !overlap(it, e, 0)) continue;
        if (it.armed) {
          items.splice(k, 1);
          explode(it.x + 1, it.y + 1, 11, it.thrower);
          break;
        }
        if (e.kind === 'digger') {
          if (it.thrower) e.lastHit = { pid: it.thrower.pid ?? null, team: it.thrower.team || 0, f: G.frame };
          hurt(e, sp * 3 * guard(e, 'hit'));
          if (sp > 3.2) startTumble(e, it.vx * 0.6, -1);
        } else {
          e.hp -= sp * 4;
          e.hurt = 10;
        }
        it.vx *= -0.3;
        it.vy = -1;
        sfx('clack', it.x, it.y);
        break;
      }
      if (items[k] !== it) continue;
    }
    // pickup: items roll towards a Wühler standing close by, then get collected
    if (it.pd <= 0 && sp < 1.5 && it.fuse < 0) {
      for (const c of crew) {
        if (c.dead || c.tumble || c.puppet || c.inv.length >= INV_MAX) continue;
        const dx = c.x + 3 - (it.x + it.w / 2),
          dy = c.y + 5 - (it.y + it.h / 2);
        if (Math.abs(dx) < 12 && Math.abs(dy) < 10 && !overlap(it, c, 1)) {
          it.vx += Math.max(-0.25, Math.min(0.25, dx * 0.05));
          continue;
        }
        if (!overlap(it, c, 1)) continue;
        items.splice(k, 1);
        c.inv.push(it.t);
        sfx('pick', c.x, c.y);
        addFloat(c.x + 3, c.y - 4, '+1', '#ffffff', it.t);
        break;
      }
    }
    if (it.y > H + 10) items.splice(k, 1);
  }
}
function updTrees() {
  for (let k = trees.length - 1; k >= 0; k--) {
    const t = trees[k];
    if (t.burn > 0) {
      t.burn -= G.rainT > 0 ? 3 : 1;
      const h = t.spr.height;
      for (let q = 0; q < 2; q++) {
        const l = 14 + rnd() * 10;
        parts.push({
          x: t.x + (rnd() - 0.5) * t.spr.width * 0.8,
          y: t.gy - h * 0.3 - rnd() * h * 0.6,
          vx: (rnd() - 0.5) * 0.3,
          vy: -0.4 - rnd() * 0.6,
          l,
          l0: l,
          pal: FX_PAL.spark,
          g: -0.012,
        });
      }
      // embers carried high up by the heat
      if (rnd() < 0.12) sparks(t.x, t.gy - h * 0.8, 1, 1.6);
      // smoke over the crown: grows and cools as it drifts off with the wind
      if (rnd() < 0.15) {
        const l = 80 + rnd() * 40;
        parts.push({
          x: t.x + (rnd() - 0.5) * 4,
          y: t.gy - h,
          vx: G.wind * 0.22 + (rnd() - 0.5) * 0.15,
          vy: -0.3 - rnd() * 0.15,
          l,
          l0: l,
          pal: FX_PAL.smokeDark,
          g: -0.002,
          s: 1,
          grow: 1,
        });
      }
      if (G.frame % 20 === k % 20)
        for (const o of trees) if (o !== t && !o.burn && !o.fall && Math.abs(o.x - t.x) < 16 && rnd() < 0.22) ignite(o);
      for (const c of crew)
        if (
          !c.dead &&
          !c.burn &&
          Math.abs(c.x + 3 - t.x) < t.spr.width / 2 &&
          c.y + 10 > t.gy - h &&
          c.y < t.gy &&
          rnd() < 0.01
        )
          c.burn = 200;
      if (G.frame % 45 === 0) sfx('crackle', t.x, t.gy);
      if (t.burn <= 0) {
        for (let q = 0; q < 20; q++)
          parts.push({
            x: t.x + (rnd() - 0.5) * t.spr.width,
            y: t.gy - rnd() * h,
            vx: rnd() - 0.5,
            vy: -rnd(),
            l: 40,
            c: rnd() < 0.5 ? '#3a3530' : '#5d5852',
          });
        spawnItem('wood', t.x - 3, t.gy - 6, 0, -0.5, 15);
        sfx('thud', t.x, t.gy);
        trees.splice(k, 1);
      }
      continue;
    }
    if (!t.fall) {
      if (G.frame % 30 === k % 30 && !solid(t.x, t.gy) && !solid(t.x - 1, t.gy) && !solid(t.x + 1, t.gy))
        t.fall = rnd() < 0.5 ? -1 : 1;
      if (t.stage < 4 && ++t.grow > 2600) {
        t.grow = 0;
        t.stage++;
        t.hp = 40 + t.stage * 25;
        t.spr = treeSprite(t.type, t.stage);
      }
      continue;
    }
    t.ang += (0.012 + Math.abs(t.ang) * 0.09) * Math.sign(t.fall);
    if (Math.abs(t.ang) >= Math.PI / 2 - 0.05) {
      const n = t.stage + 1,
        len = t.spr.height;
      for (let q = 0; q < n; q++) {
        const d = 4 + (q * (len - 6)) / n,
          x = t.x + t.fall * d;
        spawnItem('wood', x - 3, t.gy - 8, t.fall * 0.3, -0.5, 15);
      }
      for (let q = 0; q < 14; q++)
        parts.push({
          x: t.x + t.fall * rnd() * len,
          y: t.gy - 2,
          vx: rnd() - 0.5,
          vy: -rnd() * 1.5,
          l: 30,
          c:
            t.type === 'snowpine'
              ? '#e8eef4'
              : t.type === 'cactus'
                ? '#4f8a3c'
                : t.type === 'pine'
                  ? '#2f6b3a'
                  : '#4f9a3c',
        });
      sfx('thud', t.x, t.gy);
      G.shake = Math.max(G.shake, 2);
      trees.splice(k, 1);
    }
  }
  if (G.frame % 900 === 0 && trees.length < 26) {
    for (let tr = 0; tr < 30; tr++) {
      const x = ri(10, W - 10);
      if (canPlantAt(x)) {
        plantTree(x, 1);
        break;
      }
    }
  }
}
// (fire.js sets trees standing in burning oil alight through G, to keep the modules apart)
G.igniteTree = t => ignite(t);
function ignite(t) {
  if (t.burn || t.fall) return;
  t.burn = 700;
  const s = t.spr,
    c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  const g = c.getContext('2d');
  g.drawImage(s, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#2a201a';
  g.fillRect(0, 0, c.width, c.height);
  t.char = c;
}
// How the attacking creatures behave: speed and how far they notice you, how hard and how
// often they strike (dmg on a hit, touch every frame of contact), knock-back, and what is
// special: the spider leaps and poisons, the slime hops and sets you alight, the golem stomps.
const FOE = {
  monster: { speed: 0.5, accel: 0.08, sense: 110, warnAt: 20, dmg: 10, touch: 0.12, cd: 70, knock: 2.2, reach: 0, step: 3, climb: -2.4 },
  spider: { speed: 0.9, accel: 0.15, sense: 130, warnAt: 30, dmg: 6, touch: 0.06, cd: 55, knock: 1.4, reach: 0, step: 3, climb: -2.4, leap: true, poison: 180 },
  slime: { speed: 0, accel: 0, sense: 120, warnAt: 22, dmg: 12, touch: 0.1, cd: 60, knock: 1.8, reach: 0, step: 2, climb: -2, hop: true, burn: 90 },
  golem: { speed: 0.26, accel: 0.05, sense: 100, warnAt: 28, dmg: 20, touch: 0.15, cd: 110, knock: 3.4, reach: 2, step: 3, climb: -2.0, stomp: true },
};
function updAnimal(a) {
  if (a.hurt > 0) a.hurt--;
  const m = midMat(a, 0.5),
    inL = LIQ[m];
  // (the lava slime lives in lava)
  if ((m === LAVA && a.kind !== 'slime') || m === ACID) a.hp -= m === LAVA ? 2 : 0.3;
  // the lava slime sets oil alight (fire.js)
  if (m === OIL && a.kind === 'slime') igniteNear(a.x + a.w / 2, a.y + a.h, 2);
  // monsters cannot swim: in water they drown (a moat is a defence), bubbles rise off them
  // (a monster floats with its back out of the water: what counts is the lower part of its body)
  if (FOE[a.kind] && (m === WATER || midMat(a, 0.75) === WATER)) {
    a.hp -= 0.12;
    if (G.frame % 14 === 0) parts.push({ x: a.x + a.w / 2, y: a.y, vx: 0, vy: -0.3, l: 20, c: '#e6f4ff', g: -0.004 });
  }
  if (a.hp <= 0) return false;
  // the giant worm has a mind of its own (boss.js)
  if (a.kind === 'worm') return a.seg ? wormUpd(a) : false;
  if (a.kind === 'bat') {
    // flutter around inside caves, turn at walls
    if (--a.t <= 0) {
      a.t = ri(20, 70);
      a.vx = (rnd() - 0.5) * 1.4;
      a.vy = (rnd() - 0.5) * 0.9;
    }
    a.vy += Math.sin(G.frame * 0.3 + a.x) * 0.03;
    if (free(a.x + a.vx, a.y, a.w, a.h) && !LIQ[matAt(Math.floor(a.x + a.vx + 2), Math.floor(a.y + 1))]) a.x += a.vx;
    else a.vx *= -1;
    if (free(a.x, a.y + a.vy, a.w, a.h)) a.y += a.vy;
    else a.vy *= -1;
    if (a.vx) a.face = Math.sign(a.vx);
    a.anim += 0.6;
    return a.hp > 0;
  }
  if (a.kind === 'fish') {
    if (m === WATER) {
      a.dry = 0;
      if (--a.t <= 0) {
        a.t = ri(30, 120);
        a.vx = (rnd() - 0.5) * 0.8;
        a.vy = (rnd() - 0.5) * 0.3;
      }
      if (a.vx) a.face = Math.sign(a.vx);
      const nx = a.x + a.vx,
        ny = a.y + a.vy;
      if (
        matAt(Math.floor(nx + a.w / 2 + a.face * 2), Math.floor(ny + 1)) === WATER &&
        matAt(Math.floor(nx + a.w / 2), Math.floor(ny)) === WATER
      ) {
        a.x = nx;
        a.y = ny;
      } else {
        a.vx *= -1;
        a.vy *= -1;
      }
      a.anim += 0.2;
    } else {
      a.dry++;
      a.vy = Math.min(a.vy + 0.15, 4);
      const [, by] = moveBody(a, a.vx, a.vy, 0);
      if (by) {
        a.vy = rnd() < 0.1 ? -1.5 : 0;
        a.vx = rnd() - 0.5;
      }
      if (a.dry > 400) a.hp = 0;
    }
    return a.hp > 0;
  }
  a.vy = Math.min(a.vy + (inL ? 0.03 : 0.17), 4);
  if (inL) {
    a.vy *= 0.9;
    if (LIQ[midMat(a, 0.1)]) a.vy -= 0.1;
  }
  const onG = !free(a.x, a.y + 1, a.w, a.h);
  if (a.kind === 'fluffel') {
    if (--a.t <= 0) {
      a.t = ri(30, 160);
      a.tvx = rnd() < 0.35 ? 0 : (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 0.4);
      if (onG && rnd() < 0.3) a.vy = -2;
    }
    let near = null;
    for (const c of crew) if (!c.dead && Math.abs(c.x - a.x) < 14 && Math.abs(c.y - a.y) < 10) near = c;
    // (a fluffel lost in a level waits for its rescuer instead of running off)
    if (near) a.tvx = a.lost ? 0 : Math.sign(a.x - near.x) * 0.8;
    for (const o of animals)
      if (isFoe(o) && o.kind !== 'bat' && Math.abs(o.x - a.x) < 40 && Math.abs(o.y - a.y) < 20)
        a.tvx = Math.sign(a.x - o.x) * 0.9;
    // startled by an arrow (combat.js): runs off for a few seconds, a "!" over it at first
    if (a.scared > 0) {
      a.scared--;
      if (a.scared > 420) a.tvx = a.scaredDir * 1.1;
    }
    a.warn = a.scared > 520 ? 1 : 0;
    a.vx += ((a.tvx || 0) - a.vx) * 0.2;
  } else {
    const F = FOE[a.kind] || FOE.monster;
    let tgt = null,
      bd = F.sense;
    for (const c of crew) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      if (d < bd && Math.abs(c.y - a.y) < 45) {
        bd = d;
        tgt = c;
      }
    }
    // close enough to strike and ready: a warning shows over it first (render.js, only a picture:
    // the strike itself still comes on contact, as before)
    a.warn = tgt && bd < F.warnAt && a.atk <= 0 ? (a.warn || 0) + 1 : 0;
    const dir = tgt ? Math.sign(tgt.x + 3 - (a.x + a.w / 2)) || 1 : 0;
    if (a.leapCd > 0) a.leapCd--;
    if (a.hopT > 0) a.hopT--;
    if (F.hop) {
      // the slime only moves by hopping: a squash, a jump, a splat
      if (onG) {
        a.vx *= 0.7;
        if (!(a.hopT > 0)) {
          a.hopT = tgt ? 38 : ri(60, 140);
          a.vy = tgt ? -2.3 : -1.4;
          a.vx = tgt ? dir * 1.25 : (rnd() < 0.5 ? -1 : 1) * 0.5;
          sfx('land', a.x, a.y);
        }
      }
      a.tvx = null;
    } else if (tgt) {
      a.tvx = dir * F.speed;
      // the spider leaps at you from a little way off
      if (F.leap && onG && !(a.leapCd > 0) && a.atk <= 0 && Math.abs(tgt.x - a.x) < 50 && Math.abs(tgt.y - a.y) < 16) {
        a.vy = -2.3;
        a.vx = dir * 2.2;
        a.leapCd = 90;
        sfx('clack', a.x, a.y);
      }
      if (G.frame % 180 === 0) sfx('growl', a.x, a.y);
    } else if (a.siege) {
      // a siege: march on the castle and strike it there (siege.js)
      a.tvx = siegeMarch(a, F.speed);
      if (atCastle(a) && a.atk <= 0 && G.base && !G.netClient) {
        a.atk = F.cd;
        a.face = Math.sign(G.base.x + G.base.w / 2 - (a.x + a.w / 2)) || 1;
        hitFort(G.base, F.dmg, a.x + a.w / 2, a.y + a.h / 2);
        sfx('growl', a.x, a.y);
      }
    } else if (--a.t <= 0) {
      a.t = ri(60, 200);
      a.tvx = rnd() < 0.4 ? 0 : (rnd() < 0.5 ? -1 : 1) * F.speed * 0.6;
    }
    // (in the air after a leap or a hop it keeps its speed)
    if (a.tvx != null && onG) a.vx += ((a.tvx || 0) - a.vx) * F.accel;
    if (a.atk > 0) a.atk--;
    for (const c of crew) {
      if (c.dead || !overlap(a, c, F.reach)) continue;
      const g = guard(c, 'monster');
      hurt(c, F.touch * g, true);
      if (a.atk <= 0) {
        a.atk = F.cd;
        const k = Math.sign(c.x - a.x || 1);
        startTumble(c, k * F.knock * g, -1.6 * g);
        hurt(c, F.dmg * g);
        if (F.poison) c.poison = Math.max(c.poison || 0, F.poison);
        if (F.burn) c.burn = Math.max(c.burn || 0, F.burn);
        if (F.stomp) {
          // the golem's fists hit the ground: dust and a shake
          G.shake = Math.max(G.shake || 0, 7);
          for (let q = 0; q < 10; q++)
            parts.push({ x: a.x + a.w / 2 + k * 6, y: a.y + a.h - 1, vx: (rnd() - 0.5) * 2.4, vy: -rnd() * 1.2, l: 24, c: '#9a8f80' });
          sfx('thud', a.x, a.y);
        } else sfx('growl', a.x, a.y);
      }
    }
  }
  if (Math.abs(a.vx) > 0.05) a.face = Math.sign(a.vx);
  const F = FOE[a.kind];
  const [bx, by] = moveBody(a, a.vx, a.vy, F ? F.step : 2);
  if (by) a.vy = 0;
  if (bx) {
    // a wall or a closed gate in the way: the monster strikes it (fort.js)
    if (F && strikeFort(a, F.dmg, F.cd)) a.vx = 0;
    // (in water no jump up the side: in its weak pull a jump would carry it out of any moat)
    else if (onG && !inL) a.vy = F ? F.climb : -2;
    else a.vx *= -0.5;
  }
  if (onG) a.anim += Math.abs(a.vx) * 0.4;
  return true;
}
// what a beaten creature leaves: a puff in its colours, and loot by kind
const LOOT = {
  monster: { col: '#5a56a0', nug: 2, name: 'Monster besiegt' },
  spider: { col: '#3a2a48', nug: 1, name: 'Giftspinne besiegt' },
  slime: { col: '#ff7a2f', nug: 2, coal: 1, name: 'Lavaschleim besiegt' },
  golem: { col: '#8a847c', nug: 4, ore: 2, gem: 0.35, name: 'Steingolem besiegt' },
  worm: { col: '#7a4a5a', nug: 14, ore: 4, gem: 1, gems: 3, name: 'Riesenwurm besiegt!' },
};
function killAnimal(a) {
  const L = LOOT[a.kind];
  const col = L ? L.col : { fluffel: '#f2e6d0', bat: '#3a2f45' }[a.kind] || '#e0a13a';
  for (let q = 0; q < (a.kind === 'golem' ? 26 : 14); q++)
    parts.push({ x: a.x + a.w / 2, y: a.y + a.h / 2, vx: (rnd() - 0.5) * 2, vy: -rnd() * 2, l: 30, c: col });
  if (!L) return;
  const drop = (t, n) => {
    for (let k = 0; k < n; k++) spawnItem(t, a.x + a.w / 2 - 1 + (k - n / 2) * 2, a.y, (k - (n - 1) / 2) * 0.5, -1.5, 10);
  };
  drop('nug', L.nug);
  if (L.coal) drop('coal', L.coal);
  if (L.ore) drop('ore', L.ore);
  if (L.gem && rnd() < L.gem) drop('gem', L.gems || 1);
  if (a.kind === 'worm') {
    announceBanner('Riesenwurm besiegt!', 'Gold und Edelsteine liegen, wo er fiel');
    track('worm');
  }
  if (a.kind === 'golem') G.shake = Math.max(G.shake || 0, 9);
  toast(L.name);
  G.kills = (G.kills || 0) + 1;
  track('monster');
  sfx(a.kind === 'golem' ? 'thud' : 'growl', a.x, a.y);
}
const DEBRIS = { [EARTH]: EARTH, [ROCK]: ROCK, [SAND]: SAND, [LOAM]: LOAM, [ORE]: ORE, [COAL]: COAL, [PLANK]: PLANK };
const DEBCOL = {
  [EARTH]: '#7d5230',
  [ROCK]: '#7b766f',
  [SAND]: '#d9b56a',
  [LOAM]: '#b07a45',
  [ORE]: '#9a5a46',
  [COAL]: '#2a2626',
  [PLANK]: '#a0703f',
};
// by: the Wühler that threw or lit it (Versus: it hurts the other team's castle, and a
// knocked-out Wühler counts for the thrower)
function explode(cx, cy, r, by = null) {
  if (G.netHost) G.netEvent(['x', cx | 0, cy | 0, r]);
  let gc = 0;
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      if (x < 0 || x >= W) continue;
      const dx = x - cx,
        dy = y - cy,
        rr = r + (rnd() * 2 - 1);
      if (dx * dx + dy * dy > rr * rr) continue;
      const i = y * W + x,
        m = mat[i];
      if (BLAST[m]) {
        if (m === GOLD) gc++;
        else if (rnd() < 0.16) {
          const d = Math.hypot(dx, dy) || 1,
            s = 1.2 + rnd() * 2.2;
          parts.push({
            x: x + 0.5,
            y: y + 0.5,
            vx: (dx / d) * s,
            vy: (dy / d) * s - 1.3,
            l: 300,
            c: DEBCOL[m],
            m: DEBRIS[m],
          });
        }
        mat[i] = AIR;
        bg[i] = 1;
        paint(i);
      }
    }
  }
  for (let q = 0; q < Math.floor(gc / 12) + (gc > 3 ? 1 : 0); q++)
    spawnItem('nug', cx, cy, (rnd() - 0.5) * 2.4, -1.5 - rnd(), 8);
  for (let q = 0; q < 26; q++) {
    const a = rnd() * Math.PI * 2,
      v = rnd() * 2.4;
    parts.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 0.6,
      l: 14 + rnd() * 14,
      c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f',
    });
  }
  // a column of smoke that rises, grows and cools (dark at the bottom, fire-lit at first), glowing
  // embers that fly out and fall, and a short fireball – bigger blasts give more of each
  // (within the particle budget)
  const room = parts.length < 1800;
  for (let q = 0, n = room ? 14 + 2 * r : 6; q < n; q++) {
    // stacked from the blast upwards, all rising at about the same pace: one column
    const l = 110 + rnd() * 80,
      up = q / n;
    parts.push({
      x: cx + (rnd() - 0.5) * r * (0.4 + up * 0.5),
      y: cy - up * r * 2.2 - rnd() * 2,
      vx: G.wind * 0.15 + (rnd() - 0.5) * 0.1,
      vy: -0.22 - rnd() * 0.1 - up * 0.12,
      l,
      l0: l,
      pal: FX_PAL.smokeDark,
      g: -0.0012,
      s: r > 8 ? 2 : 1,
      grow: r > 8 ? 2.5 : 1.5,
    });
  }
  if (room) {
    for (let q = 0, n = 4 + r; q < n; q++) {
      const a = -Math.PI * (0.1 + rnd() * 0.8),
        v = 1 + rnd() * 2.2,
        l = 40 + rnd() * 45;
      parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l, l0: l, pal: FX_PAL.spark, g: 0.06 });
    }
    for (let q = 0, n = 3 + Math.floor(r / 3); q < n; q++) {
      const l = 12 + rnd() * 8;
      parts.push({
        x: cx + (rnd() - 0.5) * r * 0.6,
        y: cy + (rnd() - 0.5) * r * 0.6,
        vx: (rnd() - 0.5) * 0.4,
        vy: -0.5 - rnd() * 0.4,
        l,
        l0: l,
        pal: FX_PAL.spark,
        g: -0.02,
        s: 1,
        grow: 1,
      });
    }
  }
  flashes.push({ x: cx, y: cy, r: r + 4, l: 7 });
  if (Math.hypot(cx - cam.x - G.VW / 2, cy - cam.y - G.VH / 2) < G.VW * 0.7) buzz(60 + r * 6);
  G.shake = Math.max(G.shake, r > 15 ? 9 : 5);
  sfx('boom', cx, cy, r > 15 ? 1.4 : 1);
  for (const c of crew) {
    if (c.dead) continue;
    const dx = c.x + 3 - cx,
      dy = c.y + 5 - cy,
      d = Math.hypot(dx, dy) || 1;
    if (d < r + 9) {
      if (by && by !== c) c.lastHit = { pid: by.pid ?? null, team: by.team || 0, f: G.frame };
      hurt(c, (r + 9 - d) * 2.1);
      startTumble(c, (dx / d) * 2.6, -2.2 + dy / d);
    }
  }
  // (Versus: the other team's walls, gates and towers crack too, fort.js)
  blastForts(cx, cy, r, by);
  // oil in reach catches fire (fire.js)
  igniteNear(cx, cy, r + 2);
  if (by && G.teams)
    for (const b of builds) {
      if (b.type !== 'base') continue;
      // distance from the blast to the nearest point of the castle
      const nx = Math.max(b.x, Math.min(cx, b.x + b.w)),
        ny = Math.max(b.gy - b.h, Math.min(cy, b.gy));
      if (Math.hypot(nx - cx, ny - cy) < r + 4) damageCastle(b, r * 3, by.team || 0, by.pid ?? null);
    }
  for (const a of animals) {
    const dx = a.x + a.w / 2 - cx,
      dy = a.y + a.h / 2 - cy,
      d = Math.hypot(dx, dy) || 1;
    if (d < r + 10) {
      a.hp -= (r + 10 - d) * 4;
      a.hurt = 12;
      a.vx += (dx / d) * 2;
      a.vy -= 2;
    }
  }
  for (const it of items) {
    const dx = it.x - cx,
      dy = it.y - cy,
      d = Math.hypot(dx, dy) || 1;
    if (d < r + 7) {
      it.vx += (dx / d) * 2.5;
      it.vy -= 2.2;
      if ((it.t === 'flint' || it.t === 'tnt') && it.fuse < 0) {
        it.fuse = it.t === 'tnt' ? 20 : 8;
        it.armed = true;
      }
    }
  }
  for (const L of lorries) {
    const dx = L.x + 6 - cx,
      d = Math.hypot(dx, L.y + 3 - cy) || 1;
    if (d < r + 8) {
      L.vx += (dx / d) * 2;
      L.vy -= 2;
    }
  }
  for (const t of trees) {
    if (t.fall) continue;
    const dx = Math.abs(t.x - cx),
      dy = Math.abs(t.gy - cy);
    if (dx < r + 6 && dy < r + 16) t.fall = Math.sign(t.x - cx) || 1;
    else if (dx < r + 20 && dy < r + t.spr.height && rnd() < 0.6) ignite(t);
  }
  for (const c of crew) {
    if (c.dead) continue;
    if (Math.hypot(c.x + 3 - cx, c.y + 5 - cy) < r + 5 && rnd() < 0.5) c.burn = 150;
  }
}
function updParts() {
  for (let k = parts.length - 1; k >= 0; k--) {
    const p = parts[k];
    p.vy += p.g !== undefined ? p.g : 0.12;
    if (p.m !== undefined || p.rain || p.drop) {
      if (p.vy > 3.5) p.vy = 3.5;
      // flakes sway from side to side as they drift down
      if (p.snow) p.vx = G.wind * 0.3 + Math.sin(G.frame * 0.04 + p.ph) * 0.22;
      const nx = p.x + p.vx,
        ny = p.y + p.vy,
        tx = Math.floor(nx),
        ty = Math.floor(ny);
      if (tx < 0 || tx >= W || ty >= H) {
        parts.splice(k, 1);
        continue;
      }
      if (ty >= 0 && mat[ty * W + tx] !== AIR) {
        const cx = Math.floor(p.x),
          cy = Math.floor(p.y);
        const ok = cy >= 0 && cy < H && cx >= 0 && cx < W && mat[cy * W + cx] === AIR;
        if (p.snow) {
          // flakes just melt away
        } else if (p.rain || p.drop) {
          // (a drop from a stalactite only splashes: it adds no water)
          if (p.rain && ok && rnd() < 0.07) setMat(cx, cy, WATER);
          else if (mat[ty * W + tx] === WATER) {
            if (rnd() < 0.6) ripple(p.x, ty);
          } else if (rnd() < 0.6) rainSplash(p.x, ty);
        } else if (ok) setMat(cx, cy, p.m);
        parts.splice(k, 1);
        continue;
      }
      p.x = nx;
      p.y = ny;
      if (--p.l <= 0) parts.splice(k, 1);
      continue;
    }
    if (p.b) {
      // a falling leaf sways with the wind until it lies on the ground (effects.js leafFall)
      if (p.leaf) {
        if (p.rest) p.vx = 0;
        else {
          p.vx = G.wind * 0.35 + Math.sin(G.frame * 0.06 + p.ph) * 0.3;
          if (p.vy > 0.35) p.vy = 0.35;
        }
      }
      // dug-out crumbs: bounce off walls and the floor, then lie there for a moment
      const nx = p.x + p.vx,
        ny = p.y + p.vy;
      if (solid(Math.floor(nx), Math.floor(p.y))) p.vx *= -0.3;
      else p.x = nx;
      if (solid(Math.floor(p.x), Math.floor(ny))) {
        if (p.vy > 0.7) p.vy *= -0.3;
        else p.vy = 0;
        p.vx *= 0.6;
        if (p.leaf) p.rest = 1;
      } else p.y = ny;
      if (--p.l <= 0) parts.splice(k, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    if (--p.l <= 0) parts.splice(k, 1);
  }
  for (let k = flashes.length - 1; k >= 0; k--) if (--flashes[k].l <= 0) flashes.splice(k, 1);
}

export { DEBCOL, DEBRIS, explode, ignite, killAnimal, updAnimal, updItems, updParts, updTrees };
