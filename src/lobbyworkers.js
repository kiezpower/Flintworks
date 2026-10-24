// The Wühler in the lobby really work: each one picks the nearest ore in the ground, finds a
// way there with the same A* as the helpers in the game (walking, dropping, hopping onto ledges
// and digging new tunnels), digs the ore out and carries it home to the castle.
// When the ground is empty, a fresh piece of land is made for the next round.
import { drawClonkHi } from './clonkhi.js';
import { DIG, mkNav } from './pathfind.js';
import { drawItemBig } from './sprites.js';

const ITEM_OF = { 3: 'nug', 10: 'ore', 11: 'coal', 13: 'gem' };
const CRUMB = { 1: '#7d5230', 3: '#ffe066', 10: '#9a5a46', 11: '#3b3735', 13: '#b6f6ff' };
const workers = [];
const dust = [],
  gains = [];
let nav = null,
  navKey = null;

function mkWorker(cap, k) {
  return {
    cap,
    k,
    x: 0,
    y: 0,
    face: 1,
    anim: 0,
    vx: 0,
    hurt: 0,
    dead: false,
    inv: [],
    isel: 0,
    job: null,
    wait: k * 50,
  };
}
function resetWorkers(land) {
  if (!workers.length) workers.push(mkWorker('#2f7fd0', 0), mkWorker('#3f9e4a', 1), mkWorker('#d9822b', 2));
  nav = mkNav({
    solid: (x, y) => x < 0 || x >= land.LW || y >= land.LH || (y >= 0 && land.cells[y * land.LW + x] !== 0),
    // keep the castle and the hero's hill standing
    dig: (x, y) =>
      !(x > land.castleX - 4 && x < land.castleX + 40 && y < land.groundY(x) + 8) &&
      !(Math.abs(x - land.heroX) < 10 && y < land.groundY(x) + 8),
    digCost: 0.15,
    maxDrop: 30,
    jumpH: 12,
    maxNodes: 4000,
  });
  navKey = land.cells;
  for (const w of workers) home(w, land, true);
}
function home(w, land, place) {
  const x = land.castleX + 10 + w.k * 6;
  if (place) {
    w.x = x;
    w.y = (nav.standAt(x, land.groundY(x) - 14) ?? land.groundY(x) - 10) | 0;
  }
  return x;
}

// nearest ore cell that nobody else is after
function findOre(w, land) {
  const { LW, LH, cells } = land;
  let best = null,
    bd = 1e9;
  for (let y = 0; y < LH; y += 2)
    for (let x = 0; x < LW; x += 2) {
      const m = cells[y * LW + x];
      if (!ITEM_OF[m] || w.bad?.has(y * LW + x)) continue;
      if (
        workers.some(
          o => o !== w && o.job && o.job.tx !== undefined && Math.abs(o.job.tx - x) + Math.abs(o.job.ty - y) < 12,
        )
      )
        continue;
      const d = Math.abs(x - w.x - 3) + Math.abs(y - w.y - 5) * 1.5;
      if (d < bd) {
        bd = d;
        best = { tx: x, ty: y, i: y * LW + x, got: ITEM_OF[m] };
      }
    }
  return best;
}
function plan(w, land) {
  const j = w.job;
  let goal, heur;
  if (j.type === 'mine') {
    const cx = j.tx - 3,
      cy = j.ty - 5;
    goal = (x, y) => Math.abs(x - cx) <= 5 && Math.abs(y - cy) <= 6;
    heur = (x, y) => (Math.abs(x - cx) + Math.abs(y - cy)) * 2.5;
  } else {
    const hx = home(w, land);
    goal = (x, y) => Math.abs(x - hx) <= 3 && y < land.groundY(x + 3);
    heur = (x, y) => (Math.abs(x - hx) + Math.abs(y - land.groundY(hx) + 10)) * 2.5;
  }
  return nav.find(w.x, w.y, goal, heur);
}

