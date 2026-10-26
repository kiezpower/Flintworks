// Versus rules that bring the two castles together: castles have hit points and can be stormed
// (flint, TNT, arrows, the sword), a hill in the middle pays the team that holds it, a chest in
// the middle fills up again, the round has a clock with a loud last minute, and a team that
// falls behind gets supplies from the sky. Everything is decided on the host; clients get the
// castles' hit points with the buildings and the hill with the game values (sync.js).
import { announce, announceBanner } from './announce.js';
import { spawnItem } from './entities.js';
import { addFloat } from './floats.js';
import { goalReached, mode } from './modes.js';
import { sfx } from './sound.js';
import { addStat } from './stats.js';
import { G, builds, crew, flashes, meteors, parts } from './state.js';
import { TEAM_COLS, teamOf, useTeam } from './teams.js';
import { AIR, GRANITE, H, ROCK, W, bg, clamp, mat, paint, rnd, solid, surf } from './world.js';

const CASTLE_HP = 400;
const ROUND_MIN = 8; // minutes of a Versus round, unless the map says otherwise (rules.vsTime)
const TEAM = ['Rot', 'Blau'];
const MIN = 3600;

// ---- a new world: castles, hill, the chest in the middle, the clock ----
function setupRound() {
  const M = G.mp;
  if (!M) return;
  M.vs = !!G.teams; // (a map without a second castle is played together)
  if (!M.vs) return;
  for (const b of builds) if (b.type === 'base') b.hp = CASTLE_HP;
  const L = mode().pkg;
  M.len = Math.round((L?.rules?.vsTime || ROUND_MIN) * MIN);
  const h = L?.objects?.find(o => o.t === 'hill'),
    hx = clamp(h ? Math.round(h.x < 0 ? W + h.x : h.x) : Math.round(W / 2), 10, W - 10);
  M.hill = { x: hx, y: surf[hx], r: h?.r || 34, own: -1, cap: 0 };
  M.sup = 2 * MIN; // first supply check after two minutes
  M.mark = [0, 0]; // how far each team has been announced (¾, almost there)
  if (!L) centerChest();
}
// a generated world gets a chest under the hill that fills up again every two minutes
function centerChest() {
  const x = Math.round(W / 2),
    y = Math.min(H - 24, surf[x] + 46);
  for (let yy = y - 9; yy < y; yy++)
    for (let xx = x - 8; xx <= x + 8; xx++) {
      const dx = (xx - x) / 9,
        dy = (yy - y + 1) / 9,
        i = yy * W + xx;
      if (dx * dx + dy * dy > 1 || mat[i] === GRANITE) continue;
      mat[i] = AIR;
      bg[i] = 1;
      paint(i);
    }
  for (let yy = y; yy < y + 3; yy++)
    for (let xx = x - 7; xx <= x + 7; xx++) {
      const i = yy * W + xx;
      if (mat[i] !== GRANITE) {
        mat[i] = ROCK;
        paint(i);
      }
    }
  (G.chests ||= []).push({ x: x - 4, y: y - 6, open: false, re: 2 });
}

// ---- castles ----
const castleOf = t => builds.find(b => b.type === 'base' && teamOf(b) === t);
// damage to a castle by team `by` (player pid if a player did it); a hit shakes gold out of
// the castle's cash, which anybody can pick up
function damageCastle(b, dmg, by, pid = null) {
  if (!G.teams || G.netClient || !b || b.type !== 'base' || !(b.hp > 0) || by == null || by === teamOf(b)) return;
  const t = teamOf(b);
  dmg = Math.min(b.hp, Math.round(dmg));
  b.hp -= dmg;
  b.hitT = G.frame;
  addStat(pid, 'siege', dmg);
  const cx = b.x + b.w / 2,
    top = b.gy - b.h;
  addFloat(cx, top - 6, '-' + dmg, '#ff6a5a');
  flashes.push({ x: cx, y: top + 6, r: 10, l: 6 });
  const was = G.curTeam;
  useTeam(t);
  const n = Math.min(Math.floor(G.money / 25), Math.max(1, Math.floor(dmg / 20)));
  G.money -= n * 25;
  useTeam(was);
  for (let k = 0; k < n; k++) {
    const side = rnd() < 0.5 ? -1 : 1;
    spawnItem('nug', cx, top - 2, side * (1.4 + rnd() * 1.8), -2 - rnd() * 1.5, 25);
  }
  if (G.frame - (G.mp.warnT ?? -9999) > 600) {
    G.mp.warnT = G.frame;
    announce('Eure Burg wird angegriffen!', null, t);
  }
  if (b.hp <= 0) {
    G.mp.fallen = t;
    sfx('boom', cx, top);
    announceBanner('Burg gefallen', `${TEAM[t]}e Burg ist gestürmt!`);
  }
}
// a castle that was left alone for ten seconds mends itself slowly
function mendCastles() {
  for (const b of builds)
    if (b.type === 'base' && b.hp > 0 && b.hp < CASTLE_HP && G.frame - (b.hitT || 0) > 600) b.hp++;
}
// the hit points above a castle (and smoke over a fallen one)
function drawCastleHp(ctx, b, sx, sy) {
  if (b.type !== 'base' || b.hp == null) return;
  const w = b.w - 8,
    x = sx + 4,
    y = sy - 16;
  ctx.fillStyle = '#24160c';
  ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = '#5a4a3a';
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = G.frame - (b.hitT || -99) < 8 ? '#ffffff' : TEAM_COLS[teamOf(b)];
  ctx.fillRect(x, y, Math.ceil((w * b.hp) / CASTLE_HP), 2);
  if (b.hp <= 0 && G.frame % 6 === 0)
    parts.push({ x: b.x + 6 + rnd() * (b.w - 12), y: b.gy - b.h, vx: 0, vy: -0.4, l: 60, c: '#4d4842', g: -0.004 });
}

