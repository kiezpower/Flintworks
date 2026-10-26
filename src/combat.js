// Fighting monsters (and in Versus the other team): sword swings (players with Aktion, helpers
// by themselves), the longbow with arrows and fire arrows from the store, and shield/helmet
// that soften hits. Swords and arrows also hurt the other team's castle.
import { announce } from './announce.js';
import { arrows } from './buildings.js';
import { hurt } from './clonk.js';
import { addStat } from './stats.js';
import { teamOf } from './teams.js';
import { damageCastle } from './versus.js';
import { sfx } from './sound.js';
import { G, animals, builds, crew, flashes, parts, trees } from './state.js';
import { addArrows, arrowsOf, hasTool, teamHas } from './tools.js';
import { ignite } from './objects.js';
import { isPlayer } from './players.js';
import { rnd, solid } from './world.js';

const FOES = { monster: 1, bat: 1 };

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
const canShoot = c => !!c && hasTool('bow') && quiver() > 0 && c.ride == null;
// Wurf with an empty hand; normal arrows first, then fire arrows
function shoot(c, I) {
  const fire = arrowsOf('arrow') <= 0;
  addArrows(fire ? 'farrow' : 'arrow', -1);
  const sp = 4.4,
    ox = c.x + 3 + c.face * 4,
    oy = c.y + 4;
  // with the stick in the middle the arrow flies at the next monster in front (like a tower)
  // (in Versus also at the next Wühler of the other team)
  const foes = [...animals.filter(a => FOES[a.kind]), ...crew.filter(o => enemy(c, o))];
  const tgt =
    Math.abs(I.ay) < 0.4 &&
    foes.find(a => (a.x + a.w / 2 - ox) * c.face > 0 && Math.hypot(a.x + a.w / 2 - ox, a.y + a.h / 2 - oy) < 170);
  let vx, vy;
  if (tgt) {
    const dx = tgt.x + tgt.w / 2 - ox,
      dy = tgt.y + tgt.h / 2 - oy,
      t = Math.hypot(dx, dy) / sp;
    vx = dx / t;
    vy = dy / t - 0.03 * t;
  } else {
    const ang = I.ay < -0.4 ? 0.75 : I.ay > 0.4 ? -0.15 : 0.12;
    vx = Math.cos(ang) * sp * c.face;
    vy = -Math.sin(ang) * sp;
  }
  fireArrow({ x: ox, y: oy, vx, vy, l: 150, dmg: fire ? 40 : 28, fire, tm: teamOf(c), by: c.pid });
  sfx('bow', c.x, c.y);
}
// every arrow (also from towers) goes through here, so clients get to see it
function fireArrow(a) {
  arrows.push(a);
  if (G.netHost) G.netEvent(['p', a.fire ? 'f' : 'a', Math.round(a.x), Math.round(a.y), a.vx, a.vy, a.tm ?? null]);
}
// a client shows the arrows of the host (only for the looks), and the sparks of hits
function playShot(e) {
  if (e[0] === 'h') {
    hitFx(e[1], e[2]);
    return true;
  }
  if (e[0] !== 'p') return false;
  if (e[1] === 'a' || e[1] === 'f')
    arrows.push({ x: e[2], y: e[3], vx: e[4], vy: e[5], l: 150, fire: e[1] === 'f', tm: e[6] ?? undefined });
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
      if (!G.netClient) {
        m.hp -= a.dmg || 20;
        m.hurt = 12;
        m.vx += Math.sign(a.vx) * 0.8;
      }
      hit = true;
      sfx('clack', a.x, a.y);
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
    if (hit || wall || --a.l <= 0) arrows.splice(k, 1);
  }
}
// a fire arrow sets trees alight and lights up gas pockets
function burnAt(x, y) {
  flashes.push({ x, y, r: 4, l: 5 });
  for (let q = 0; q < 6; q++)
    parts.push({ x, y, vx: (rnd() - 0.5) * 1.2, vy: -rnd(), l: 18, c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f' });
  if (G.netClient) return;
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
  if (!teamHas(c.team, 'sword')) return;
  if (c.swing > 0) {
    // a blade sweeping from above the head down in front
    const t = 1 - c.swing / 12,
      a = -1.3 + t * 2.2,
      hx = x + 3 + f * 2,
      hy = y + 5;
    ctx.strokeStyle = '#24160c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(a) * 8 * f, hy + Math.sin(a) * 8);
    ctx.stroke();
    ctx.strokeStyle = '#e4e8ec';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.lineWidth = 1;
    if (c.swing > 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(hx + f * 4 - 2, hy - 4, 4, 8);
    }
  } else if (!c.climb && !c.hangle && !c.digging) {
    ctx.fillStyle = '#aab0b6';
    ctx.fillRect(f > 0 ? x + 0.5 : x + 5, y + 6, 0.5, 3.5);
  }
}
function drawArrow(ctx, a, x, y) {
  const d = Math.hypot(a.vx, a.vy) || 1;
  ctx.fillStyle = a.fire ? '#ffcf4a' : '#d9b98a';
  ctx.fillRect(x, y, 1, 1);
  ctx.fillRect(Math.round(x - (a.vx / d) * 2), Math.round(y - (a.vy / d) * 2), 1, 1);
  ctx.fillStyle = a.fire ? '#ff7a2f' : '#4a4540';
  ctx.fillRect(Math.round(x + a.vx / d), Math.round(y + a.vy / d), 1, 1);
}

export { canShoot, drawArrow, drawGear, enemy, fireArrow, guard, playShot, shoot, strike, swordContext, updArrows, updCombat };