function updWorker(w, land, t) {
  w.vx = 0;
  w.digging = false;
  if (w.wait > 0) {
    w.wait--;
    return;
  }
  if (!w.job) {
    if (w.inv.length) w.job = { type: 'home' };
    else {
      const o = findOre(w, land);
      if (o) w.job = { type: 'mine', ...o, n: 0, k: 0 };
      else {
        // ground is empty: once everybody is home, a new round begins
        if (workers.every(o => !o.job && !o.inv.length)) {
          land.renew();
          resetWorkers(land);
          for (const o of workers) o.wait = 60 + o.k * 40;
        } else w.wait = 30;
        return;
      }
    }
    w.path = plan(w, land);
    w.pi = 0;
    if (!w.path) {
      if (w.job.type === 'mine') (w.bad ||= new Set()).add(w.job.i);
      else home(w, land, true); // walled in: back home by other means
      w.job = null;
      w.wait = 20;
      return;
    }
  }
  const p = w.path;
  if (w.pi < p.length) {
    const nd = p[w.pi];
    const dx = nd.x - w.x,
      dy = nd.y - w.y;
    const digging = nd.a === DIG;
    const sp = digging ? 0.18 : 0.45;
    if (Math.abs(dx) > 0.01) {
      w.face = Math.sign(dx);
      w.x += Math.sign(dx) * Math.min(Math.abs(dx), sp);
      w.vx = Math.sign(dx) * sp;
      w.anim += digging ? 0.3 : 0.35;
    }
    // up (hops and slanted digging) goes with the forward motion; falling is faster
    if (Math.abs(dy) > 0.01)
      w.y += Math.sign(dy) * Math.min(Math.abs(dy), dy > 0 && !digging ? 1.2 : digging ? sp : 0.9);
    if (digging) {
      w.digging = true;
      const sl = (nd.y - (w.pi ? p[w.pi - 1].y : nd.y)) / 8;
      const l = Math.hypot(1, sl);
      w.digDir = [w.face / l, sl / l];
      // clear the body box plus a pixel ahead
      for (let yy = Math.floor(w.y); yy < w.y + 10; yy++)
        for (let xx = Math.floor(w.x) - 1; xx < w.x + 7; xx++) {
          const m = land.dig(xx, yy);
          if (m && Math.random() < 0.15) crumb(xx, yy, m);
        }
    }
    if (Math.abs(nd.x - w.x) < 0.02 && Math.abs(nd.y - w.y) < 0.02) w.pi++;
    return;
  }
  // arrived
  const j = w.job;
  if (j.type === 'mine') {
    // dig out the vein around the target
    w.digging = true;
    w.face = Math.sign(j.tx - (w.x + 3)) || w.face;
    w.digDir = [w.face, j.ty > w.y + 7 ? 0.5 : 0];
    w.anim += 0.3;
    if (t % 3 === 0) {
      let found = 0;
      for (let r = 0; r <= 5 && !found; r++)
        for (let yy = j.ty - r; yy <= j.ty + r && !found; yy++)
          for (let xx = j.tx - r; xx <= j.tx + r && !found; xx++) {
            const m = land.cells[yy * land.LW + xx];
            if (yy < 0 || yy >= land.LH || xx < 0 || xx >= land.LW || !m) continue;
            if (Math.abs(xx - land.heroX) < 10 && yy < land.groundY(xx) + 8) continue;
            land.dig(xx, yy);
            crumb(xx, yy, m);
            if (ITEM_OF[m]) j.n++;
            found = 1;
          }
      if (!found || ++j.k > 90) {
        // vein done: take a lump home
        if (j.n) w.inv = [j.got];
        w.job = null;
      }
    }
    return;
  }
  // home: hand over the load
  if (w.inv.length) {
    gains.push({ t: w.inv[0], x: w.x + 1, y: w.y - 4, l: 50 });
    for (let q = 0; q < 6; q++)
      dust.push({ x: w.x + 3, y: w.y + 2, vx: (Math.random() - 0.5) * 0.8, vy: -Math.random(), l: 25, c: '#ffe066' });
  }
  w.inv = [];
  w.job = null;
  w.wait = 40 + Math.random() * 60;
}
function crumb(x, y, m) {
  dust.push({ x, y, vx: (Math.random() - 0.5) * 0.8, vy: -Math.random() * 0.8, l: 22, c: CRUMB[m] || CRUMB[1] });
}

function updWorkers(land, t) {
  if (!nav || navKey !== land.cells) resetWorkers(land);
  for (const w of workers) updWorker(w, land, t);
}
function drawWorkers(g) {
  for (const w of workers) drawClonkHi(w, Math.round(w.x), Math.round(w.y), w.face, g);
  for (let k = dust.length - 1; k >= 0; k--) {
    const d = dust[k];
    d.x += d.vx;
    d.y += d.vy;
    d.vy += 0.04;
    if (--d.l <= 0) dust.splice(k, 1);
    g.fillStyle = d.c;
    g.fillRect(d.x, d.y, 0.5, 0.5);
  }
  // delivered ore floats up over the castle
  for (let k = gains.length - 1; k >= 0; k--) {
    const o = gains[k];
    o.y -= 0.25;
    if (--o.l <= 0) gains.splice(k, 1);
    g.globalAlpha = Math.min(1, o.l / 20);
    drawItemBig(g, o.t, Math.round(o.x), Math.round(o.y), 4, 3);
    g.globalAlpha = 1;
  }
}

export { drawWorkers, resetWorkers, updWorkers };
if (import.meta.env.DEV) window.__lw = { workers, nav: () => nav };
