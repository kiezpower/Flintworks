// Natural events now and then (not in the relaxed setting): earthquakes shake loose ceilings
// underground, volcanoes rise from the surface, pour lava and spit out treasure. Meteors and
// lightning live in weather.js. Everything here runs on the host; clients get the messages,
// the shaking and the lava bombs as events, and the terrain through the normal sync.
import { announce, quake } from './announce.js';
import { hurt } from './clonk.js';
import { spawnItem } from './entities.js';
import { startCaveIn } from './hazards.js';
import { beamNear } from './mine.js';
import { ignite } from './objects.js';
import { sfx } from './sound.js';
import { G, builds, crew, parts, trees } from './state.js';
import {
  AIR,
  EARTH,
  H,
  LAVA,
  LIQ,
  ROCK,
  SAND,
  SOLID,
  W,
  activate,
  mat,
  paint,
  ri,
  rnd,
  setMat,
  surf,
} from './world.js';

const bombs = []; // flying lava blobs (on clients only for the looks)
const nextGap = () => Math.round((9000 + rnd() * 7000) / (G.evRate || 1));

function updEvents() {
  updBombs();
  if (G.netClient) return;
  if (G.quakeT > 0) shakeTick();
  if (G.volc) volcanoTick(G.volc);
  if (G.relaxed || G.evRate === 0 || G.tut) return;
  if (G.evNext == null) G.evNext = nextGap();
  if (--G.evNext > 0 || G.quakeT > 0 || G.volc) return;
  G.evNext = nextGap();
  const kinds = G.evKinds || ['quake', 'volcano'];
  if (kinds[ri(0, kinds.length - 1)] === 'quake') startQuake();
  else startVolcano();
}

// ---- earthquake ----
function startQuake() {
  G.quakeT = 360;
  announce('Erdbeben! Unter Tage kann die Decke herunterkommen');
  sfx('thunder');
}
function shakeTick() {
  G.quakeT--;
  quake(G.quakeT > 60 ? 2.4 : 1);
  if (G.frame % 4) return;
  const near = crew.filter(c => !c.dead);
  if (!near.length) return;
  const c = near[ri(0, near.length - 1)];
  const x = Math.round(c.x + 3 + (rnd() - 0.5) * 160);
  if (x < 2 || x >= W - 2) return;
  // walk up from the Wühler's height to the cave ceiling above
  let y = Math.round(c.y + 10);
  if (y >= H - 2 || y < 0) return;
  while (y > surf[x] + 6 && mat[y * W + x] === AIR) y--;
  if (y <= surf[x] + 6 || beamNear(x, y, 14)) return;
  for (let k = 0; k < ri(1, 3); k++) {
    const i = (y - k) * W + x;
    if (mat[i] === EARTH || mat[i] === ROCK) {
      mat[i] = SAND;
      paint(i);
    }
  }
  activate(x, y);
  if (rnd() < 0.25) spawnItem('rock', x, y + 1, (rnd() - 0.5) * 0.4, 0.8, 0).rubble = true;
  // once in a while a whole ceiling gives way next to someone digging deep
  if (G.quakeT === 200 && rnd() < 0.5 && c.y - surf[Math.round(c.x)] > 40) startCaveIn(Math.round(c.x + 3), y + 4);
}

