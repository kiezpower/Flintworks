// Fishing (like Terraria): with a fishing rod (bought at the castle, tools.js) a Wühler standing
// at water casts a float with the action button. After a while something bites – the float dips
// and a "!" shows; the action button again pulls it out: mostly a fish to sell, now and then gold,
// a gem, a stone or a few coins. Missed, it gets away and you wait again. Fish swimming close by
// bite sooner. Only the host (or a single game) decides; the float travels with the Wühler (sync).
import { addFloat } from './floats.js';
import { spawnItem } from './entities.js';
import { tr } from './i18n.js';
import { track } from './profile.js';
import { sfx } from './sound.js';
import { G, animals, crew } from './state.js';
import { hasTool } from './tools.js';
import { toast } from './ui.js';
import { AIR, W, WATER, free, mat, ri, rnd, surf } from './world.js';

const BITE = 55; // ticks to pull it out once it bites
// the water surface in front of a Wühler, within the line's reach (or null)
function waterAhead(c) {
  const f = c.face || 1;
  for (let d = 4; d <= 24; d++) {
    const x = Math.floor(c.x + 3 + f * d);
    if (x < 1 || x >= W - 1) break;
    for (let y = Math.floor(c.y + 6); y < c.y + 30; y++) {
      const m = mat[y * W + x];
      if (m === WATER && mat[(y - 1) * W + x] === AIR) return { x, y };
      if (m !== AIR) break;
    }
  }
  return null;
}
// what the action button offers: cast, or pull in
function fishContext(c) {
  if (c.fish) return { label: c.fish.bite > 0 ? 'Einholen!' : 'Einholen', fn: () => reel(c) };
  if (!hasTool('rod') || c.ride != null || c.tumble || free(c.x, c.y + 1, 6, 10)) return null;
  const s = waterAhead(c);
  if (!s) return null;
  return { label: 'Angeln', fn: () => cast(c, s) };
}
function cast(c, s) {
  c.fish = { x: s.x, y: s.y, t: wait(s), bite: 0 };
  sfx('throw', c.x, c.y, 0.6);
}
// fish close to the float make it bite sooner
function wait(s) {
  const near = animals.some(a => a.kind === 'fish' && a.hp > 0 && Math.abs(a.x - s.x) < 60 && Math.abs(a.y - s.y) < 30);
  return Math.round(ri(240, 600) * (near ? 0.45 : 1));
}
// what comes up at this spot: mostly a fish (like Terraria: water deep down holds pale cave fish
// worth more; now and then a goldfish), else a nugget, a gem, a stone or coins
function catchAt(x, y) {
  const r = rnd();
  const what = r < 0.72 ? 'fish' : r < 0.84 ? 'nug' : r < 0.88 ? 'gem' : r < 0.95 ? 'rock' : 'coins';
  if (what !== 'fish') return what;
  if (rnd() < 0.04) return 'goldfish';
  return y > surf[Math.max(0, Math.min(W - 1, x))] + 40 && rnd() < 0.6 ? 'cavefish' : 'fish';
}
function reel(c) {
  const f = c.fish;
  c.fish = null;
  if (!f || G.netClient) return;
  if (!(f.bite > 0)) {
    sfx('splash', f.x, f.y, 0.5);
    return;
  }
  // what comes up: mostly a fish
  const what = catchAt(f.x, f.y);
  const isFish = what === 'fish' || what === 'cavefish' || what === 'goldfish';
  if (what === 'coins') {
    const n = ri(15, 40);
    G.money += n;
    addFloat(c.x + 3, c.y - 4, `+${n} ${tr('Taler')}`, '#ffe066');
  } else {
    // it flies from the water to the Wühler
    const dx = c.x + 3 - f.x;
    spawnItem(what, f.x, f.y - 2, dx / 28, -2.2, 0);
  }
  if (isFish) track('fish');
  toast(what === 'goldfish' ? 'Ein Goldfisch!' : what === 'cavefish' ? 'Ein Höhlenfisch!' : what === 'fish' ? 'Ein Fisch!' : what === 'rock' ? 'Nur ein alter Stein …' : 'Ein Schatz am Haken!');
  sfx(isFish && what !== 'goldfish' ? 'splash' : 'coin', f.x, f.y);
}
// every tick (host): wait, bite, get away; moving or leaving the spot ends it
function updFishing() {
  if (G.netClient) return;
  for (const c of crew) {
    const f = c.fish;
    if (!f) continue;
    if (c.dead || c.tumble || Math.abs(c.vx) > 0.4 || c.ride != null || mat[f.y * W + f.x] !== WATER || Math.abs(c.x + 3 - f.x) > 30) {
      c.fish = null;
      continue;
    }
    if (f.bite > 0) {
      if (--f.bite <= 0) {
        f.t = wait(f);
        toast('Entwischt!');
      }
    } else if (--f.t <= 0) {
      f.bite = BITE;
      sfx('splash', f.x, f.y, 0.7);
    }
  }
}
// the line and the float (a dip and a "!" when something bites)
function drawFishing(ctx, cx, cy) {
  for (const c of crew) {
    const f = c.fish;
    if (!f || c.dead) continue;
    const rx = Math.round(c.x + 3 + (c.face || 1) * 5 - cx),
      ry = Math.round(c.y - 1 - cy),
      bx = Math.round(f.x - cx),
      by = Math.round(f.y - cy) + (f.bite > 0 ? 2 : Math.round(Math.sin(G.frame * 0.08) * 0.6));
    if (bx < -30 || bx > G.VW + 30) continue;
    // the rod (from the hand up and out), then the line in a slight sag
    const fd = c.face || 1;
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k < 2 ? '#5a3a22' : '#8b5e34';
      ctx.fillRect(rx - fd * 4 + fd * k, ry + 5 - k, 1, 1);
    }
    const tx = rx + fd * 2,
      ty = ry - 1;
    ctx.fillStyle = 'rgba(250,246,236,0.9)';
    const n = Math.max(6, Math.abs(bx - tx) + Math.abs(by - ty));
    for (let k = 0; k <= n; k++) {
      const t = k / n,
        x = tx + (bx - tx) * t,
        y = ty + (by - 1 - ty) * t + Math.sin(t * Math.PI) * 3;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.fillStyle = '#e8504a';
    ctx.fillRect(bx - 1, by - 2, 2, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx - 1, by - 1, 2, 1);
    if (f.bite > 0) {
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(Math.round(c.x + 3 - cx), Math.round(c.y - 9 - cy), 1, 4);
      ctx.fillRect(Math.round(c.x + 3 - cx), Math.round(c.y - 4 - cy), 1, 1);
    }
  }
}

export { catchAt, drawFishing, fishContext, updFishing, waterAhead };
