// The giant worm (a boss, like the worms of Terraria and Noita): a head and a long body of plates
// that bores through the earth, leaves tunnels behind, breaks out at the surface in a high arc and
// dives back in. It goes for the nearest Wühler, and hurts whoever its body touches. Arrows,
// blasts, the cannon and burning oil hit its head; beaten, it leaves a heap of gold and gems.
// It comes once per world in free play after ten minutes (now and then, not in the relaxed
// setting), and in the third night of "Festung" (siege.js). Only the host moves it; the others get
// its body with the creatures (net/sync.js).
import { announceBanner, quake } from './announce.js';
import { hurt, startTumble } from './digger.js';
import { mkAnimal } from './entities.js';
import { tr } from './i18n.js';
import { GAME_MODES } from './modes.js';
import { sfx } from './sound.js';
import { G, animals, crew, parts } from './state.js';
import { AIR, GRANITE, H, PLANK, W, activate, bg, mat, paint, rnd } from './world.js';
import { queenOf, queenTick } from './queen.js';
import { kingOf, kingTick } from './iceking.js';

const SEGS = 14,
  GAP = 5,
  R = 4; // segments, the distance between them, the radius the head bores
const wormOf = () => animals.find(a => a.kind === 'worm' && a.hp > 0) || null;

function spawnWorm() {
  if (G.netClient || wormOf()) return null;
  // deep down, far from the castle and the Wühler
  const b = G.base,
    mid = b ? b.x + b.w / 2 : W / 2;
  let x = mid > W / 2 ? 60 + rnd() * (W * 0.3) : W - 60 - rnd() * (W * 0.3);
  x = Math.max(20, Math.min(W - 20, x));
  const y = H - 40;
  const a = mkAnimal('worm', x - 5, y - 5);
  a.seg = Array.from({ length: SEGS }, () => ({ x, y }));
  a.vx = 0;
  a.vy = -1;
  announceBanner('Ein Riesenwurm!', 'Die Erde bebt – er gräbt sich zu euch herauf');
  quake(3);
  sfx('thunder');
  animals.push(a);
  G.wormDone = true;
  return a;
}
G.spawnWorm = spawnWorm;
// free play: once per world after ten minutes, now and then (checked every half second)
function bossTick() {
  queenTick(); // (the lava queen wakes on her own terms, queen.js)
  kingTick(); // (and the ice king in winter worlds, iceking.js)
  if (G.netClient || G.wormDone || G.relaxed || G.tut || G.state !== 'play') return;
  const M = GAME_MODES[G.mode];
  if (!M || M.campaign || M.pkg || M.daily || M.kit) return;
  if ((G.playTicks || 0) < 10 * 3600 || rnd() > 0.02) return;
  spawnWorm();
}

