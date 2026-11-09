// The ice king (a boss of the winter worlds, beside the giant worm in boss.js and the lava queen
// in queen.js): in a winter world of free play, once per world (not in the relaxed setting, and
// only after ten minutes) he appears in a cave deep down when a Wühler is there. He floats
// through the open caves, keeps a little above and away from the nearest Wühler, throws shards of
// ice (events.js) that freeze whoever they hit – slower for three seconds – and calls bats. Arrows,
// blasts and the sword hurt him; beaten, he leaves gems and gold (objects.js LOOT). Only the host
// moves him; the others get him with the creatures.
import { announceBanner, quake } from './announce.js';
import { hurt } from './digger.js';
import { mkAnimal } from './entities.js';
import { throwBomb } from './events.js';
import { GAME_MODES } from './modes.js';
import { sfx } from './sound.js';
import { G, animals, crew, parts } from './state.js';
import { W, free, rnd, surf } from './world.js';

const MINUTE = 3600;
const kingOf = () => animals.find(a => a.kind === 'iceking' && a.hp > 0) || null;
const allowed = () => {
  const M = GAME_MODES[G.mode];
  return !!M && !M.campaign && !M.pkg && !M.daily && !M.kit && !G.tut && !G.relaxed && G.biome === 'winter';
};
const depthOf = c => c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))];

function spawnKing(x, y) {
  if (G.netClient || kingOf()) return null;
  const a = mkAnimal('iceking', x - 7, y - 6);
  a.throwT = 90;
  a.callT = 400;
  a.throws = 0;
  animals.push(a);
  G.kingDone = true;
  announceBanner('Der Eiskönig!', 'Seine Eissplitter frieren dich ein – Pfeile und Schwert helfen');
  quake(2);
  sfx('thunder');
  return a;
}
G.spawnKing = spawnKing;

// every half second (host, boss.js): a Wühler deep down in an open cave of a winter world
function kingTick() {
  if (G.netClient || G.kingDone || G.state !== 'play' || !allowed()) return;
  if ((G.playTicks || 0) < 10 * MINUTE) return;
  for (const c of crew) {
    if (c.dead || c.pid == null || depthOf(c) < 100) continue;
    // room for him beside the Wühler, a little above
    for (const dx of [40, -40, 28, -28]) {
      const x = Math.round(c.x + 3 + dx),
        y = Math.round(c.y - 8);
      if (x > 10 && x < W - 24 && free(x - 7, y - 6, 14, 12)) return void spawnKing(x, y);
    }
  }
}

// his mind (objects.js updAnimal): float towards a spot above and beside the prey, through open
// space only; throw shards, call bats, freeze whoever touches him
function kingUpd(a) {
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
  if (prey) {
    const side = a.x + a.w / 2 < prey.x + 3 ? -1 : 1,
      tx = prey.x + 3 + side * 36 - a.w / 2,
      ty = prey.y - 14 + Math.sin(G.frame / 30) * 4;
    a.vx += (Math.sign(tx - a.x) * 0.5 - a.vx) * 0.05;
    a.vy += (Math.sign(ty - a.y) * 0.4 - a.vy) * 0.05;
    a.face = side < 0 ? 1 : -1;
  } else {
    a.vx *= 0.9;
    a.vy *= 0.9;
  }
  // (through open space only: earth stops him)
  if (free(a.x + a.vx, a.y, a.w, a.h)) a.x += a.vx;
  else a.vx = 0;
  if (free(a.x, a.y + a.vy, a.w, a.h)) a.y += a.vy;
  else a.vy = 0;
  if (rnd() < 0.25 && parts.length < 1300)
    parts.push({ x: a.x + rnd() * a.w, y: a.y + a.h, vx: 0, vy: 0.2, l: 20, c: rnd() < 0.5 ? '#e6f6ff' : '#bfe6f6' });
  // shards of ice at the prey, three at a time
  if (--a.throwT <= 0) {
    a.throwT = 120;
    if (prey && bd < 150) {
      const T = 40,
        g = 0.12,
        x0 = a.x + a.w / 2,
        y0 = a.y + a.h / 2;
      for (let k = -1; k <= 1; k++) {
        const dx = prey.x + 3 + k * 7 - x0,
          dy = prey.y + 5 - y0;
        throwBomb(x0, y0, dx / T, (dy - 0.5 * g * T * T) / T, 'i');
      }
      a.throws++;
      sfx('fuse', x0, y0, 0.6, 1.8);
    }
  }
  // bats out of the dark, at most four about him
  if (--a.callT <= 0) {
    a.callT = 720;
    const near = animals.filter(o => o.kind === 'bat' && Math.abs(o.x - a.x) < 80 && Math.abs(o.y - a.y) < 60).length;
    for (let k = near; k < Math.min(4, near + 2); k++) animals.push(mkAnimal('bat', a.x + (k % 2 ? -10 : 18), a.y + 4));
  }
  // whoever touches him freezes
  for (const c of crew) {
    if (c.dead || (c.kingCd || 0) > G.frame) continue;
    if (c.x + 6 > a.x && c.x < a.x + a.w && c.y + 10 > a.y && c.y < a.y + a.h) {
      c.kingCd = G.frame + 60;
      hurt(c, 10);
      c.frost = 180;
    }
  }
  return a.hp > 0;
}

// ---- the picture: a crowned figure of ice with a flowing cloak ----
function drawKing(ctx, a, x, y) {
  const w = a.w,
    h = a.h,
    hot = a.hurt > 0;
  ctx.fillStyle = '#24160c';
  ctx.fillRect(x + 1, y + 1, w - 2, h);
  ctx.fillRect(x + 4, y - 3, w - 8, 4);
  // the cloak, wider at the bottom, waving
  const wave = Math.sin(G.frame / 10) > 0 ? 1 : 0;
  ctx.fillStyle = hot ? '#ffffff' : '#5a8ab8';
  ctx.fillRect(x + 2, y + 4, w - 4, h - 4);
  ctx.fillRect(x + 1 - wave, y + h - 3, w - 2 + wave * 2, 2);
  ctx.fillStyle = hot ? '#ffffff' : '#8fd0ee';
  ctx.fillRect(x + 3, y + 5, w - 6, h - 7);
  // the face of ice
  ctx.fillStyle = '#e6f6ff';
  ctx.fillRect(x + 4, y + 1, w - 8, 4);
  ctx.fillStyle = '#24160c';
  const ex = a.face < 0 ? x + 5 : x + w - 7;
  ctx.fillRect(ex, y + 2, 1, 1);
  ctx.fillRect(ex + 2, y + 2, 1, 1);
  // the crown of icicles
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 3; k++) ctx.fillRect(x + 5 + k * 2, y - 3, 1, 3);
}

export { drawKing, kingOf, kingTick, kingUpd, spawnKing };
