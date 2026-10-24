// The Wühler you are not controlling work on their own. Each one picks a job, finds a way
// there with A* (walking, jumping onto ledges, dropping down, digging where mining) and does it:
//   deliver  – full pockets: carry everything home to the base
//   build    – help on a building site
//   collect  – pick up loose items (also the ones a mining helper just dug free)
//   chop     – fell trees when the store runs low on wood
//   mine     – dig out gold, ore, coal and gems close to the surface
//   follow   – stay with your own Wühler
//   rest     – nothing to do: wait in the base
// Each helper has a focus the player sets in the crew panel (all, ore, wood, build, follow,
// stay); a marker sends the miners to a chosen spot. Miners put up support beams as they dig.
import { NOIN, diggable, nearTree } from './clonk.js';
import { midMat } from './entities.js';
import { jobBubble, tryBeam } from './mine.js';
import { clonkOf, isPlayer } from './players.js';
import { DIG, JUMP, mkNav } from './pathfind.js';
import { ITEM } from './sprites.js';
import { stock } from './store.js';
import { G, INV_MAX, builds, crew, items, parts, trees } from './state.js';
import { COAL, GEM, GOLD, H, LIQ, ORE, SOLID, W, WATER, free, mat, rnd, surf } from './world.js';

const TOOLS = ['flint', 'tnt', 'loam'];
// everything the base takes in (so a helper never walks home for nothing)
const cargo = c => c.inv.filter(t => ITEM[t]).length;
const RICH = new Set([GOLD, ORE, COAL, GEM]);

const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || SOLID[mat[y * W + x]] === 1;
// keep away from lava, acid and deep water
const bad = (x, y) => {
  const a = mat[Math.min(H - 1, y + 2) * W + Math.min(W - 1, x + 3)],
    b = mat[Math.min(H - 1, y + 8) * W + Math.min(W - 1, x + 3)];
  return LIQ[a] || (LIQ[b] && b !== WATER);
};
// never dig under or close to a building: it would lose its ground or become unreachable
const nearBuild = (x, y) =>
  builds.some(
    b => x > b.x - 24 && x < b.x + b.w + 24 && y > b.gy - b.h - 4 && y < b.gy + (b.type === 'base' ? 30 : 18),
  );
const digOk = (x, y) => y < H - 4 && diggable(mat[y * W + x]) && !nearBuild(x, y);
const nav = mkNav({ solid, bad, maxDrop: 36, jumpH: 15, maxNodes: 2500, budget: 5 });
const navDig = mkNav({ solid, bad, dig: digOk, digCost: 0.12, maxDrop: 36, jumpH: 15, maxNodes: 2500, budget: 6 });

// blacklist for things a helper could not reach (item, tree or ore spot → frame)
const noWay = new WeakMap();
const tooHard = new Map();
const blocked = ref => (typeof ref === 'object' ? noWay.get(ref) : tooHard.get(ref)) > G.frame;
function block(ref) {
  if (ref == null) return;
  if (typeof ref === 'object') noWay.set(ref, G.frame + 900);
  else tooHard.set(ref, G.frame + 1800);
}
const takenBy = (c, ref) => crew.some(o => o !== c && !o.dead && o.job && o.job.ref === ref);
// the player a helper follows (whoever gave the order; else your own Wühler)
const leader = c => clonkOf(c.followPid ?? G.myId) || crew.find(isPlayer) || c;
const baseX = () => G.base.x + G.base.w / 2;
// helpers work within reach of the base
const far = x => Math.abs(x - baseX()) > 560;

