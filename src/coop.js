// Team tasks in Koop: every few minutes a task that needs the players at the same time – two
// rune stones held together, a delivery against the clock, everybody deep down at once. They
// run on the host; the task travels to the clients with the game values (sync.js).
import { announce, announceBanner } from './announce.js';
import { resName } from './buildings.js';
import { celebrate } from './effects.js';
import { tr } from './i18n.js';
import { sfx } from './sound.js';
import { G, crew } from './state.js';
import { stock } from './store.js';
import { H, W, rnd, solid, surf } from './world.js';

const MIN = 3600;
const KINDS = ['deliver', 'runes', 'deep'];
const GOODS = [
  ['wood', 6],
  ['rock', 6],
  ['coal', 4],
  ['ore', 3],
  ['loam', 4],
];

const players = () => crew.filter(c => c.pid != null && !c.dead);
const ground = x => {
  let y = 0;
  while (y < H - 1 && !solid(x, y)) y++;
  return y;
};
const depthM = c => Math.round((c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))]) / 4);
const onRune = (c, r) => Math.abs(c.x + 3 - r[0]) < 8 && Math.abs(c.y + 10 - r[1]) < 14;

function startTask() {
  const M = G.mp,
    now = G.playTicks || 0,
    np = Math.max(2, players().length);
  let k = KINDS[(M.coopN = (M.coopN || 0) + 1) % KINDS.length];
  if (k === 'runes' && players().length < 2) k = 'deliver';
  if (k === 'runes') {
    const bx = G.base ? G.base.x + G.base.w : 100,
      x1 = Math.min(W - 30, Math.round(bx + 110 + rnd() * 120)),
      x2 = Math.min(W - 12, Math.round(x1 + 160 + rnd() * 120));
    M.coop = { k, a: [x1, ground(x1)], b: [x2, ground(x2)], on: [0, 0], end: now + 3 * MIN };
    announceBanner('Teamaufgabe', 'Stellt euch gleichzeitig auf beide Runensteine rechts der Burg');
  } else if (k === 'deliver') {
    const a = GOODS[Math.floor(rnd() * GOODS.length)];
    let b = a;
    while (b === a) b = GOODS[Math.floor(rnd() * GOODS.length)];
    const need = {},
      base = {};
    for (const [t, n] of [a, b]) {
      need[t] = n + (np - 2) * 2;
      base[t] = stock(t);
    }
    M.coop = { k, need, base, got: {}, end: now + 2.5 * MIN };
    announceBanner('Teamaufgabe', 'Bringt die Waren ins Lager, bevor die Zeit um ist');
  } else {
    M.coop = { k, m: 25, n: 0, of: np, end: now + 3 * MIN };
    announceBanner('Teamaufgabe', 'Alle Spieler gleichzeitig 25 m tief unter der Erde');
  }
  sfx('ting');
}
// is the task done right now? (and update what the HUD shows)
function check(T) {
  if (T.k === 'runes') {
    const ps = players(),
      a = ps.find(c => onRune(c, T.a)),
      b = ps.find(c => c !== a && onRune(c, T.b));
    T.on = [ps.some(c => onRune(c, T.a)) ? 1 : 0, ps.some(c => onRune(c, T.b)) ? 1 : 0];
    return !!(a && b);
  }
  if (T.k === 'deliver') {
    let ok = true;
    for (const t in T.need) {
      T.got[t] = Math.min(T.need[t], Math.max(T.got[t] || 0, stock(t) - T.base[t]));
      if (T.got[t] < T.need[t]) ok = false;
    }
    return ok;
  }
  const ps = players();
  T.of = ps.length;
  T.n = ps.filter(c => depthM(c) >= T.m).length;
  return ps.length > 0 && T.n === ps.length;
}
function finish(T, ok) {
  const M = G.mp;
  M.coop = null;
  M.coopNext = (G.playTicks || 0) + 2.5 * MIN;
  if (!ok) {
    announce('Teamaufgabe verpasst – die nächste kommt bald');
    return;
  }
  const pay = 100 + 25 * Math.max(2, players().length);
  G.money += pay;
  G.earned = (G.earned || 0) + pay;
  announceBanner('Teamaufgabe geschafft!', '+{pay} Taler', { pay });
  sfx('fanfare');
  for (const c of players()) celebrate(c.x + 3, c.y, 18);
}

// every tick on the host of a Koop round (and in a single game: nothing)
function updCoop() {
  if (!G.net || G.teams || !G.mp || G.netClient || G.frame % 30) return;
  const M = G.mp,
    T = M.coop;
  if (!T) {
    if ((G.playTicks || 0) >= (M.coopNext ??= 2.5 * MIN)) startTask();
    return;
  }
  if (check(T)) finish(T, true);
  else if ((G.playTicks || 0) >= T.end) finish(T, false);
}

// the line in the HUD while a task runs
function coopText() {
  const T = G.mp && G.mp.coop;
  if (!T) return null;
  const s = Math.max(0, Math.ceil((T.end - (G.playTicks || 0)) / 60)),
    clock = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  let what;
  if (T.k === 'runes') what = tr('Beide Runensteine besetzen ({n}/2)', { n: T.on[0] + T.on[1] });
  else if (T.k === 'deliver')
    what = Object.keys(T.need)
      .map(t => `${resName(t)} ${T.got[t] || 0}/${T.need[t]}`)
      .join(' · ');
  else what = tr('Alle {m} m tief ({n}/{of})', { m: T.m, n: T.n, of: T.of });
  return `${tr('Teamaufgabe')}: ${what} · ${clock}`;
}

// the two rune stones, glowing while somebody stands on them
function drawCoop(ctx, cx, cy) {
  const T = G.mp && G.mp.coop;
  if (!T || T.k !== 'runes') return;
  [T.a, T.b].forEach((r, k) => {
    const x = Math.round(r[0] - cx),
      y = Math.round(r[1] - cy);
    if (x < -20 || x > G.VW + 20 || y < -60 || y > G.VH + 20) return;
    const on = T.on && T.on[k];
    // a beam of light so the stones are found from afar
    ctx.fillStyle = on ? 'rgba(120,240,255,0.35)' : `rgba(120,240,255,${0.1 + 0.06 * Math.sin(G.frame / 12)})`;
    ctx.fillRect(x - 1, y - 48, 3, 40);
    ctx.fillStyle = '#24160c';
    ctx.fillRect(x - 3, y - 9, 7, 9);
    ctx.fillStyle = '#8a847c';
    ctx.fillRect(x - 2, y - 8, 5, 8);
    ctx.fillStyle = on ? '#9ff4ff' : '#4f8a94';
    ctx.fillRect(x, y - 7, 1, 5);
    ctx.fillRect(x - 1, y - 5, 3, 1);
  });
}

export { coopText, drawCoop, updCoop };
