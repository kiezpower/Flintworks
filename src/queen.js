// The lava queen (a second boss, after the giant worm in boss.js): deep down she rises out of a
// lava lake when a Wühler comes near, once per world in free play (not in the relaxed setting,
// and only after eight minutes). She stays over her lake, drifts along it after the nearest Wühler, throws
// lava bombs at him (events.js), calls lava slimes out of the lake and burns whoever touches her.
// Lava does her no harm; arrows, blasts and the sword do. Beaten, she leaves gold and gems
// (objects.js LOOT). Only the host moves her; the others get her with the creatures.
import { announceBanner, quake } from './announce.js';
import { hurt } from './digger.js';
import { mkAnimal } from './entities.js';
import { throwBomb } from './events.js';
import { tr } from './i18n.js';
import { GAME_MODES } from './modes.js';
import { sfx } from './sound.js';
import { G, animals, crew, parts } from './state.js';
import { AIR, H, LAVA, W, mat, rnd, surf } from './world.js';

const MINUTE = 3600;
const queenOf = () => animals.find(a => a.kind === 'queen' && a.hp > 0) || null;
const allowed = () => {
  const M = GAME_MODES[G.mode];
  return !!M && !M.campaign && !M.pkg && !M.daily && !M.kit && !G.tut && !G.relaxed;
};
const depthOf = c => c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))];

// the surface of a lava lake near (x, y): a lava cell with air above it, or null
function lakeNear(x, y, r = 90) {
  let best = null,
    bd = 1e9;
  for (let yy = Math.max(1, y - r); yy < Math.min(H - 1, y + r); yy += 2)
    for (let xx = Math.max(1, x - r); xx < Math.min(W - 1, x + r); xx += 3) {
      const i = yy * W + xx;
      if (mat[i] !== LAVA || mat[i - W] !== AIR) continue;
      const d = Math.abs(xx - x) + Math.abs(yy - y);
      if (d < bd) {
        bd = d;
        best = { x: xx, y: yy };
      }
    }
  return best;
}
function spawnQueen(at) {
  if (G.netClient || queenOf()) return null;
  // the stretch of her lake's surface: she stays over it
  let l = at.x,
    r = at.x;
  while (l > 1 && mat[at.y * W + l - 1] === LAVA) l--;
  while (r < W - 2 && mat[at.y * W + r + 1] === LAVA) r++;
  const mid = (l + r) / 2;
  const a = mkAnimal('queen', mid - 8, at.y - 14);
  a.home = { x: mid, y: at.y, l, r };
  a.throwT = 120;
  a.callT = 300;
  a.throws = 0;
  animals.push(a);
  G.queenDone = true;
  announceBanner('Die Lavakönigin!', 'Sie steigt aus dem Lavasee – Pfeile und Schwert helfen, Lava nicht');
  quake(2.5);
  sfx('thunder');
  return a;
}
G.spawnQueen = spawnQueen;

// every half second (host, boss.js): a Wühler deep down near a lava lake wakes her
function queenTick() {
  if (G.netClient || G.queenDone || G.state !== 'play' || !allowed()) return;
  if ((G.playTicks || 0) < 8 * MINUTE) return;
  for (const c of crew) {
    if (c.dead || c.pid == null || depthOf(c) < 120) continue;
    const at = lakeNear(Math.round(c.x + 3), Math.round(c.y + 5));
    if (at) return void spawnQueen(at);
  }
}