// ---- choosing a job ----
function nearestItem(c, only) {
  let best = null,
    bd = 420;
  for (const it of items) {
    if (only && it.t !== only) continue;
    if (it.t === 'rock' && stock('rock') >= 20) continue; // enough stones in the store
    if (it.pd > 0 || it.fuse >= 0 || TOOLS.includes(it.t) || far(it.x) || blocked(it) || takenBy(c, it)) continue;
    const d = Math.abs(it.x - c.x) + Math.abs(it.y - c.y) * 1.5;
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  return best;
}
function nearestTree(c) {
  let best = null,
    bd = 520;
  for (const t of trees) {
    if (t.fall || t.burn || t.stage < 2 || far(t.x) || blocked(t) || takenBy(c, t)) continue;
    const d = Math.abs(t.x - c.x) + Math.abs(t.gy - c.y - 10) * 2;
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}
// a rich cell not too deep under the surface, nearest to the helper first
// (with a mining marker: around the marker, also further away from the base)
function nearestOre(c) {
  // first close to the surface, then deeper down once that is used up
  return oreScan(c, 130) || (!G.mineMark && oreScan(c, 240));
}
function oreScan(c, depth) {
  const m = G.mineMark;
  const cx = Math.floor(m ? m.x : c.x + 3);
  for (let r = 0; r < (m ? 90 : 560); r += 3)
    for (const x of r ? [cx - r, cx + r] : [cx]) {
      if (x < 4 || x >= W - 10 || (!m && far(x))) continue;
      const top = m ? Math.max(surf[x], m.y - 50) : surf[x];
      for (let y = top + 2; y < Math.min(H - 6, m ? m.y + 70 : top + depth); y += 2) {
        if (!RICH.has(mat[y * W + x]) || nearBuild(x, y)) continue;
        const key = ((x / 24) | 0) * 1000 + ((y / 24) | 0); // coarse: a failed spot blocks its surroundings
        if (blocked(key) || takenBy(c, key)) continue;
        return { x, y, key };
      }
    }
  return null;
}
function pickJob(c, n) {
  const f = c.focus || 'all';
  if (f === 'stay') return { type: 'rest', ref: 'rest' + n };
  if (f === 'follow') return { type: 'follow', ref: 'follow' + n };
  const full = c.inv.length >= INV_MAX || cargo(c) >= 4;
  // hurt: go home and recover first (the base heals)
  if (c.energy < 50) return { type: cargo(c) ? 'deliver' : 'rest', ref: 'base' + n };
  if (full || (cargo(c) > 0 && !items.length)) return { type: 'deliver', ref: 'base' + n };
  if (f === 'all' || f === 'build') {
    const site = builds.find(b => !b.done && crew.filter(o => o.job && o.job.ref === b).length < 2 && !blocked(b));
    if (site) return { type: 'build', ref: site };
  }
  const it = nearestItem(c, f === 'wood' ? 'wood' : null);
  if (it) return { type: 'collect', ref: it };
  if (cargo(c) > 0) return { type: 'deliver', ref: 'base' + n };
  if (f === 'wood' || (f === 'all' && stock('wood') + stock('plank') / 3 < 8)) {
    const t = nearestTree(c);
    if (t) return { type: 'chop', ref: t };
  }
  if (f === 'all' || f === 'ore') {
    const ore = nearestOre(c);
    if (ore) return { type: 'mine', ref: ore.key, x: ore.x, y: ore.y };
  }
  // nothing else to do: stock up on wood
  const t2 = f === 'all' && stock('wood') < 20 && nearestTree(c);
  if (t2) return { type: 'chop', ref: t2 };
  return { type: 'rest', ref: 'rest' + n };
}

// where the job takes place: goal test and heuristic for the path search
function target(c, n) {
  const j = c.job;
  if (j.type === 'deliver' || j.type === 'rest') {
    const x = G.base.x + 6 + ((n * 11) % Math.max(4, G.base.w - 12));
    return {
      x,
      y: G.base.gy - 10,
      r: j.type === 'deliver' ? G.base.w / 2 - 4 : 3,
      cx: j.type === 'deliver' ? baseX() : x,
    };
  }
  if (j.type === 'follow') {
    const me = leader(c);
    j.gx = me.x;
    j.gy = me.y;
    return { x: me.x, y: me.y, r: 14, ry: 10 };
  }
  if (j.type === 'build') return { x: j.ref.x + j.ref.w / 2 - 3, y: j.ref.gy - 10, r: j.ref.w / 2 - 5 };
  if (j.type === 'collect') return { x: j.ref.x - 2, y: j.ref.y - 6, r: 3, ry: 8 };
  if (j.type === 'chop') return { x: j.ref.x - 3, y: j.ref.gy - 10, r: 6 };
  return { x: j.x - 3, y: j.y - 6, r: 5, ry: 7 };
}
// the searches for a job, tried one after the other; they run in slices over several frames
function planStages(c, n) {
  const T = target(c, n);
  const cx = T.cx !== undefined ? T.cx - 3 : T.x;
  const goal = (x, y) => Math.abs(x - cx) <= T.r && Math.abs(y - T.y) <= (T.ry || 4);
  // weighted A*: a little longer paths, but far fewer nodes searched
  const k = c.job.type === 'mine' ? 3 : 2;
  const heur = (x, y) => (Math.abs(x - cx) + Math.abs(y - T.y)) * k;
  const x = c.x,
    y = c.y;
  // walk if possible; otherwise dig a way (also out of a pit after mining)
  const st = [];
  if (c.job.type !== 'mine') st.push(() => nav.start(x, y, goal, heur, 6000));
  st.push(() => navDig.start(x, y, goal, heur, 12000));
  if (c.job.type === 'mine') {
    // far away ore: first walk over to it, then plan the digging from there
    const near = (a, b) => Math.abs(a - cx) <= 10 && b <= T.y + 4;
    st.push(() => {
      c.job.approach = true;
      return nav.start(x, y, near, (a, b) => Math.abs(a - cx) * 2 + Math.max(0, b - T.y), 6000);
    });
  }
  return st;
}
// run the planning a slice at a time; all helpers share a few milliseconds per frame
function plan(c, n) {
  if (G.pfFrame !== G.frame) {
    G.pfFrame = G.frame;
    G.pfLeft = 5;
  }
  if (G.pfLeft <= 0.3) return undefined;
  if (!c.plan) c.plan = { stages: planStages(c, n), cur: null };
  const P = c.plan;
  const t0 = performance.now();
  let r;
  while (G.pfLeft - (performance.now() - t0) > 0.3) {
    if (!P.cur) {
      if (!P.stages.length) {
        r = null;
        break;
      }
      P.cur = P.stages.shift()();
    }
    r = P.cur.step(G.pfLeft - (performance.now() - t0));
    if (r === undefined) break;
    if (r && (r.length || c.job.type !== 'mine' || !c.job.approach)) break;
    P.cur = null;
    r = undefined;
  }
  G.pfLeft -= performance.now() - t0;
  if (r !== undefined) c.plan = null;
  return r;
}

function warpHome(c, n) {
  const puff = (x, y) => {
    for (let k = 0; k < 10; k++)
      parts.push({ x: x + 3, y: y + 5, vx: (rnd() - 0.5) * 1.4, vy: -rnd() * 1.2, l: 25, c: '#d8ccb4', g: -0.01 });
  };
  puff(c.x, c.y);
  c.x = G.base.x + 6 + ((n * 7) % Math.max(4, G.base.w - 12));
  c.y = G.base.gy - 11;
  c.vx = c.vy = 0;
  c.lost = 0;
  puff(c.x, c.y);
}

// ---- following the path ----
function follow(c, I) {
  const p = c.path;
  while (c.pi < p.length) {
    const nd = p[c.pi],
      from = c.pi ? p[c.pi - 1] : { x: Math.round(c.x), y: Math.round(c.y) };
    const dir = Math.sign(nd.x - from.x) || 1;
    const dy = nd.y - c.y;
    const passed = (nd.x - c.x) * dir <= 1.2;
    if (passed && Math.abs(dy) <= (nd.a === DIG ? 6 : 5)) {
      c.pi++;
      c.pt = G.frame;
    } else break;
  }
  if (c.pi >= p.length) return true;
  const nd = p[c.pi];
  const dx = nd.x - c.x,
    dy = nd.y - c.y;
  const grounded = !free(c.x, c.y + 1, 6, 10);
  I.ax = Math.abs(dx) > 1 ? Math.sign(dx) : 0;
  if (nd.a === JUMP && dy < -3 && grounded && Math.abs(dx) <= 10 && G.frame - (c.jumpT || 0) > 25) {
    I.jumpP = true;
    c.jumpT = G.frame;
  }
  if (nd.a === DIG) {
    const from = c.pi ? p[c.pi - 1] : nd;
    I.dig = true;
    I.ax = Math.sign(nd.x - from.x) || Math.sign(dx) || c.face;
    // follow the planned slope, a bit steeper if the Wühler is lagging behind
    I.slope = Math.max(-0.85, Math.min(0.6, (nd.y - from.y) / 8 + (dy > 3 ? 0.15 : dy < -3 ? -0.15 : 0)));
  }
  return false;
}

function helperAI(c, n) {
  if (c.chop) return NOIN;
  const I = { ...NOIN };
  if (LIQ[midMat(c, 0.1)]) I.ay = -1;
  // drop jobs that are over
  const j = c.job;
  if (j) {
    const gone =
      (j.type === 'collect' && !items.includes(j.ref)) ||
      (j.type === 'build' && j.ref.done) ||
      (j.type === 'chop' && (j.ref.fall || !trees.includes(j.ref))) ||
      (j.type === 'mine' && !RICH.has(mat[j.y * W + j.x]) && !c.path) ||
      (j.type === 'rest' && G.frame - j.t > 120) ||
      ((j.type === 'collect' || j.type === 'chop' || j.type === 'mine') && (cargo(c) >= 4 || c.energy < 35));
    if (gone) c.job = c.path = null;
    // following: plan again when your Wühler has moved on
    else if (
      j.type === 'follow' &&
      c.path &&
      Math.hypot(leader(c).x - j.gx, leader(c).y - j.gy) > 24 &&
      G.frame - c.pt > 20
    )
      c.path = null;
  }
  if (!c.job) {
    // stagger the decisions so not every helper thinks in the same frame
    if ((G.frame + n * 7) % 15) return I;
    c.plan = null;
    c.job = pickJob(c, n);
    c.job.t = G.frame;
    if (!c.lastJob || c.lastJob !== c.job.type) jobBubble(c, c.job.type);
    c.lastJob = c.job.type;
    c.path = null;
    c.fails = 0;
    c.lost = c.lost || 0;
  }
  // (re)plan: one path search per frame for all helpers together
  if (!c.path) {
    const t0 = G.hstat && performance.now();
    const p = plan(c, n);
    if (G.hstat) G.hstat.maxPlan = Math.max(G.hstat.maxPlan || 0, Math.round(performance.now() - t0));
    if (p === undefined) return I; // still thinking
    if (G.hstat) G.hstat[c.job.type + (p ? '+' : '-')] = (G.hstat[c.job.type + (p ? '+' : '-')] || 0) + 1;
    if (!p && G.hfail && G.hfail.length < 30)
      G.hfail.push([
        c.job.type,
        Math.round(c.x),
        Math.round(c.y),
        c.job.ref && c.job.ref.x !== undefined
          ? [Math.round(c.job.ref.x), Math.round(c.job.ref.gy ?? c.job.ref.y)]
          : [c.job.x, c.job.y],
        Math.round(G.base.x),
      ]);
    if (!p) {
      // no way home (walled in a pit, say): after a second try the helper finds its own way back
      if (c.job.type === 'follow') c.pt = G.frame;
      else if ((c.job.type === 'deliver' || c.job.type === 'rest') && ++c.lost >= 2) warpHome(c, n);
      else block(c.job.ref);
      c.job = null;
      return I;
    }
    c.lost = 0;
    c.path = p;
    c.pi = 0;
    c.pt = G.frame;
  }
  const arrived = follow(c, I);
  // miners put up support beams in their tunnels
  if (c.digging && G.frame % 8 === n % 8) tryBeam(c);
  if (arrived) return atWork(c, I);
  // no progress: plan again, give up after a few tries
  if (G.frame - c.pt > 90) {
    c.path = null;
    if (++c.fails > 3) {
      block(c.job.ref);
      c.job = null;
    }
  }
  return I;
}

// at the place of work
function atWork(c, I) {
  const j = c.job;
  I.ax = 0;
  if (j.type === 'chop') {
    const t = nearTree(c);
    if (t && !free(c.x, c.y + 1, 6, 10)) {
      c.chop = t;
      c.job = c.path = null; // after felling: collect the wood
    } else {
      c.path = null;
      if (++c.fails > 3) (block(j.ref), (c.job = null));
    }
    return I;
  }
  if (j.type === 'mine' && j.approach) {
    // walked over: now plan the way down
    j.approach = false;
    c.path = null;
    return I;
  }
  if (j.type === 'mine') {
    // dig into the rich spot until it is gone (or a few seconds passed)
    j.dug = (j.dug || 0) + 1;
    const dx = j.x - (c.x + 3),
      dy = j.y - (c.y + 5);
    I.dig = true;
    I.ax = Math.abs(dx) > 2 ? Math.sign(dx) : c.face;
    I.slope = dy > 3 ? 0.5 : dy < -4 ? -0.38 : 0;
    if (j.dug > 80 || !RICH.has(mat[j.y * W + j.x])) c.job = c.path = null;
    return I;
  }
  if (j.type === 'collect') {
    // the item rolls into the pocket; nudge towards it
    const dx = j.ref.x + j.ref.w / 2 - (c.x + 3);
    if (Math.abs(dx) > 1.5) I.ax = Math.sign(dx) * 0.6;
    if (G.frame - c.pt > 60) c.job = c.path = null;
    return I;
  }
  if (j.type === 'deliver' && cargo(c) === 0) c.job = c.path = null;
  // build: stand still so the hammering counts; rest: just wait
  return I;
}

export { helperAI, nav, navDig, nearestOre };