// ---- the hill in the middle ----
const onHill = (c, h) => Math.abs(c.x + 3 - h.x) < h.r && Math.abs(c.y + 10 - h.y) < 26;
function hillTick() {
  const h = G.mp.hill;
  if (!h) return;
  // (the flag stands on the ground as it is now, also after digging or blasting)
  let y = 0;
  while (y < H - 1 && !solid(h.x, y)) y++;
  h.y = y;
  const n = [0, 0];
  for (const c of crew)
    if (!c.dead && !c.trapped && onHill(c, h)) {
      n[teamOf(c) ? 1 : 0]++;
      if (c.pid != null && G.frame % 60 === 0) addStat(c.pid, 'hill', 3);
    }
  // red pulls towards -1, blue towards +1; one Wühler alone takes it in about ten seconds
  const d = Math.max(-3, Math.min(3, n[1] - n[0]));
  if (d) h.cap = clamp(h.cap + d * 0.05, -1, 1);
  const was = h.own;
  if (h.cap <= -1) h.own = 0;
  else if (h.cap >= 1) h.own = 1;
  else if ((h.own === 0 && h.cap > 0) || (h.own === 1 && h.cap < 0)) h.own = -1;
  if (h.own !== was) {
    if (h.own >= 0) announce(`${TEAM[h.own]} hält den Hügel!`);
    else announce('Der Hügel ist wieder frei');
    sfx('ting', h.x, h.y);
  }
  // the team on the hill earns three Taler every two seconds
  if (h.own >= 0 && G.frame % 120 === 0) {
    const cur = G.curTeam;
    useTeam(h.own);
    G.money += 3;
    G.earned = (G.earned || 0) + 3;
    useTeam(cur);
    addFloat(h.x, h.y - 22, '+3', '#f2c230');
  }
}
function drawHill(ctx, cx, cy) {
  const h = G.mp?.hill;
  if (!h) return;
  const x = Math.round(h.x - cx),
    y = Math.round(h.y - cy);
  if (x < -40 || x > G.VW + 40 || y < -40 || y > G.VH + 40) return;
  // stakes at the edges of the hill
  ctx.fillStyle = '#6b4a2a';
  for (const e of [-h.r, h.r]) ctx.fillRect(x + e, y - 4, 1, 4);
  // the pole and the flag of the team that holds it
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x, y - 20, 1, 20);
  const wave = (G.frame >> 4) & 1;
  ctx.fillStyle = h.own >= 0 ? TEAM_COLS[h.own] : '#e8e2d0';
  ctx.fillRect(x + 1, y - 20 + wave, 8, 5);
  // how far the hill is taken: red from the left, blue from the right
  ctx.fillStyle = '#24160c';
  ctx.fillRect(x - 9, y - 25, 19, 3);
  ctx.fillStyle = TEAM_COLS[h.cap < 0 ? 0 : 1];
  const w = Math.round(Math.abs(h.cap) * 8);
  ctx.fillRect(h.cap < 0 ? x - w : x + 1, y - 24, w, 1);
}

