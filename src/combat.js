// Fighting monsters (and in Versus the other team): sword swings (players with Aktion, helpers
// by themselves), the longbow with arrows and fire arrows from the store, and shield/helmet
// that soften hits. Swords and arrows also hurt the other team's castle.
import { announce } from './announce.js';
import { arrows } from './buildings.js';
import { FOE_KINDS } from './entities.js';
import { hurt } from './digger.js';
import { addStat } from './stats.js';
import { teamOf, useMine, useTeam } from './teams.js';
import { addFloat } from './floats.js';
import { tr } from './i18n.js';
import { damageCastle } from './versus.js';
import { sfx } from './sound.js';
import { G, animals, builds, crew, flashes, parts, trees, vehicles } from './state.js';
import { addArrows, arrowsOf, hasTool, teamHas } from './tools.js';
import { ignite } from './objects.js';
import { igniteNear } from './fire.js';
import { isPlayer } from './players.js';
import { rnd, solid } from './world.js';

// (the creatures that attack: entities.js)
const FOES = FOE_KINDS;

// ---- damage modifiers ----
// kind: 'monster' (claws, bites) or 'hit' (stones, rubble, lightning)
function guard(c, kind) {
  const id = kind === 'monster' ? 'shield' : 'helm';
  return teamHas(c.team, id) ? 0.5 : 1;
}

// ---- the other team (Versus) ----
const enemy = (c, o) => !!G.teams && o !== c && !o.dead && !o.trapped && teamOf(o) !== teamOf(c);
const foeCastle = (c, b) => !!G.teams && b.type === 'base' && b.hp > 0 && teamOf(b) !== teamOf(c);
// a hit on a Wühler of the other team: by is the attacker ({ pid, team }), counted for the
// ranking and for "… hat … erwischt"
function strike(o, dmg, by, kind = 'monster') {
  o.lastHit = { pid: by.pid ?? null, team: by.team || 0, f: G.frame };
  hurt(o, dmg * guard(o, kind));
  hitFx(o.x + 3, o.y + 4);
}
// red and white sparks where a hit lands (sent to the clients as well)
function hitFx(x, y) {
  if (G.netHost) G.netEvent(['h', x | 0, y | 0]);
  for (let q = 0; q < 8; q++)
    parts.push({ x, y, vx: (rnd() - 0.5) * 2.2, vy: -rnd() * 1.6, l: 10 + rnd() * 8, c: q % 3 ? '#ff5a4a' : '#ffffff' });
  flashes.push({ x, y, r: 4, l: 4 });
}
// a Wühler of the other team was knocked out: tell everybody who did it
G.onKill = c => {
  const h = c.lastHit;
  if (!G.teams || !h || G.frame - h.f > 300 || h.team === teamOf(c)) return;
  addStat(h.pid, 'kills');
  const by = crew.find(o => o.pid != null && o.pid === h.pid);
  announce(by ? '{a} hat {b} erwischt!' : '{b} wurde erwischt!', { a: by && by.name, b: c.name });
};

// ---- sword ----
const reachOf = c => ({ x: c.face > 0 ? c.x + 3 : c.x + 3 - 15, y: c.y - 3, w: 15, h: 15 });
const inRect = (o, r) => o.x + o.w > r.x && o.x < r.x + r.w && o.y + o.h > r.y && o.y < r.y + r.h;
const castleIn = (b, r) => b.x + b.w > r.x && b.x < r.x + r.w && b.gy > r.y && b.gy - b.h < r.y + r.h;
function foeInReach(c) {
  const r = reachOf(c);
  return (
    animals.find(a => FOES[a.kind] && a.hp > 0 && inRect(a, r)) ||
    crew.find(o => enemy(c, o) && inRect(o, r)) ||
    builds.find(b => foeCastle(c, b) && castleIn(b, r))
  );
}
function swing(c) {
  if (c.swingCd > 0) return;
  c.swing = 12;
  c.swingCd = 28;
  sfx('chop', c.x, c.y);
  const r = reachOf(c);
  for (const a of animals) {
    if (!FOES[a.kind] || a.x + a.w < r.x || a.x > r.x + r.w || a.y + a.h < r.y || a.y > r.y + r.h) continue;
    a.hp -= 30;
    a.hurt = 12;
    a.vx += c.face * 1.6;
    a.vy -= 1;
    sfx('clack', a.x, a.y);
  }
  if (!G.teams || G.netClient) return;
  for (const o of crew) {
    if (!enemy(c, o) || !inRect(o, r)) continue;
    strike(o, 16, c);
    o.vx += c.face * 1.6;
    o.vy -= 0.8;
    sfx('clack', o.x, o.y);
  }
  for (const b of builds) if (foeCastle(c, b) && castleIn(b, r)) damageCastle(b, 6, teamOf(c), c.pid);
}
// the action button: strike when a monster is close
function swordContext(c) {
  if (!hasTool('sword') || !foeInReach(c)) return null;
  return { label: 'Zuschlagen', fn: () => swing(c) };
}

