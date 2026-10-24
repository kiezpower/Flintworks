import { ITEM } from './sprites.js';
import { CAPS, G, NAMES, crew, items } from './state.js';
import { free, matAt, ri } from './world.js';

// ---- Entities ----
function addClonk(x, y) {
  const n = crew.length;
  const c = {
    id: newId(),
    kind: 'clonk',
    name: NAMES[n % NAMES.length],
    cap: CAPS[n % CAPS.length],
    x,
    y,
    w: 6,
    h: 10,
    vx: 0,
    vy: 0,
    face: 1,
    energy: 100,
    breath: 100,
    inv: [],
    isel: 0,
    anim: 0,
    hurt: 0,
    climb: false,
    hangle: false,
    tumble: false,
    rot: 0,
    getup: 0,
    digging: false,
    digDir: [0, 1],
    chop: null,
    bridge: null,
    hammer: false,
    dead: false,
    deadT: 0,
    burn: 0,
  };
  crew.push(c);
  return c;
}
function mkAnimal(kind, x, y) {
  const sz = { wipf: [5, 4], fish: [4, 2], monster: [12, 9], bat: [5, 3] }[kind];
  return {
    id: newId(),
    kind,
    x,
    y,
    w: sz[0],
    h: sz[1],
    vx: 0,
    vy: 0,
    face: 1,
    t: ri(20, 120),
    hp: kind === 'monster' ? 90 : kind === 'wipf' ? 10 : 4,
    hurt: 0,
    anim: 0,
    dry: 0,
    atk: 0,
  };
}
function spawnItem(t, x, y, vx, vy, pd = 0, thrower = null) {
  const [w, h] = ITEM[t].s;
  const it = { id: newId(), t, x, y, vx, vy, w, h, pd, armed: false, fuse: -1, thrower };
  items.push(it);
  return it;
}
function moveBody(e, dx, dy, step) {
  let bx = false,
    by = false;
  let n = Math.ceil(Math.abs(dx));
  if (n) {
    const s = dx / n;
    for (let k = 0; k < n; k++) {
      if (free(e.x + s, e.y, e.w, e.h)) {
        e.x += s;
        continue;
      }
      let ok = false;
      if (step)
        for (let u = 1; u <= step; u++)
          if (free(e.x + s, e.y - u, e.w, e.h)) {
            e.x += s;
            e.y -= u;
            ok = true;
            break;
          }
      if (!ok) {
        bx = true;
        break;
      }
    }
  }
  n = Math.ceil(Math.abs(dy));
  if (n) {
    const s = dy / n;
    for (let k = 0; k < n; k++) {
      if (free(e.x, e.y + s, e.w, e.h)) e.y += s;
      else {
        by = true;
        break;
      }
    }
  }
  return [bx, by];
}
function unstuck(e) {
  if (free(e.x, e.y, e.w, e.h)) return;
  for (let s = 1; s <= 12; s++) {
    if (free(e.x, e.y - s, e.w, e.h)) {
      e.y -= s;
      return;
    }
  }
  for (let s = 1; s <= 6; s++) {
    if (free(e.x + s, e.y, e.w, e.h)) {
      e.x += s;
      return;
    }
    if (free(e.x - s, e.y, e.w, e.h)) {
      e.x -= s;
      return;
    }
  }
}
const overlap = (a, b, m = 0) =>
  a.x + a.w > b.x - m && a.x < b.x + b.w + m && a.y + a.h > b.y - m && a.y < b.y + b.h + m;
const midMat = (e, fy) => matAt(Math.floor(e.x + e.w / 2), Math.floor(e.y + e.h * fy));
const insideB = (c, b) => c.x + 6 > b.x && c.x < b.x + b.w && c.y + 10 > b.gy - b.h && c.y < b.gy + 1;
// your own Wühler (the one with your player id)
const sel_ = () => crew.find(c => c.pid === G.myId) || null;
// every entity gets a stable id (the network refers to things by it)
const newId = () => (G.nextId = (G.nextId || 0) + 1);

export { addClonk, insideB, midMat, mkAnimal, moveBody, newId, overlap, sel_, spawnItem, unstuck };
