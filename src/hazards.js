import { sel_ } from './entities.js';
import { hasTool } from './tools.js';
// Cave hazards that grow with depth: cave-ins after a warning rumble, and hidden pockets of
// mine gas that poison the air and explode when fire gets near.
import { hurt } from './clonk.js';
import { spawnItem } from './entities.js';
import { explode } from './objects.js';
import { sfx } from './sound.js';
import { G, crew, flashes, items, parts, trees } from './state.js';
import { toast } from './ui.js';
import { AIR, EARTH, H, LAVA, ROCK, SAND, W, activate, mat, paint, ri, rnd, surf } from './world.js';

const DEEP = 45; // pixels below the surface where trouble starts
let caveT = -9999,
  pending = null;

// gas pockets are invisible until dug into; placed once per world
function placeGas() {
  G.gas = [];
  G.gasClouds = [];
  for (let k = 0; k < 9; k++) {
    const x = ri(250, W - 30);
    G.gas.push({ x, y: Math.floor(surf[x] + DEEP + rnd() * (H - surf[x] - DEEP - 40)), r: ri(6, 10), done: false });
  }
}
const depthAt = (x, y) => y - surf[Math.max(0, Math.min(W - 1, x))];

// called for every dug cell
function onDig(x, y) {
  if (G.gas)
    for (const g of G.gas)
      if (!g.done && (x - g.x) ** 2 + (y - g.y) ** 2 < g.r * g.r) {
        g.done = true;
        G.gasClouds.push({ x: g.x, y: g.y, r: g.r + 8, l: 1400 });
        toast('Grubengas! Kein Feuer – und schnell raus hier');
        sfx('hiss', x, y);
      }
  const d = depthAt(x, y);
  // the deeper, the more likely the ceiling gives way
  if (!pending && G.frame - caveT > 1500 && d > DEEP && rnd() < (d - DEEP) / 120000) {
    startCaveIn(x, y);
  }
}
function startCaveIn(x, y) {
  pending = { x, y, t: 110 };
  caveT = G.frame;
  toast('Es knirscht über dir … Vorsicht!');
  sfx('creak', x, y);
}

function ceilingAbove(x, y) {
  for (let yy = y - 4; yy > y - 40 && yy > 0; yy--) if (mat[yy * W + x] !== AIR) return yy;
  return -1;
}
function collapse(p) {
  G.shake = Math.max(G.shake, 6);
  sfx('thud', p.x, p.y);
  sfx('boom', p.x, p.y, 0.4);
  for (let dx = -12; dx <= 12; dx++) {
    const x = p.x + dx;
    if (x < 1 || x >= W - 1) continue;
    const yc = ceilingAbove(x, p.y);
    if (yc < 0) continue;
    // a band of the ceiling turns to loose rubble and pours down
    for (let yy = yc; yy > yc - 3 - (dx % 3 === 0 ? 2 : 0); yy--) {
      const i = yy * W + x;
      if (mat[i] === EARTH || mat[i] === ROCK) {
        mat[i] = SAND;
        paint(i);
      }
    }
    activate(x, yc);
    if (dx % 5 === 0) spawnItem('rock', x, yc + 1, (rnd() - 0.5) * 0.4, 0.8, 0);
  }
}

function updHazards() {
  if (pending) {
    G.shake = Math.max(G.shake, 1.2);
    if (G.frame % 3 === 0) {
      const x = pending.x + ri(-12, 12),
        yc = ceilingAbove(x, pending.y);
      if (yc > 0) parts.push({ x, y: yc + 1, vx: 0, vy: 0.5, l: 40, c: '#8a6a4a', g: 0.05 });
    }
    if (--pending.t <= 0) {
      collapse(pending);
      pending = null;
    }
  }
  const clouds = G.gasClouds;
  if (!clouds) return;
  for (let k = clouds.length - 1; k >= 0; k--) {
    const cl = clouds[k];
    cl.l--;
    cl.y -= 0.01;
    const r = cl.r * Math.min(1, cl.l / 300);
    const inside = (x, y, pad = 0) => (x - cl.x) ** 2 + (y - cl.y) ** 2 < (r + pad) ** 2;
    // fire nearby → the whole pocket goes up
    const fire =
      flashes.some(f => inside(f.x, f.y, 6)) ||
      items.some(it => it.fuse > 0 && inside(it.x, it.y)) ||
      crew.some(c => c.burn > 0 && inside(c.x + 3, c.y + 5)) ||
      trees.some(t => t.burn > 0 && inside(t.x, t.gy - 5)) ||
      lavaNear(cl.x, cl.y, r);
    if (fire) {
      clouds.splice(k, 1);
      explode(cl.x, cl.y, Math.round(cl.r * 1.4));
      toast('Das Gas ist explodiert!');
      continue;
    }
    for (const c of crew)
      if (!c.dead && inside(c.x + 3, c.y + 4)) {
        c.breath = Math.max(0, c.breath - 1.9);
        if (c.breath <= 0) hurt(c, 0.25, true);
      }
    if (cl.l <= 0) clouds.splice(k, 1);
  }
}
function lavaNear(x, y, r) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2,
      xx = Math.round(x + Math.cos(a) * r),
      yy = Math.round(y + Math.sin(a) * r);
    if (xx >= 0 && yy >= 0 && xx < W && yy < H && mat[yy * W + xx] === LAVA) return true;
  }
  return false;
}

// greenish swirling haze
function drawHazards(ctx, cx, cy) {
  const s = sel_();
  if (hasTool('lamp') && s && G.gas)
    for (const g of G.gas)
      if (!g.done && Math.hypot(g.x - s.x, g.y - s.y) < 70) {
        ctx.strokeStyle = `rgba(150,215,80,${0.35 + Math.sin(G.frame * 0.1) * 0.15})`;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(Math.round(g.x - cx), Math.round(g.y - cy), g.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
  const clouds = G.gasClouds;
  if (!clouds || !clouds.length) return;
  for (const cl of clouds) {
    const r = cl.r * Math.min(1, cl.l / 300);
    const sx = cl.x - cx,
      sy = cl.y - cy;
    if (sx < -r || sy < -r || sx > G.VW + r || sy > G.VH + r) continue;
    for (let k = 0; k < 14; k++) {
      const a = k * 2.4 + G.frame * 0.01 * (k % 2 ? 1 : -1),
        d = r * (0.25 + ((k * 37) % 10) / 14);
      ctx.fillStyle = `rgba(150,215,80,${0.14 + (k % 3) * 0.04})`;
      const s = 3 + (k % 3);
      ctx.fillRect(Math.round(sx + Math.cos(a) * d) - s, Math.round(sy + Math.sin(a) * d * 0.7) - s, s * 2, s * 2);
    }
  }
}

export { drawHazards, onDig, placeGas, startCaveIn, updHazards };
