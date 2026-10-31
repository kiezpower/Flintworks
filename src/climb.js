// Getting out of a pit or a cave without knowing the tricks: a ledge too high for a jump is
// found by itself (climbOut). In the modern controls the Wühler then digs a ramp up through
// earth on his own (clonk.js wantsDig); where that does not work the action button offers the
// way out: wooden stairs up to the ledge (1 plank or 1 wood), else "home" (back to the base,
// like the menu). The grappling hook, once bought, has a button of its own (hook, key G): it is
// thrown wherever the stick points (without a direction at the nearest ledge above, else up and
// forward); what it hits it pulls the Wühler to, and when it hits nothing the rope comes back.
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
// the grappling hook: how far it is aimed at a ledge, how many frames that throw takes, how far
// and fast a free throw flies, how fast the rope comes back and pulls (px per frame)
const HOOK_RANGE = 90,
  HOOK_FLY = 8,
  HOOK_REACH = 100,
  HOOK_SPEED = 6,
  HOOK_BACK = 8,
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
// where the hook goes without a direction: the nearest ledge above in reach (facing direction
// first), or null; checked once per frame per Wühler
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
const handOf = c => [c.x + 3 + c.face * 2, c.y + 4];
// the hook button (sent as a command with the stick's direction: on the host for the player who
// pressed it). Always thrown: aimed with the stick, else at a ledge, else up and forward
function fireHook(c, { ax = 0, ay = 0 } = {}) {
  if (!hasTool('hook') || c.hook || c.dead || c.ride != null || c.tumble || c.bridge) return;
  const aimed = Math.hypot(ax, ay) > 0.3;
  c.climb = c.hangle = false;
  if (!aimed) {
    const L = hookTarget(c);
    if (L) return startHook(c, L);
  }
  let dx = c.face * 0.64,
    dy = -0.77; // 50° up and forward
  if (aimed) {
    const m = Math.hypot(ax, ay);
    dx = ax / m;
    dy = ay / m;
    if (Math.abs(dx) > 0.2) c.face = Math.sign(dx);
  }
  const [hx, hy] = handOf(c);
  c.hook = { ph: 'fly', hx, hy, dx, dy, d: 0 };
  sfx('throw', c.x, c.y);
}
register('hook', fireHook);
// at a ledge found by itself: the hook flies there (lfly), then pulls the Wühler up under it and
// over the edge (the safe way up out of a pit)
function startHook(c, L) {
  const ax = L.col + (L.dir > 0 ? 1 : 0),
    ay = L.top;
  c.face = L.dir;
  const [hx, hy] = handOf(c);
  c.hook = { ax, ay, hx, hy, t: 0, ph: 'lfly', tx: L.dir > 0 ? L.col : L.col - 5, ty: L.top - 10 };
  sfx('throw', c.x, c.y);
}
// a place to stand right at the anchor (on the ledge it caught, or just below it): the body's
// top-left, or null
function standNear(ax, ay) {
  for (let y = Math.floor(ay) + 3; y >= ay - 12; y--)
    for (const o of [0, -4, 4, -8, 8]) {
      const x = Math.round(ax - 3 + o);
      if (free(x, y - 10, 6, 10) && !free(x, y - 9, 6, 10)) return { x, y: y - 10 };
    }
  return null;
}
// one frame of the hook; true while it moves the Wühler (the rest of the update is skipped)
function updHook(c, I) {
  const k = c.hook;
  if (!k) return false;
  if (c.dead || c.tumble) return (c.hook = null), false;
  // a free throw: the hook flies on in a straight line while the Wühler moves as usual
  if (k.ph === 'fly') {
    for (let s = 0; s < HOOK_SPEED; s++) {
      const nx = k.hx + k.dx,
        ny = k.hy + k.dy;
      if (solidAt(Math.floor(nx), Math.floor(ny))) {
        // caught: it holds at the last free point and starts to pull
        Object.assign(k, { ph: 'pull', ax: k.hx, ay: k.hy });
        sfx('hammer', k.hx, k.hy);
        return false;
      }
      k.hx = nx;
      k.hy = ny;
      if (++k.d >= HOOK_REACH) return (k.ph = 'back'), false;
    }
    return false;
  }
  // nothing caught: the rope comes back to the hand
  if (k.ph === 'back') {
    const [hx, hy] = handOf(c),
      ex = hx - k.hx,
      ey = hy - k.hy,
      d = Math.hypot(ex, ey);
    if (d <= HOOK_BACK) return (c.hook = null), false;
    k.hx += (ex / d) * HOOK_BACK;
    k.hy += (ey / d) * HOOK_BACK;
    return false;
  }
  // while it pulls, a jump or pushing back lets go
  if (I.jumpP || (Math.abs(I.ax) > 0.5 && Math.sign(I.ax) !== c.face)) return (c.hook = null), false;
  c.vx = c.vy = 0;
  c.anim += 0.2;
  if (k.ph === 'lfly') {
    const [hx, hy] = handOf(c),
      f = Math.min(1, ++k.t / HOOK_FLY);
    k.hx = hx + (k.ax - hx) * f;
    k.hy = hy + (k.ay - hy) * f;
    if (f >= 1) {
      k.ph = 'up';
      sfx('hammer', k.ax, k.ay);
    }
    return true;
  }
  if (k.ph === 'pull') {
    // the hand goes to the anchor; blocked on the way: slide along, else arrive where it is
    const ex = k.ax - 3 - c.x,
      ey = k.ay - 4 - c.y,
      d = Math.hypot(ex, ey),
      sx = d ? (ex / d) * HOOK_PULL : 0,
      sy = d ? (ey / d) * HOOK_PULL : 0;
    if (d > HOOK_PULL) {
      if (free(c.x + sx, c.y + sy, 6, 10)) return (c.x += sx), (c.y += sy), true;
      if (Math.abs(sx) > 0.3 && free(c.x + sx, c.y, 6, 10)) return (c.x += sx), true;
      if (Math.abs(sy) > 0.3 && free(c.x, c.y + sy, 6, 10)) return (c.y += sy), true;
    }
    // there: onto a place to stand by the anchor, or let go with the swing of the pull
    const st = standNear(k.ax, k.ay);
    if (st && Math.hypot(st.x - c.x, st.y - c.y) <= 16) return Object.assign(k, { ph: 'step', tx: st.x, ty: st.y }), true;
    c.hook = null;
    c.vx = sx * 0.6;
    c.vy = sy * 0.6;
    return false;
  }
  if (k.ph === 'step') {
    // the last pixels onto the ledge (a short climb over its edge)
    const ex = k.tx - c.x,
      ey = k.ty - c.y,
      d = Math.hypot(ex, ey);
    if (d <= 2) {
      c.x = k.tx;
      c.y = k.ty;
      c.hook = null;
      return true;
    }
    c.x += (ex / d) * 2;
    c.y += (ey / d) * 2;
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

// the rope from the hand to the hook's head, and the hook itself (c.hook on the host, c.hookV
// on the other devices, net/sync.js); x, y: the Wühler on screen, cx, cy: the camera
function drawHook(ctx, c, x, y, cx, cy) {
  const k = c.hook || c.hookV;
  if (!k) return;
  const hx = x + 3 + c.face * 2,
    hy = y + 4,
    ex = k.hx - cx,
    ey = k.hy - cy,
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

export { buildStairs, climbContext, climbOut, drawHook, fireHook, goHome, hookTarget, rampHere, setDigTest, updHook };