// the worm's mind: steer the head towards its prey under the earth, fall in an arc in the air,
// bore through what is in the way, let the body follow, strike what it touches
function wormUpd(a) {
  const s = a.seg,
    h = s[0];
  // the prey: the nearest Wühler, else the castle
  let tx = G.base ? G.base.x + G.base.w / 2 : W / 2,
    ty = G.base ? G.base.gy : H / 2,
    bd = 1e9;
  for (const c of crew) {
    if (c.dead) continue;
    const d = Math.hypot(c.x + 3 - h.x, c.y + 5 - h.y);
    if (d < bd) {
      bd = d;
      tx = c.x + 3;
      ty = c.y + 5;
    }
  }
  const xi = Math.round(h.x),
    yi = Math.round(h.y),
    i = yi * W + xi,
    inAir = mat[i] === AIR && !bg[i];
  if (inAir) {
    // out in the open: it flies on and falls back
    a.vy += 0.07;
  } else {
    // under the earth: turn towards the prey (aim a little past it, so it breaks out above it)
    const dx = tx - h.x,
      dy = ty - 14 - h.y,
      d = Math.hypot(dx, dy) || 1,
      sp = 1.25;
    a.vx += ((dx / d) * sp - a.vx) * 0.035;
    a.vy += ((dy / d) * sp - a.vy) * 0.035;
    const v = Math.hypot(a.vx, a.vy) || 1;
    a.vx = (a.vx / v) * sp;
    a.vy = (a.vy / v) * sp;
  }
  a.vy = Math.max(-2.4, Math.min(2.4, a.vy));
  h.x = Math.max(8, Math.min(W - 8, h.x + a.vx));
  h.y = Math.max(8, Math.min(H - 6, h.y + a.vy));
  if (h.x <= 8 || h.x >= W - 8) a.vx = -a.vx;
  if (h.y >= H - 6) a.vy = -Math.abs(a.vy);
  bore(h.x, h.y);
  // the body follows, each plate at its distance from the one before
  for (let k = 1; k < s.length; k++) {
    const p = s[k - 1],
      q = s[k],
      dx = q.x - p.x,
      dy = q.y - p.y,
      d = Math.hypot(dx, dy);
    if (d > GAP) {
      q.x = p.x + (dx / d) * GAP;
      q.y = p.y + (dy / d) * GAP;
    }
  }
  a.x = h.x - 5;
  a.y = h.y - 5;
  a.face = a.vx >= 0 ? 1 : -1;
  if (G.frame % 40 === 0) {
    sfx(inAir ? 'growl' : 'digRock', h.x, h.y, 0.8);
    if (!inAir) quake(0.8);
  }
  // whoever the body touches is struck and thrown
  for (const c of crew) {
    if (c.dead || (c.wormCd || 0) > G.frame) continue;
    if (s.some(q => Math.abs(q.x - (c.x + 3)) < 6 && Math.abs(q.y - (c.y + 5)) < 7)) {
      c.wormCd = G.frame + 50;
      hurt(c, 14);
      startTumble(c, Math.sign(c.x + 3 - h.x || 1) * 2.4, -2);
    }
  }
  return a.hp > 0;
}
// the head bores a round hole (granite and planks stay), the walls of the tunnel stay behind it
function bore(x, y) {
  const x0 = Math.round(x),
    y0 = Math.round(y);
  let dug = 0;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const xx = x0 + dx,
        yy = y0 + dy;
      if (xx < 1 || xx >= W - 1 || yy < 1 || yy >= H - 1) continue;
      const j = yy * W + xx,
        m = mat[j];
      if (m === AIR || m === GRANITE || m === PLANK) continue;
      // (liquids flow into the tunnel by themselves)
      if (m === 5 || m === 7 || m === 8 || m === 14) continue;
      mat[j] = AIR;
      bg[j] = 1;
      paint(j);
      dug++;
    }
  if (dug) {
    activate(x0, y0);
    if (rnd() < 0.3 && parts.length < 1200)
      parts.push({ x: x0, y: y0, vx: (rnd() - 0.5) * 1.4, vy: -rnd(), l: 40, c: '#7d5230', b: 1, s: 2 });
  }
}

// ---- the picture ----
function drawWorms(ctx, cx, cy) {
  for (const a of animals) {
    if (a.kind !== 'worm' || !a.seg) continue;
    const s = a.seg;
    for (let k = s.length - 1; k >= 0; k--) {
      const x = Math.round(s[k].x - cx),
        y = Math.round(s[k].y - cy);
      if (x < -12 || x > G.VW + 12 || y < -12 || y > G.VH + 12) continue;
      const r = k === 0 ? 5 : k > s.length - 4 ? 3 + (s.length - k) * 0.4 : 4.5;
      // a dark outline, a plate in two shades, a light rim on top
      ctx.fillStyle = '#24160c';
      ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);
      ctx.fillStyle = a.hurt > 0 ? '#e8d0c0' : k % 2 ? '#7a4a5a' : '#8a5866';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = '#a87482';
      ctx.fillRect(x - r, y - r, r * 2, 1);
      ctx.fillStyle = '#5a3442';
      ctx.fillRect(x - r, y + r - 1, r * 2, 1);
      if (k === 0) {
        // the head: jaws towards where it goes, two eyes
        const f = a.face || 1;
        ctx.fillStyle = '#e8e0d0';
        ctx.fillRect(x + f * 5, y - 3, f, 2);
        ctx.fillRect(x + f * 5, y + 1, f, 2);
        ctx.fillStyle = '#ffcf4a';
        ctx.fillRect(x + f * 1, y - 3, 2, 2);
        ctx.fillRect(x + f * 1, y + 1, 2, 2);
      }
    }
  }
}
// the boss bar at the bottom of the screen while it lives (like Terraria's)
function drawBossBar(ctx) {
  const q = queenOf(),
    k = kingOf(),
    a = wormOf() || q || k;
  if (!a) return;
  const w = Math.round(Math.min(110, G.VW * 0.36)),
    x = Math.round((G.VW - w) / 2),
    y = G.VH - 12;
  ctx.fillStyle = 'rgba(20,12,6,0.75)';
  ctx.fillRect(x - 2, y - 9, w + 4, 14);
  ctx.fillStyle = '#5a3442';
  ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = '#e8504a';
  ctx.fillRect(x, y, Math.ceil((w * Math.max(0, a.hp)) / (a.maxHp || 900)), 3);
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fbf3dc';
  ctx.fillText(tr(a === q ? 'Lavakönigin' : a === k ? 'Eiskönig' : 'Riesenwurm'), x + w / 2, y - 2);
}

export { bossTick, drawBossBar, drawWorms, spawnWorm, wormOf, wormUpd };
