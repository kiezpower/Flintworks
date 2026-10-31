// Getting out of a pit or a cave without knowing the tricks: a ledge too high for a jump is
// found by itself (climbOut). In the modern controls the Wühler then digs a ramp up through
// earth on his own (clonk.js wantsDig); where that does not work the action button offers the
// way out: wooden stairs up to the ledge (1 plank or 1 wood), else "home" (back to the base,
// like the menu). The grappling hook, once bought, has a button of its own (hook, key G): it
// shoots at the nearest ledge above, also a low one and also from the air.
import { hasRes, payRes } from './buildings.js';
import { register } from './commands.js';
import { sfx } from './sound.js';
import { G } from './state.js';
import { hasTool } from './tools.js';
import { toast } from './ui.js';
import { H, PLANK, W, boxFree, free } from './world.js';

// how high a jump lifts the feet onto a ledge (vy -2.55 against gravity 0.17, with a margin)
const JUMP = 17;
// the grappling hook takes ledges from this height on (lower ones are a step)
const HOOK_MIN = 8;
// how far to look for a ledge, sideways and up
const REACH_X = 64,
  REACH_Y = 72;
// the grappling hook: how far it flies, how fast it flies and pulls (px per frame)
const HOOK_RANGE = 90,
  HOOK_FLY = 8,
  HOOK_PULL = 3;
// stairs: from the gentle menu stairs (0.62) up to as steep as can still be walked
const STAIR_MIN = 0.62,
  STAIR_MAX = 2;

const solidAt = (x, y) => x < 0 || x >= W || y < 0 || (y < H && !boxFree(x, y, 1, 1));
const feetOf = c => Math.floor(c.y + 10);

// the lowest place to stand in column x that is higher than minH: its top row, or null when the
// column has a lower step (no ledge there), undefined when nothing is within reach
function columnTop(x, feet, minH) {
  for (let y = feet - 3; y >= feet - REACH_Y; y--) {
    if (!solidAt(x, y)) continue;
    // a solid cell with room for the Wühler above it: a place to stand
    if (solidAt(x, y - 1)) continue;
    let room = true;
    for (let k = 1; k <= 10 && room; k++) if (solidAt(x, y - k)) room = false;
    if (!room) continue;
    return feet - y <= minH ? null : y;
  }
  return undefined; // nothing in this column (air or a wall without a top in reach)
}
// a ledge in one direction higher than minH (default: what a jump reaches):
// { dir, col, top, dist, wall } or null
function ledgeIn(c, dir, minH = JUMP) {
  const feet = feetOf(c),
    x0 = Math.floor(c.x + 3);
  for (let d = 4; d <= REACH_X; d++) {
    const x = x0 + dir * d;
    // the floor goes on at foot level: keep looking further along it
    const t = columnTop(x, feet, minH);
    if (t === null) return null; // a step a jump reaches: not stuck this way
    if (t === undefined) {
      // a wall without a reachable top ends the search
      if (solidAt(x, feet - 5) && solidAt(x, feet - minH - 2)) return null;
      continue;
    }
    // the way up must be open over the Wühler (no ceiling between him and the ledge's height)
    if (!free(c.x, t - 10, 6, Math.max(1, Math.floor(c.y) - (t - 10)))) return null;
    return { dir, col: x, top: t, dist: d, wall: solidAt(x, feet - 5) };
  }
  return null;
}
// the ledge to get out by (facing direction first), checked once per frame per Wühler
function climbOut(c) {
  if (c.climbF === G.frame) return c.climbO;
  c.climbF = G.frame;
  c.climbO = null;
  if (c.dead || c.ride != null || c.climb || c.hangle || c.bridge || c.hook || c.tumble) return null;
  if (free(c.x, c.y + 1, 6, 10)) return null; // only standing on the ground
  const a = ledgeIn(c, c.face),
    b = ledgeIn(c, -c.face);
  return (c.climbO = a || b);
}

// ---- stairs up to the ledge ----
// the stairs start at the feet and end at the ledge; too steep this way: try the other ledge
function stairPlan(c) {
  for (const dir of [c.face, -c.face]) {
    const L = ledgeIn(c, dir);
    if (!L) continue;
    const h = feetOf(c) - L.top + 1,
      run = Math.max(4, L.dist - 4),
      slope = Math.max(STAIR_MIN, h / run);
    if (slope <= STAIR_MAX) return { dir, slope, run: Math.ceil(h / slope) };
  }
  return null;
}
const stairCost = c => (hasRes(c, { plank: 1 }) ? { plank: 1 } : { wood: 1 });
// wooden stairs (the build menu's, and the action's up to a ledge: dir and slope given)
function buildStairs(c, plan) {
  const cost = stairCost(c);
  if (!hasRes(c, cost)) return toast('Treppe braucht 1 Brett oder 1 Holz');
  if (c.climb || c.hangle || c.tumble || c.bridge) return;
  payRes(c, cost);
  if (plan) c.face = plan.dir;
  const dy = plan ? -plan.slope : -STAIR_MIN,
    len = plan ? Math.min(140, Math.ceil(plan.run * 2) + 4) : 70;
  c.bridge = { n: 0, x0: c.x + 3 + c.face * 4, y0: c.y + 10, dy, m: PLANK, len, th: 2 };
  sfx('hammer');
}

// ---- home ----
function goHome(c) {
  if (c.dead) return;
  Object.assign(c, { x: G.base.x + 10, y: G.base.gy - 10, vx: 0, vy: 0, climb: false, hangle: false, tumble: false });
  c.hook = null;
}