// ---- the clock, the last minute, supplies, news about the other team ----
const left = () => (G.mp?.len ? G.mp.len - (G.playTicks || 0) : null);
// "4:59" for the HUD (null without a clock)
function clockText() {
  const l = left();
  if (l == null) return null;
  const s = Math.max(0, Math.ceil(l / 60));
  return `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
// how far every team is, 0..1
function ratios() {
  const cur = G.curTeam,
    r = G.teams.map((t, k) => (useTeam(k), Math.min(1, mode().prog() / Math.max(1, mode().goal))));
  useTeam(cur);
  return r;
}
function clockTick() {
  const M = G.mp,
    l = left();
  if (l <= 2 * MIN && !M.f2) {
    M.f2 = true;
    announce('Noch 2 Minuten!');
  }
  if (l <= MIN && !M.f1) {
    M.f1 = true;
    M.shower = 50 * 60;
    announceBanner('Letzte Minute!', 'Meteore fallen zwischen den Burgen');
    sfx('thunder');
  }
  // the meteor shower of the last minute, between the castles
  if (M.shower > 0) {
    M.shower -= 30;
    if (M.shower % 90 === 0) {
      const a = castleOf(0),
        b = castleOf(1),
        x0 = a ? a.x + a.w + 30 : 60,
        x1 = b ? b.x - 30 : W - 60;
      meteors.push({ x: x0 + rnd() * Math.max(10, x1 - x0) - 60, y: -10, vx: 1.1 + rnd() * 0.5, vy: 2.2 });
      sfx('whoosh');
    }
  }
  const r = ratios();
  // news about the other team: three quarters, almost there
  r.forEach((v, t) => {
    const m = M.mark[t] || 0;
    if (v >= 0.9 && m < 2) {
      M.mark[t] = 2;
      announce(`${TEAM[t]} ist kurz vor dem Ziel!`);
    } else if (v >= 0.75 && m < 1) {
      M.mark[t] = 1;
      announce(`${TEAM[t]} hat schon drei Viertel geschafft!`);
    }
  });
  // every 90 seconds: the team that is well behind gets explosives dropped at its castle
  if ((G.playTicks || 0) >= M.sup) {
    M.sup += 1.5 * MIN;
    const hp = [0, 1].map(t => castleOf(t)?.hp ?? CASTLE_HP),
      lag = t => r[1 - t] - r[t] >= 0.2 || hp[t] - hp[1 - t] <= -120;
    const t = lag(0) ? 0 : lag(1) ? 1 : -1;
    if (t >= 0) supply(t);
  }
}
function supply(t) {
  const b = castleOf(t);
  if (!b) return;
  const x = t ? b.x - 14 : b.x + b.w + 10;
  ['tnt', 'flint', 'flint'].forEach((k, n) => spawnItem(k, x + n * 4, 4, 0, 0.5, 30));
  announceBanner('Nachschub!', 'Sprengstoff fällt vor eurer Burg vom Himmel', null, t);
  announce('Der Gegner bekommt Nachschub', null, 1 - t);
  sfx('whoosh');
}

// every tick on the host while a Versus round runs
function updVersus() {
  if (!G.teams || !G.mp || G.netClient) return;
  if (G.frame % 60 === 0) mendCastles();
  if (G.frame % 30 === 0) {
    hillTick();
    clockTick();
  }
}
// any round: chests marked "re" fill up again some minutes after they were opened
function chestTick() {
  for (const ch of G.chests || [])
    if (ch.re && ch.open && (ch.reT = (ch.reT || 0) + 30) >= ch.re * MIN) {
      ch.open = false;
      ch.reT = 0;
      announce('Die Truhe in der Mitte ist wieder gefüllt!');
    }
}

// the end of a Versus round: a castle fell, the goal was reached, or the time is up.
// winner: team index, -2 for a draw, null while the round goes on
function vsResult() {
  const M = G.mp;
  if (M.fallen != null) return { winner: 1 - M.fallen, why: `${TEAM[M.fallen]}e Burg ist gestürmt!` };
  const cur = G.curTeam;
  let winner = null;
  for (let t = 0; t < G.teams.length && winner == null; t++) {
    useTeam(t);
    if (goalReached()) winner = t;
  }
  useTeam(cur);
  if (winner != null) return { winner, why: `${TEAM[winner]} hat das Ziel erreicht` };
  if (left() == null || left() > 0) return null;
  const r = ratios(),
    hp = [0, 1].map(t => castleOf(t)?.hp ?? 0);
  if (Math.abs(r[0] - r[1]) > 0.001) return { winner: r[0] > r[1] ? 0 : 1, why: 'Zeit um: das weitere Team gewinnt' };
  if (hp[0] !== hp[1]) return { winner: hp[0] > hp[1] ? 0 : 1, why: 'Zeit um: die stärkere Burg gewinnt' };
  return { winner: -2, why: 'Zeit um: beide gleich weit' };
}

export { CASTLE_HP, TEAM, castleOf, chestTick, clockText, damageCastle, drawCastleHp, drawHill, setupRound, updVersus, vsResult };