// ---- bow ----
const quiver = () => arrowsOf('arrow') + arrowsOf('farrow');
const hasBow = c => !!c && hasTool('bow') && c.ride == null;
const canShoot = c => hasBow(c) && quiver() > 0;
// Shoot an arrow; normal arrows first, then fire arrows. I.aim: aimed by dragging the
// "Schießen" button (ax/ay is that direction, the walking stick stays free); without a drag
// the arrow flies the way the Wühler is walking (at a monster right in front, if there is one)
function shoot(c, I) {
  const fire = arrowsOf('arrow') <= 0;
  addArrows(fire ? 'farrow' : 'arrow', -1);
  const aimed = !!I.aim && Math.hypot(I.ax, I.ay) > 0.3;
  if (aimed && Math.abs(I.ax) > 0.2) c.face = Math.sign(I.ax);
  const sp = 4.4,
    ox = c.x + 3 + c.face * 4,
    oy = c.y + 4;
  // with the stick in the middle the arrow flies at the next monster in front (like a tower)
  // (in Versus also at the next Wühler of the other team)
  const foes = [...animals.filter(a => FOES[a.kind]), ...crew.filter(o => enemy(c, o))];
  const tgt =
    !aimed &&
    (I.aim || Math.abs(I.ay) < 0.4) &&
    foes.find(a => (a.x + a.w / 2 - ox) * c.face > 0 && Math.hypot(a.x + a.w / 2 - ox, a.y + a.h / 2 - oy) < 170);
  let vx, vy;
  if (aimed) {
    const m = Math.hypot(I.ax, I.ay);
    vx = (I.ax / m) * sp;
    vy = (I.ay / m) * sp;
  } else if (tgt) {
    const dx = tgt.x + tgt.w / 2 - ox,
      dy = tgt.y + tgt.h / 2 - oy,
      t = Math.hypot(dx, dy) / sp;
    vx = dx / t;
    vy = dy / t - 0.03 * t;
  } else {
    const ang = I.aim ? 0.12 : I.ay < -0.4 ? 0.75 : I.ay > 0.4 ? -0.15 : 0.12;
    vx = Math.cos(ang) * sp * c.face;
    vy = -Math.sin(ang) * sp;
  }
  fireArrow({ x: ox, y: oy, vx, vy, l: 150, dmg: fire ? 40 : 28, fire, tm: teamOf(c), by: c.pid, pick: true });
  c.shotT = G.frame; // (the string snaps forward, drawBow)
  sfx('bow', c.x, c.y);
}
// where an aimed arrow would fly: points of its path (for the dotted line while aiming)
function aimPath(c, I) {
  const sp = 4.4,
    m = Math.hypot(I.ax, I.ay) || 1;
  const f = Math.abs(I.ax) > 0.2 ? Math.sign(I.ax) : c.face;
  let x = c.x + 3 + f * 4,
    y = c.y + 4,
    vx = (I.ax / m) * sp,
    vy = (I.ay / m) * sp;
  const pts = [];
  for (let t = 0; t < 60; t++) {
    vy += 0.06;
    x += vx;
    y += vy;
    if (solid(Math.floor(x), Math.floor(y))) break;
    if (t % 2 === 1) pts.push([x, y]);
  }
  return pts;
}
// every arrow (also from towers) goes through here, so clients get to see it
function fireArrow(a) {
  arrows.push(a);
  if (G.netHost) G.netEvent(['p', a.fire ? 'f' : 'a', Math.round(a.x), Math.round(a.y), a.vx, a.vy, a.tm ?? null, a.pick ? 1 : 0]);
}
// a client shows the arrows of the host (only for the looks), and the sparks of hits
function playShot(e) {
  if (e[0] === 'h') {
    hitFx(e[1], e[2]);
    return true;
  }
  if (e[0] === 'pa') {
    // an arrow was picked up on the host: the stuck one closest to that spot goes
    let best = -1,
      bd = 9;
    stuckArrows.forEach((s, k) => {
      const d = Math.abs(s.x - e[1]) + Math.abs(s.y - e[2]);
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    if (best >= 0) stuckArrows.splice(best, 1);
    return true;
  }
  if (e[0] !== 'p') return false;
  if (e[1] === 'a' || e[1] === 'f')
    arrows.push({ x: e[2], y: e[3], vx: e[4], vy: e[5], l: 150, fire: e[1] === 'f', tm: e[6] ?? undefined, pick: !!e[7] });
  return e[1] === 'a' || e[1] === 'f';
}
function updArrows() {
  for (let k = arrows.length - 1; k >= 0; k--) {
    const a = arrows[k];
    a.vy += 0.06;
    a.x += a.vx;
    a.y += a.vy;
    if (a.fire && G.frame % 2 === 0)
      parts.push({ x: a.x, y: a.y, vx: 0, vy: -0.2, l: 10, c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f' });
    let hit = false;
    for (const m of animals) {
      if (!FOES[m.kind] || !(a.x > m.x && a.x < m.x + m.w && a.y > m.y && a.y < m.y + m.h)) continue;
      // the stone golem: arrows half glance off its stone
      const stone = m.kind === 'golem';
      if (!G.netClient) {
        m.hp -= (a.dmg || 20) * (stone ? 0.5 : 1);
        m.hurt = 12;
        m.vx += Math.sign(a.vx) * (stone ? 0.2 : 0.8);
      }
      hit = true;
      sfx('clack', a.x, a.y);
      if (stone)
        for (let q = 0; q < 4; q++) parts.push({ x: a.x, y: a.y, vx: -Math.sign(a.vx) * rnd(), vy: -rnd(), l: 10, c: '#d8d2c8' });
      break;
    }
    // a bow's arrow that hits a fluffel only startles it (it jumps off, the shooter gets a little
    // reward) and drops to the ground; fluffels lost in a level are left alone
    if (!hit && a.pick)
      for (const m of animals) {
        if (m.kind !== 'fluffel' || m.lost || m.scared > 0) continue;
        if (!(a.x > m.x - 1 && a.x < m.x + m.w + 1 && a.y > m.y - 1 && a.y < m.y + m.h + 1)) continue;
        hit = true;
        if (!G.netClient) scareFluffel(m, a);
        dropArrow(a);
        break;
      }
    // the archery target: points by the ring it hits, the arrow stays in the straw
    if (!hit)
      for (const v of vehicles) {
        if (v.kind !== 'target') continue;
        const tx = v.x + v.w / 2,
          ty = v.y + 5,
          d = Math.hypot(a.x - tx, a.y - ty);
        if (d > 5.3) continue;
        hit = true;
        stuckArrows.push({ x: a.x, y: a.y, vx: a.vx, vy: a.vy, l: a.pick ? STUCK_LIFE : 240, stuck: true, pick: !!a.pick });
        sfx('clack', a.x, a.y, 0.7);
        if (!G.netClient && a.pick) {
          const pts = d < 1.3 ? 10 : d < 2.3 ? 8 : d < 3.3 ? 6 : d < 4.3 ? 4 : 2;
          v.score = (v.score || 0) + pts;
          addFloat(tx, ty - 9, pts === 10 ? tr('Volltreffer!') + ' 10' : '+' + pts, pts === 10 ? '#ffd23a' : '#f2e2c0');
          if (pts === 10) sfx('coin', tx, ty);
        }
        break;
      }
    // Versus: arrows hit the other team's Wühler and castle (towers shoot for their team)
    if (!hit && G.teams && a.tm != null) {
      const by = { pid: a.by, team: a.tm };
      for (const o of crew) {
        if (o.dead || teamOf(o) === a.tm || !(a.x > o.x && a.x < o.x + o.w && a.y > o.y && a.y < o.y + o.h)) continue;
        if (!G.netClient) strike(o, a.fire ? 18 : 12, by, 'hit');
        hit = true;
        break;
      }
      for (const b of builds) {
        if (hit || b.type !== 'base' || !(b.hp > 0) || teamOf(b) === a.tm) continue;
        if (a.x > b.x && a.x < b.x + b.w && a.y > b.gy - b.h && a.y < b.gy) {
          damageCastle(b, a.fire ? 12 : 3, a.tm, a.by);
          hit = true;
        }
      }
    }
    const wall = solid(Math.floor(a.x), Math.floor(a.y));
    if ((hit || wall) && a.fire) burnAt(a.x, a.y);
    if (wall && !hit && !a.fire) {
      // stuck in the wall or the ground: a bow's arrow can be picked up again (a minute),
      // a tower's only stays for the looks
      stuckArrows.push({ x: a.x, y: a.y, vx: a.vx, vy: a.vy, l: a.pick ? STUCK_LIFE : 240, stuck: true, pick: !!a.pick });
      if (stuckArrows.length > 60) stuckArrows.shift();
      sfx('clack', a.x, a.y, 0.5);
    }
    if (hit || wall || --a.l <= 0) arrows.splice(k, 1);
  }
  for (let k = stuckArrows.length - 1; k >= 0; k--) if (--stuckArrows[k].l <= 0) stuckArrows.splice(k, 1);
  if (!G.netClient) pickArrows();
}
// a startled fluffel: jumps away from the arrow, shows a "!" for a moment (objects.js), and the
// shooter's team gets two Taler; then it has ten seconds' peace
function scareFluffel(m, a) {
  const dir = Math.sign(a.vx) || 1;
  Object.assign(m, { scared: 600, scaredDir: dir, vy: -2.4, vx: dir * 1.4, tvx: dir * 1.1 });
  useTeam(a.tm ?? 0);
  G.money += 2;
  G.earned = (G.earned || 0) + 2;
  useMine();
  addFloat(m.x + 2, m.y - 5, tr('Treffer!') + ' +2', '#f2c230');
  sfx('coin', m.x, m.y);
}
// an arrow that bounced off something falls flat onto the ground below, to be picked up again
function dropArrow(a) {
  let y = a.y;
  while (y < a.y + 80 && !solid(Math.floor(a.x), Math.floor(y))) y++;
  stuckArrows.push({ x: a.x, y: y + 0.5, vx: Math.sign(a.vx) || 1, vy: 0.3, l: STUCK_LIFE, stuck: true, pick: true });
  if (stuckArrows.length > 60) stuckArrows.shift();
}
// a Wühler that walks over a stuck arrow takes it back into the quiver (if its team has a bow)
const STUCK_LIFE = 3600;
function pickArrows() {
  for (let k = stuckArrows.length - 1; k >= 0; k--) {
    const s = stuckArrows[k];
    if (!s.pick) continue;
    // (the feathered end sticks out of the wall: that is what you reach)
    const d = Math.hypot(s.vx, s.vy) || 1,
      tx = s.x - (s.vx / d) * 4,
      ty = s.y - (s.vy / d) * 4;
    const c = crew.find(
      o =>
        !o.dead &&
        o.ride == null &&
        tx > o.x - 3 &&
        tx < o.x + o.w + 3 &&
        ty > o.y - 3 &&
        ty < o.y + o.h + 3 &&
        teamHas(o.team, 'bow'),
    );
    if (!c) continue;
    stuckArrows.splice(k, 1);
    useTeam(teamOf(c));
    addArrows('arrow', 1);
    useMine();
    sfx('pick', c.x, c.y);
    addFloat(c.x + 3, c.y - 2, '+1 ' + tr('Pfeil'), '#f2e2c0');
    if (G.netHost) G.netEvent(['pa', Math.round(s.x), Math.round(s.y)]);
  }
}
// a fire arrow sets trees alight and lights up gas pockets
function burnAt(x, y) {
  flashes.push({ x, y, r: 4, l: 5 });
  for (let q = 0; q < 6; q++)
    parts.push({ x, y, vx: (rnd() - 0.5) * 1.2, vy: -rnd(), l: 18, c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f' });
  if (G.netClient) return;
  igniteNear(x, y, 3); // (oil, fire.js)
  for (const t of trees) if (!t.fall && Math.abs(t.x - x) < 8 && y > t.gy - 40 && y < t.gy + 2) ignite(t);
}

// ---- every tick: swing timers; helpers with a sword defend themselves ----
function updCombat() {
  for (const c of crew) {
    if (c.swing > 0) c.swing--;
    if (c.swingCd > 0) c.swingCd--;
    if (G.netClient || c.dead || isPlayer(c) || c.ride != null || c.swingCd > 0) continue;
    if (!teamHas(c.team, 'sword')) continue;
    // monsters, and in Versus the other team's Wühler that come close
    for (const a of [...animals.filter(m => FOES[m.kind]), ...crew.filter(o => enemy(c, o))]) {
      if (Math.abs(a.x + a.w / 2 - c.x - 3) > 16 || Math.abs(a.y + a.h / 2 - c.y - 5) > 10) continue;
      c.face = a.x + a.w / 2 > c.x + 3 ? 1 : -1;
      swing(c);
      break;
    }
  }
}

// ---- looks: helmet, shield on the back, sword at the hip or swinging ----
// The longbow in the hand: a curved wooden bow with a string. Held upright in front while you
// walk; while you aim (dragging "Schießen") it turns to the aim, the string is drawn back and
// an arrow lies on it; after a shot the string snaps forward and quivers for a moment.
function drawBow(ctx, c, x, y) {
  const aiming = c.pid === G.myId && G.aimKind === 'bow' && G.aimDrag;
  let dx = c.face,
    dy = 0;
  if (aiming) {
    dx = G.aimDrag.ax;
    dy = G.aimDrag.ay;
  }
  const pull = aiming ? 1 : 0,
    since = G.frame - (c.shotT ?? -99),
    snap = since >= 0 && since < 10 ? Math.sin(since * 2.4) * (1 - since / 10) * 0.9 : 0;
  // (aiming: held out at arm's length, so the face stays free; walking: close in front)
  const reach = pull ? 5.5 : 3,
    nx = -dy,
    ny = dx,
    gx = x + 3 + dx * reach,
    gy = y + (pull ? 4.5 : 5) + dy * reach;
  const back = 0.9 + pull * 0.9,
    t1 = [gx + nx * 4.6 - dx * back, gy + ny * 4.6 - dy * back],
    t2 = [gx - nx * 4.6 - dx * back, gy - ny * 4.6 - dy * back],
    cp = [gx + dx * (2.2 + pull * 0.9), gy + dy * (2.2 + pull * 0.9)];
  // the string: drawn back to the nock while aiming, quivering after a shot
  const mid = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2],
    draw = pull * 2.8,
    nk = [mid[0] - dx * draw + dx * snap, mid[1] - dy * draw + dy * snap];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(240,232,214,0.95)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(t1[0], t1[1]);
  ctx.lineTo(nk[0], nk[1]);
  ctx.lineTo(t2[0], t2[1]);
  ctx.stroke();
  // the bow: dark edge, wood, a lighter belly line, a leather grip
  const limb = (w, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(t1[0], t1[1]);
    ctx.quadraticCurveTo(cp[0], cp[1], t2[0], t2[1]);
    ctx.stroke();
  };
  limb(1.7, '#24160c');
  limb(0.95, '#9a6232');
  limb(0.35, '#d19a5c');
  ctx.fillStyle = '#4a2c16';
  ctx.fillRect(gx + dx * 0.5 - 0.7, gy + dy * 0.5 - 0.7, 1.4, 1.4);
  ctx.restore();
  // an arrow on the string while aiming
  if (pull) drawArrow(ctx, { vx: dx, vy: dy, nocked: true, fire: arrowsOf('arrow') <= 0 }, nk[0] + dx * 8.6, nk[1] + dy * 8.6);
}
function drawGear(ctx, c, x, y) {
  if (c.dead || c.tumble) return;
  const f = c.face;
  if (teamHas(c.team, 'shield') && !c.climb && !c.hangle) {
    const sx = f > 0 ? x - 1.5 : x + 5.5;
    ctx.fillStyle = '#24160c';
    ctx.fillRect(sx - 0.5, y + 3.5, 3, 4.5);
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(sx, y + 4, 2, 3.5);
    ctx.fillStyle = '#c9a43a';
    ctx.fillRect(sx + 0.5, y + 4.5, 1, 2.5);
  }
  if (teamHas(c.team, 'helm')) {
    ctx.fillStyle = '#24160c';
    ctx.fillRect(x + 0.5, y - 1, 5.5, 2);
    ctx.fillStyle = '#9aa4ae';
    ctx.fillRect(x + 1, y - 0.5, 4.5, 1);
    ctx.fillStyle = '#d4dbe2';
    ctx.fillRect(x + 1.5, y - 0.5, 2, 0.5);
  }
  if (c.wield === 'bow' && teamHas(c.team, 'bow') && !c.climb && !c.hangle) drawBow(ctx, c, x, y);
  if (!teamHas(c.team, 'sword')) return;
  if (c.climb || c.hangle) return;
  // (the sword hand: in front of the chest, below the face)
  const hx = x + 3 + f * 3,
    hy = y + 6.5;
  if (c.swing > 0) {
    // the swing (12 frames): a short wind-up behind the head, a fast slash down in front with a
    // bright smear along its path, then a follow-through. Angles: 0 is straight ahead, + is down.
    const t = 1 - c.swing / 12,
      ease = u => 1 - (1 - u) * (1 - u) * (1 - u);
    let a;
    if (t < 0.2) a = -2.0 - (t / 0.2) * 0.35;
    else if (t < 0.62) a = -2.35 + ease((t - 0.2) / 0.42) * 3.25;
    else a = 0.9 - ((t - 0.62) / 0.38) * 0.35;
    if (t >= 0.2) {
      const a0 = -2.35,
        a1 = Math.min(a, 0.9),
        fade = t < 0.62 ? 0.75 : 0.75 * (1 - (t - 0.62) / 0.38);
      smear(ctx, hx, hy, f, a0 + (a1 - a0) * 0.25, a1, fade);
    }
    drawSword(ctx, hx, hy, a, f);
  } else if (c.wield === 'sword' && !c.digging) {
    // chosen in the hotbar: held ready in the hand, blade up and forward
    drawSword(ctx, hx, hy, -0.8 + Math.sin(G.frame * 0.08) * 0.05, f);
  } else if (!c.digging) {
    // sheathed at the hip
    const sx = f > 0 ? x + 0.5 : x + 5.5;
    ctx.fillStyle = '#24160c';
    ctx.fillRect(sx - 0.75, y + 5.5, 1.5, 4.5);
    ctx.fillStyle = '#6e4420';
    ctx.fillRect(sx - 0.25, y + 6, 0.5, 3.5);
    ctx.fillStyle = '#c9a43a';
    ctx.fillRect(sx - 1, y + 5.5, 2, 0.5);
  }
}
// a sword at the hand hx, hy pointing at angle a (0 ahead, + down), mirrored by f: leather
// grip and pommel, a golden crossguard, a steel blade with a dark edge and a bright ridge
function drawSword(ctx, hx, hy, a, f) {
  const ux = Math.cos(a) * f,
    uy = Math.sin(a),
    px = -uy,
    py = ux;
  const P = (along, side = 0) => [hx + ux * along + px * side, hy + uy * along + py * side];
  const line = (p0, p1, w, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'round';
  // blade: dark edge, steel, ridge, a pointed tip
  line(P(1.2), P(8.2), 1.9, '#1e1a18');
  line(P(1.2), P(8.0), 1.1, '#cfd6dd');
  line(P(1.4), P(7.6), 0.35, '#ffffff');
  ctx.fillStyle = '#cfd6dd';
  ctx.beginPath();
  const t0 = P(9.4),
    t1 = P(8.0, 0.55),
    t2 = P(8.0, -0.55);
  ctx.moveTo(t0[0], t0[1]);
  ctx.lineTo(t1[0], t1[1]);
  ctx.lineTo(t2[0], t2[1]);
  ctx.fill();
  // crossguard, grip, pommel
  line(P(1.0, 1.6), P(1.0, -1.6), 1.3, '#24160c');
  line(P(1.0, 1.3), P(1.0, -1.3), 0.6, '#e2b84a');
  line(P(-1.6), P(0.6), 1.2, '#24160c');
  line(P(-1.4), P(0.5), 0.55, '#7a4a24');
  const pm = P(-1.9);
  ctx.fillStyle = '#e2b84a';
  ctx.fillRect(pm[0] - 0.5, pm[1] - 0.5, 1, 1);
  ctx.restore();
}
// the bright crescent a fast blade leaves behind, from angle a0 to a1 around the hand
function smear(ctx, hx, hy, f, a0, a1, alpha) {
  if (a1 <= a0 || alpha <= 0) return;
  ctx.save();
  const s0 = f > 0 ? a0 : Math.PI - a0,
    s1 = f > 0 ? a1 : Math.PI - a1;
  ctx.beginPath();
  ctx.arc(hx, hy, 9.6, s0, s1, f < 0);
  ctx.arc(hx, hy, 4.5, s1, s0, f > 0);
  ctx.closePath();
  const g = ctx.createRadialGradient(hx, hy, 4.5, hx, hy, 9.6);
  g.addColorStop(0, 'rgba(200,225,255,0)');
  g.addColorStop(0.75, `rgba(220,238,255,${0.5 * alpha})`);
  g.addColorStop(1, `rgba(255,255,255,${0.9 * alpha})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}
// An arrow drawn like a real one, at double resolution: a thin wooden shaft with a dark edge
// (so it reads against sky and earth alike), a steel broadhead, two swept-back feathers (red
// and white) and a nock. In flight a faint motion streak follows it; fire arrows glow.
// x, y: the tip on screen.
function drawArrow(ctx, a, x, y, alpha = 1) {
  const d = Math.hypot(a.vx, a.vy) || 1,
    ux = a.vx / d,
    uy = a.vy / d,
    px = -uy,
    py = ux;
  const L = 7.5,
    tx = x - ux * L,
    ty = y - uy * L;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  const line = (x0, y0, x1, y1, w, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const poly = (col, ...p) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let k = 1; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1]);
    ctx.closePath();
    ctx.fill();
  };
  const at = (along, side) => [x + ux * along + px * side, y + uy * along + py * side];
  if (!a.stuck && !a.nocked) {
    // motion streak behind the feathers
    const g = ctx.createLinearGradient(tx, ty, tx - ux * 9, ty - uy * 9);
    g.addColorStop(0, a.fire ? 'rgba(255,170,60,0.6)' : 'rgba(255,250,235,0.35)');
    g.addColorStop(1, 'rgba(255,250,235,0)');
    line(tx, ty, tx - ux * 9, ty - uy * 9, 0.8, g);
  }
  if (a.fire) {
    ctx.fillStyle = 'rgba(255,150,40,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, 7);
    ctx.fill();
  }
  // shaft
  line(tx, ty, x - ux, y - uy, 1.3, 'rgba(30,18,10,0.85)');
  line(tx, ty, x - ux, y - uy, 0.55, a.fire ? '#e6a65a' : '#c99a5e');
  // feathers, swept back from the tail
  for (const sd of [1, -1]) {
    const b = -L;
    poly('rgba(30,18,10,0.8)', at(b + 2.9, 0), at(b + 0.9, sd * 1.45), at(b - 0.5, sd * 1.45), at(b + 0.2, 0));
    poly(sd > 0 ? '#d8433a' : '#f1ece0', at(b + 2.4, 0), at(b + 0.9, sd * 1.05), at(b - 0.1, sd * 1.05), at(b + 0.4, 0));
  }
  // broadhead: dark edge, then steel (fire arrows: burning)
  poly('#1e1a18', at(1.9, 0), at(-1.5, 1.35), at(-0.9, 0), at(-1.5, -1.35));
  poly(a.fire ? '#ffd34a' : '#c3ccd5', at(1.3, 0), at(-1.1, 0.85), at(-0.7, 0), at(-1.1, -0.85));
  ctx.fillStyle = a.fire ? '#fff2b0' : '#eef3f7';
  ctx.fillRect(x + px * 0.2 - 0.25, y + py * 0.2 - 0.25, 0.5, 0.5);
  // nock
  ctx.fillStyle = '#24160c';
  ctx.fillRect(tx - 0.4, ty - 0.4, 0.8, 0.8);
  ctx.restore();
}
// arrows that hit a wall stay stuck in it for a few seconds (only for the looks)
const stuckArrows = [];
function drawArrows(ctx, cx, cy) {
  for (const s of stuckArrows) {
    drawArrow(ctx, s, s.x - cx, s.y - cy, Math.min(1, s.l / 60));
    // arrows you can pick up glint now and then at the feathers
    if (s.pick && (G.frame + Math.round(s.x * 7)) % 100 < 8) {
      const d = Math.hypot(s.vx, s.vy) || 1,
        gx = s.x - (s.vx / d) * 6 - cx,
        gy = s.y - (s.vy / d) * 6 - cy;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(gx - 0.25, gy - 1.25, 0.5, 2.5);
      ctx.fillRect(gx - 1.25, gy - 0.25, 2.5, 0.5);
    }
  }
  for (const a of arrows) drawArrow(ctx, a, a.x - cx, a.y - cy);
}

export { aimPath, canShoot, drawArrow, drawArrows, stuckArrows, hasBow, swing, drawGear, enemy, fireArrow, guard, playShot, shoot, strike, swordContext, updArrows, updCombat };
