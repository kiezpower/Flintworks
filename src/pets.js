// A Fluffel as a companion (like the pets of Terraria and the ore sense of SteamWorld Dig): a
// Wühler with bread or a fish in the bag can feed a Fluffel close by, and from then on it
// follows him. Where gold or a gem lies close to it under the ground it sniffs it out: a small
// sparkle shows the spot. One per player; it keeps up (and jumps after him to where he is when
// left far behind), does not run away from him any more and stays with the world when saved.
// Only the host moves and sniffs; the others get the pet and the spot with the animals.
import { announce } from './announce.js';
import { addFloat } from './floats.js';
import { track } from './profile.js';
import { sfx } from './sound.js';
import { G, animals, crew, parts } from './state.js';
import { GEM, GOLD, H, W, free, mat, rnd } from './world.js';

const FOOD = ['bread', 'fish', 'cavefish'];
const SNIFF = 40; // how far it smells (pixels around it)
const petOf = c => animals.find(a => a.kind === 'fluffel' && a.pet === c.pid && a.hp > 0) || null;

// the action button next to a Fluffel, with food in the bag
function petContext(c) {
  if (c.pid == null || G.tut || petOf(c)) return null;
  const food = c.inv.findIndex(t => FOOD.includes(t));
  if (food < 0) return null;
  const a = animals.find(
    a => a.kind === 'fluffel' && a.hp > 0 && !a.lost && a.pet == null && Math.abs(a.x - c.x) < 16 && Math.abs(a.y - c.y) < 12,
  );
  if (!a) return null;
  return { label: 'Füttern', fn: () => tame(c, a) };
}
function tame(c, a) {
  const k = c.inv.findIndex(t => FOOD.includes(t));
  if (k < 0 || a.pet != null) return;
  c.inv.splice(k, 1);
  if (c.isel >= c.inv.length) c.isel = Math.max(0, c.inv.length - 1);
  a.pet = c.pid;
  a.scared = 0;
  addFloat(a.x + 2, a.y - 4, '♥', '#ff7a8a');
  sfx('coin', a.x, a.y, 0.5);
  announce('{name} hat jetzt einen Fluffel als Begleiter. Er erschnüffelt Gold und Edelsteine.', { name: c.name });
  track('pet');
}

// every tick (host), instead of its own wandering: after its Wühler. Returns false when it has
// nobody to follow (then it is a wild Fluffel again)
function petFollow(a, onG) {
  const c = crew.find(c => c.pid === a.pet);
  if (!c) {
    a.pet = null;
    a.sn = null;
    return false;
  }
  const dx = c.x + 3 - (a.x + a.w / 2),
    dy = c.y + 10 - (a.y + a.h);
  // stuck behind a wall while he is a little way off: counted, and after a second and a half it
  // catches up like from far behind
  a.stuck = !c.dead && Math.abs(dx) > 40 && Math.abs(a.vx) < 0.15 ? (a.stuck || 0) + 1 : 0;
  // far behind (a cave, the hook, a ride), or stuck: it turns up next to him
  if (!c.dead && (Math.abs(dx) > 220 || Math.abs(dy) > 90 || a.stuck > 90)) {
    // (beside him, behind or in front, a little higher on a slope)
    const spot = spotBeside(c, a);
    if (spot) {
      puff(a);
      Object.assign(a, { x: spot[0], y: spot[1], vx: 0, vy: 0, stuck: 0 });
      puff(a);
      return true;
    }
  }
  const s = Math.sign(dx),
    tvx = c.dead || Math.abs(dx) < 12 ? 0 : s * Math.min(1.4, 0.4 + Math.abs(dx) / 24);
  a.vx += (tvx - a.vx) * 0.25;
  if (tvx) a.face = s;
  // a step or a wall ahead, or its Wühler higher up: a hop
  if (onG && tvx && (!free(a.x + s * 2, a.y - 1, a.w, a.h) || dy < -14) && rnd() < 0.2) a.vy = -2.4;
  if (G.frame % 45 === 0) sniff(a);
  return true;
}
function spotBeside(c, a) {
  for (let dy = 0; dy <= 8; dy++)
    for (const ox of [-6, 6, -2, 2]) {
      const x = c.x + ox,
        y = c.y + 10 - a.h - dy;
      if (free(x, y, a.w, a.h)) return [x, y];
    }
  return null;
}
function puff(a) {
  for (let q = 0; q < 8; q++)
    parts.push({ x: a.x + a.w / 2, y: a.y + a.h / 2, vx: (rnd() - 0.5) * 1.4, vy: -rnd(), l: 22, c: '#f2e6d0' });
}
// the nearest gold or gem around it, or nothing
function sniff(a) {
  const cx = Math.round(a.x + a.w / 2),
    cy = Math.round(a.y + a.h / 2);
  let best = null,
    bd = SNIFF * SNIFF + 1;
  for (let y = Math.max(0, cy - SNIFF); y <= Math.min(H - 1, cy + SNIFF); y += 2)
    for (let x = Math.max(0, cx - SNIFF); x <= Math.min(W - 1, cx + SNIFF); x += 2) {
      const m = mat[y * W + x];
      if (m !== GOLD && m !== GEM) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = [x, y];
      }
    }
  if (best && (!a.sn || a.sn[0] !== best[0] || a.sn[1] !== best[1])) {
    // (a new find: it perks up)
    a.vy = a.vy || -1.6;
    sfx('ting', a.x, a.y, 0.25);
  }
  a.sn = best;
}

// the picture: a twinkle where it smells treasure (while it is still there)
function drawPets(ctx, cx, cy) {
  for (const a of animals) {
    if (a.kind !== 'fluffel' || a.pet == null || !a.sn) continue;
    const [x, y] = a.sn,
      m = mat[y * W + x];
    if (m !== GOLD && m !== GEM) continue;
    const t = (G.frame % 40) / 40,
      r = 2 + Math.round(Math.sin(t * Math.PI) * 2),
      px = Math.round(x - cx),
      py = Math.round(y - cy);
    if (px < -6 || py < -6 || px > G.VW + 6 || py > G.VH + 6) continue;
    ctx.fillStyle = m === GEM ? 'rgba(170,230,255,0.9)' : 'rgba(255,236,140,0.9)';
    ctx.fillRect(px - r, py, r * 2 + 1, 1);
    ctx.fillRect(px, py - r, 1, r * 2 + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(px - 1, py - 1, 3, 3);
  }
}

export { drawPets, petContext, petFollow, petOf };