// her mind (objects.js updAnimal): bob over the lake, drift after the prey, throw and call
function queenUpd(a) {
  const h = a.home || (a.home = { x: a.x + a.w / 2, y: a.y + a.h });
  // the prey: the nearest living Wühler
  let prey = null,
    bd = 1e9;
  for (const c of crew) {
    if (c.dead) continue;
    const d = Math.hypot(c.x + 3 - (a.x + a.w / 2), c.y + 5 - (a.y + a.h / 2));
    if (d < bd) {
      bd = d;
      prey = c;
    }
  }
  // over her lake, towards the prey as far as the lake reaches, rising and sinking
  const l = (h.l ?? h.x - 24) + a.w / 2 - 2,
    r = Math.max(l, (h.r ?? h.x + 24) - a.w / 2 + 2);
  const want = prey ? Math.max(l, Math.min(r, prey.x + 3)) : h.x;
  a.x += (want - a.w / 2 - a.x) * 0.02;
  a.y = h.y - a.h - 2 + Math.sin(G.frame / 22) * 1.5;
  a.face = prey && prey.x + 3 < a.x + a.w / 2 ? -1 : 1;
  if (rnd() < 0.3 && parts.length < 1300)
    parts.push({ x: a.x + rnd() * a.w, y: a.y + a.h, vx: 0, vy: -0.3 - rnd() * 0.3, l: 18, c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f' });
  // lava bombs at the prey, three at a time, when it is within reach
  if (--a.throwT <= 0) {
    a.throwT = 150;
    if (prey && bd < 160) {
      const T = 50,
        g = 0.12,
        x0 = a.x + a.w / 2,
        y0 = a.y + 2;
      for (let k = -1; k <= 1; k++) {
        const dx = prey.x + 3 + k * 8 - x0,
          dy = prey.y + 5 - y0;
        throwBomb(x0, y0, dx / T, (dy - 0.5 * g * T * T) / T);
      }
      a.throws++;
      sfx('fuse', x0, y0);
    }
  }
  // lava slimes out of the lake, at most three about her
  if (--a.callT <= 0) {
    a.callT = 600;
    const near = animals.filter(o => o.kind === 'slime' && Math.abs(o.x - h.x) < 60 && Math.abs(o.y - h.y) < 40).length;
    if (near < 3) {
      const s = mkAnimal('slime', h.x + (rnd() < 0.5 ? -14 : 8), h.y - 8);
      animals.push(s);
      sfx('growl', h.x, h.y, 0.6);
    }
  }
  // whoever touches her burns
  for (const c of crew) {
    if (c.dead || (c.queenCd || 0) > G.frame) continue;
    if (c.x + 6 > a.x && c.x < a.x + a.w && c.y + 10 > a.y && c.y < a.y + a.h) {
      c.queenCd = G.frame + 60;
      hurt(c, 12);
      c.burn = 120;
    }
  }
  return a.hp > 0;
}

// ---- the picture: a glowing body of molten rock with a crown ----
function drawQueen(ctx, a, x, y) {
  const w = a.w,
    hh = a.h,
    hot = a.hurt > 0;
  ctx.fillStyle = '#24160c';
  ctx.fillRect(x - 1, y + 2, w + 2, hh - 1);
  ctx.fillRect(x + 2, y - 1, w - 4, 4);
  ctx.fillStyle = hot ? '#fff0d0' : '#b8361e';
  ctx.fillRect(x, y + 3, w, hh - 3);
  ctx.fillStyle = hot ? '#fff6e0' : '#ff7a2a';
  ctx.fillRect(x + 1, y + 4, w - 2, hh - 6);
  ctx.fillStyle = '#ffcf4a';
  // cracks of glowing rock
  for (let k = 0; k < 3; k++) ctx.fillRect(x + 3 + k * 4, y + 6 + ((k + (G.frame >> 4)) % 3), 1, 3);
  ctx.fillRect(x + 3, y, w - 6, 3);
  // the head with the crown
  ctx.fillStyle = '#24160c';
  ctx.fillRect(x + 4, y - 4, w - 8, 4);
  ctx.fillStyle = '#ffe066';
  for (let k = 0; k < 3; k++) ctx.fillRect(x + 5 + k * 3, y - 4, 1, 3);
  ctx.fillRect(x + 4, y - 2, w - 8, 1);
  // eyes towards the prey
  ctx.fillStyle = '#fff6c0';
  const ex = a.face < 0 ? x + 4 : x + w - 7;
  ctx.fillRect(ex, y + 5, 1, 1);
  ctx.fillRect(ex + 2, y + 5, 1, 1);
}
const queenName = () => tr('Lavakönigin');

export { drawQueen, lakeNear, queenName, queenOf, queenTick, queenUpd, spawnQueen };