// ---- the grappling hook ----
// where the hook would go now: the nearest ledge above in reach (facing direction first), or
// null; checked once per frame per Wühler (the button is dimmed without one, ui.js)
function hookTarget(c) {
  if (c.hookF === G.frame) return c.hookO;
  c.hookF = G.frame;
  c.hookO = null;
  if (!hasTool('hook') || c.dead || c.ride != null || c.tumble || c.hook || c.bridge) return null;
  for (const dir of [c.face, -c.face]) {
    const L = ledgeIn(c, dir, HOOK_MIN);
    if (L && Math.hypot(L.col - (c.x + 3), feetOf(c) - L.top) <= HOOK_RANGE) return (c.hookO = L);
  }
  return null;
}
// the hook button (sent as a command: on the host for the player who pressed it)
function fireHook(c) {
  if (!hasTool('hook') || c.hook) return;
  const L = hookTarget(c);
  if (!L) return toast('Keine Kante in Reichweite');
  c.climb = c.hangle = false;
  startHook(c, L);
}
register('hook', fireHook);
// fly: the hook goes from the hand to the ledge; pull: the Wühler goes up under it, then over
function startHook(c, L) {
  const ax = L.col + (L.dir > 0 ? 1 : 0),
    ay = L.top;
  c.face = L.dir;
  c.hook = { ax, ay, t: 0, ph: 'fly', tx: L.dir > 0 ? L.col : L.col - 5, ty: L.top - 10 };
  sfx('throw', c.x, c.y);
}
// one frame of the hook; true while it moves the Wühler (the rest of the update is skipped)
function updHook(c, I) {
  const k = c.hook;
  if (!k) return false;
  // a jump or pushing back lets go
  if (I.jumpP || (Math.abs(I.ax) > 0.5 && Math.sign(I.ax) !== c.face) || c.dead || c.tumble) {
    c.hook = null;
    return false;
  }
  c.vx = c.vy = 0;
  c.anim += 0.2;
  if (k.ph === 'fly') {
    if (++k.t >= HOOK_FLY) {
      k.ph = 'up';
      sfx('hammer', k.ax, k.ay);
    }
    return true;
  }
  if (k.ph === 'up') {
    const ny = Math.max(k.ty - 1, c.y - HOOK_PULL);
    if (!free(c.x, ny, 6, 10)) return (c.hook = null), false;
    c.y = ny;
    if (c.y <= k.ty - 1) k.ph = 'over';
    return true;
  }
  // over the edge onto the ledge
  const dx = Math.sign(k.tx - c.x),
    nx = Math.abs(k.tx - c.x) <= 2 ? k.tx : c.x + dx * 2;
  if (!free(nx, c.y, 6, 10)) return (c.hook = null), false;
  c.x = nx;
  if (nx === k.tx) c.hook = null;
  return true;
}

// the rope from the hand to the hook (while flying: as far as it got), and the hook itself
// (c.hook on the host, c.hookV on the other devices, net/sync.js); x, y: the Wühler on screen
function drawHook(ctx, c, x, y, cx, cy) {
  const k = c.hook || c.hookV;
  if (!k) return;
  const hx = x + 3 + c.face * 2,
    hy = y + 4,
    f = Math.min(1, k.t / HOOK_FLY),
    ex = hx + (k.ax - cx - hx) * f,
    ey = hy + (k.ay - cy - hy) * f,
    n = Math.max(1, Math.round(Math.hypot(ex - hx, ey - hy)));
  ctx.fillStyle = '#c9a46a';
  for (let s = 0; s <= n; s++) ctx.fillRect(Math.round(hx + ((ex - hx) * s) / n), Math.round(hy + ((ey - hy) * s) / n), 1, 1);
  ctx.fillStyle = '#9aa4ae';
  ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 2);
  ctx.fillStyle = '#d4dbe2';
  ctx.fillRect(Math.round(ex), Math.round(ey) - 1, 1, 1);
}

// ---- the action button ----
// (after vehicles, sword, base, chests, lorries and trees; before bridge and build)
function climbContext(c) {
  const L = climbOut(c);
  if (!L) return null;
  // modern controls dig a ramp through earth by themselves (clonk.js wantsDig)
  if (G.autoDig && L.wall && digWall(c, L)) return null;
  const plan = stairPlan(c);
  if (plan && hasRes(c, stairCost(c))) return { label: 'Treppe', fn: () => buildStairs(c, plan) };
  return {
    label: 'Heim',
    fn: () => {
      goHome(c);
      toast('{name} ist zurück in der Basis', { name: c.name });
    },
  };
}
// can the wall up to this ledge be dug? (set by clonk.js: diggable() needs the steel pick for rock)
let canDig = () => false;
const setDigTest = fn => (canDig = fn);
function digWall(c, L) {
  const feet = feetOf(c);
  for (let y = feet - 8; y > L.top; y -= 4) if (solidAt(L.col, y) && !canDig(L.col, y)) return false;
  return true;
}
// should the Wühler dig up at a slant here? (a pit or cave below the surface, an earth wall in
// the way that is too high for a jump, the top of it in reach)
function rampHere(c, dir) {
  const L = climbOut(c);
  return !!L && L.dir === dir && L.wall && digWall(c, L) ? L : null;
}

export { HOOK_FLY, buildStairs, climbContext, climbOut, drawHook, fireHook, goHome, hookTarget, rampHere, setDigTest, updHook };