// ---- volcano ----
function ventSpot() {
  for (let tries = 0; tries < 40; tries++) {
    const x = ri(60, W - 60);
    if (builds.some(b => Math.abs(b.x + b.w / 2 - x) < 170)) continue;
    if (LIQ[mat[(surf[x] - 1) * W + x]]) continue;
    return x;
  }
  return -1;
}
function startVolcano() {
  const x = ventSpot();
  if (x < 0) return;
  // a cone of rock grows out of the ground
  const top = surf[x];
  for (let dx = -16; dx <= 16; dx++)
    for (let h = 0; h < 14 - Math.abs(dx) * 0.8; h++) {
      const xx = x + dx,
        y = top - h;
      if (xx < 0 || xx >= W || y < 2 || mat[y * W + xx] !== AIR) continue;
      setMat(xx, y, ROCK);
    }
  G.volc = { x, y: top - 13, warn: 480, t: 420, out: 0 };
  announce('Ein Vulkan erwacht! Halte Abstand – er spuckt bald Lava und Schätze');
  sfx('thunder');
}
function volcanoTick(v) {
  if (G.frame % 3 === 0)
    parts.push({
      x: v.x + (rnd() - 0.5) * 3,
      y: v.y - 2,
      vx: (rnd() - 0.5) * 0.3,
      vy: -0.4,
      l: 90,
      c: '#5d5852',
      g: -0.003,
    });
  if (v.warn > 0) {
    if (--v.warn === 0) {
      announce('Der Vulkan bricht aus!');
      sfx('boom', v.x, v.y);
    }
    if (v.warn < 120) quake(1);
    return;
  }
  quake(1.4);
  // lava wells up out of the crater and runs down the sides
  if (G.frame % 4 === 0 && v.out < 260)
    for (let dx = -1; dx <= 1; dx++)
      if (mat[v.y * W + v.x + dx] === AIR || mat[v.y * W + v.x + dx] === ROCK) {
        setMat(v.x + dx, v.y, LAVA);
        v.out++;
      }
  if (G.frame % 6 === 0) throwBomb(v.x, v.y - 2, (rnd() - 0.5) * 3.2, -3.4 - rnd() * 2.2);
  // and now and then something valuable
  if (G.frame % 50 === 0) {
    const t = rnd() < 0.25 ? 'gem' : rnd() < 0.5 ? 'nug' : 'flint';
    spawnItem(t, v.x, v.y - 4, (rnd() - 0.5) * 3, -3 - rnd() * 1.5, 25);
  }
  if (--v.t <= 0) {
    G.volc = null;
    announce('Der Vulkan beruhigt sich');
  }
}
function throwBomb(x, y, vx, vy) {
  bombs.push({ x, y, vx, vy });
  if (G.netHost) G.netEvent(['p', 'l', Math.round(x), Math.round(y), vx, vy]);
}
// a client shows the lava bombs of the host
function playBomb(e) {
  if (e[0] !== 'p' || e[1] !== 'l') return false;
  bombs.push({ x: e[2], y: e[3], vx: e[4], vy: e[5] });
  return true;
}
function updBombs() {
  for (let k = bombs.length - 1; k >= 0; k--) {
    const b = bombs[k];
    b.vy += 0.12;
    b.x += b.vx;
    b.y += b.vy;
    if (rnd() < 0.5) parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, l: 14, c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f' });
    const x = Math.floor(b.x),
      y = Math.floor(b.y);
    if (x < 0 || x >= W || y >= H) {
      bombs.splice(k, 1);
      continue;
    }
    if (y < 0 || !(SOLID[mat[y * W + x]] || LIQ[mat[y * W + x]])) continue;
    bombs.splice(k, 1);
    if (!G.netClient) splat(x, y - 1);
  }
}
// a lava bomb lands: a little puddle of lava, fire around it
function splat(x, y) {
  for (let dy = -1; dy <= 0; dy++)
    for (let dx = -1; dx <= 1; dx++) if (mat[(y + dy) * W + x + dx] === AIR) setMat(x + dx, y + dy, LAVA);
  for (const t of trees) if (!t.fall && Math.abs(t.x - x) < 8 && y > t.gy - 30 && y < t.gy + 4) ignite(t);
  for (const c of crew)
    if (!c.dead && Math.abs(c.x + 3 - x) < 6 && Math.abs(c.y + 5 - y) < 8) {
      hurt(c, 10);
      c.burn = 90;
    }
}
function drawEvents(ctx, cx, cy) {
  for (const b of bombs) {
    const x = Math.floor(b.x - cx),
      y = Math.floor(b.y - cy);
    ctx.fillStyle = '#ff7a2f';
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(x, y, 1, 1);
  }
}
function resetEvents() {
  bombs.length = 0;
  G.quakeT = 0;
  G.volc = null;
  G.evNext = null;
}

export { drawEvents, playBomb, resetEvents, startQuake, startVolcano, updEvents };
