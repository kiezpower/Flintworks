// Builds a hand-made level from its package (levels/<id>/): the map is blown up from its zoom to
// the world, borders between materials are roughened so nothing looks like building blocks,
// '?' areas are filled by the generator, then the objects are placed. Called by gen() after the
// world was emptied and sized.
import { addClonk, mkAnimal, newId, spawnItem } from '../entities.js';
import { blob, clearFoot, finishWorld, plantTree, settle, topSolid } from '../gen.js';
import { setupTeams } from '../teams.js';
import { G, animals, builds, crew } from '../state.js';
import { AIR, COAL, EARTH, GEM, GOLD, H, H0, LOAM, ORE, ROCK, SAND, W, W0 } from '../world.js';
import { bg, mat, ri, rnd, shade, surf } from '../world.js';
import { CHARS, FIXED } from './palette.js';

// map text → rows of characters, checked against the world size
function parseMap(L) {
  const rows = L.map.replace(/\r/g, '').split('\n').filter(r => r.length);
  const z = L.zoom || 1,
    mw = rows[0].length;
  const bad = msg => new Error(`level ${L.id}: ${msg}`);
  if (rows.length * z !== H || mw * z !== W) throw bad(`map ${mw}×${rows.length} × zoom ${z} is not ${W}×${H}`);
  for (let y = 0; y < rows.length; y++) {
    if (rows[y].length !== mw) throw bad(`map row ${y} has ${rows[y].length} characters, not ${mw}`);
    for (const ch of rows[y]) if (!CHARS[ch]) throw bad(`unknown map character "${ch}" in row ${y}`);
  }
  return { rows, z, mw, mh: rows.length };
}

// smooth noise in -0.5..0.5, the same for every device (seeded by the level)
const hash = (x, y, s) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function noise(x, y, cell, s) {
  const gx = x / cell,
    gy = y / cell,
    x0 = Math.floor(gx),
    y0 = Math.floor(gy),
    fx = gx - x0,
    fy = gy - y0,
    sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s),
    b = hash(x0 + 1, y0, s),
    c = hash(x0, y0 + 1, s),
    d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy - 0.5;
}

// each cell takes the map character of a slightly shifted spot: borders become ragged, while
// granite, liquids and planks keep the outline that was drawn
function stampMap(L, M) {
  const { rows, z, mw, mh } = M,
    amp = (L.rough ?? 0.5) * z * 1.6,
    seed = L.seed || 1,
    zone = new Uint8Array(W * H);
  const at = (mx, my) => rows[my < 0 ? 0 : my >= mh ? mh - 1 : my][mx < 0 ? 0 : mx >= mw ? mw - 1 : mx];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const own = at((x / z) | 0, (y / z) | 0);
      let ch = own;
      if (amp > 0) {
        const dx = noise(x, y, 7, seed) * amp + noise(x, y, 2.5, seed + 7) * amp * 0.35,
          dy = noise(x, y, 7, seed + 3) * amp + noise(x, y, 2.5, seed + 9) * amp * 0.35,
          moved = at(Math.floor((x + dx) / z), Math.floor((y + dy) / z));
        if (!FIXED.has(CHARS[own][0]) && !FIXED.has(CHARS[moved][0])) ch = moved;
      }
      const i = y * W + x,
        [m, b] = CHARS[ch];
      mat[i] = m;
      bg[i] = b;
      if (ch === '?') zone[i] = 1;
    }
  return zone;
}

// the ground line: first cell from the top that is not open sky
function findSurface() {
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H - 1 && mat[y * W + x] === AIR && !bg[y * W + x]) y++;
    surf[x] = y - 1;
  }
}

// what the generator puts into '?' areas, per 1400 × 400 world of such area:
// [name, material, count, rx, ry]
const FILL = [
  ['rock', ROCK, 38, [6, 18], [4, 11]],
  ['sand', SAND, 14, [6, 13], [4, 9]],
  ['loam', LOAM, 12, [8, 16], [3, 6]],
  ['caves', AIR, 10, [10, 24], [6, 12]],
  ['coal', COAL, 16, [5, 12], [3, 6]],
  ['ore', ORE, 14, [4, 9], [3, 6]],
  ['gold', GOLD, 26, [3, 7], [2, 5]],
  ['gems', GEM, 12, [2, 4], [2, 3]],
];
function fillZones(L, zone) {
  const cells = [];
  for (let i = 0; i < W * H; i++) if (zone[i]) cells.push(i);
  if (!cells.length) return;
  // the generator's underground is about 70 % of a 1400 × 400 world
  const share = cells.length / (W0 * H0 * 0.7),
    f = L.fill || {};
  for (const [name, m, k, rx, ry] of FILL) {
    const n = Math.round(k * share * (f[name] ?? 1));
    for (let q = 0; q < n; q++) {
      const i = cells[ri(0, cells.length - 1)];
      blob(i % W, (i / W) | 0, ri(...rx), ri(...ry), m, j => zone[j] === 1);
    }
  }
}

// x of an object, negative counts from the right edge
const ox = x => Math.round(x < 0 ? W + x : x);
const onTop = (x, h) => topSolid(Math.max(0, Math.min(W - 1, x))) - h;

function placeObjects(L) {
  const st = L.start || {};
  G.chests = [];
  G.chestsFound = 0;
  G.gas = [];
  G.gasClouds = [];
  const objs = L.objects || [];
  // the castles first: everything else may stand next to them (team 1: the second castle, Versus only)
  const castle = o => {
    const x = Math.min(W - 37, Math.max(0, ox(o.x))),
      b = { id: newId(), type: 'base', x, gy: surf[x + 18] + 1, w: 36, h: 30, prog: 1, done: true, busy: 0 };
    b.lvl = o.lvl || 1;
    clearFoot(b.x, b.gy, b.w, b.h);
    builds.push(b);
    return b;
  };
  G.base = castle(objs.find(o => o.t === 'base' && !o.team) || { x: 60 });
  const b2 = G.nextVersus && objs.find(o => o.t === 'base' && o.team === 1);
  const second = b2 && Object.assign(castle(b2), { team: 1 });
  for (const o of objs) {
    const x = ox(o.x ?? 0);
    if (o.t === 'tree') plantTree(x, o.stage ?? 4);
    else if (o.t === 'item') spawnItem(o.kind, x, o.y ?? onTop(x, 6), 0, 0);
    else if (o.t === 'animal') {
      const a = mkAnimal(o.kind, x, o.y ?? onTop(x, 6));
      if (o.lost) a.lost = true;
      animals.push(a);
    } else if (o.t === 'trapped') {
      // a Wühler waiting under ground to be reached (counts for "rescue")
      const c = addClonk(x - 3, o.y - 10);
      c.trapped = true;
      c.focus = 'stay';
    } else if (o.t === 'chest') G.chests.push({ x: x - 4, y: o.y - 6, open: false, re: o.re || 0 });
    else if (o.t === 'gas') G.gas.push({ x, y: o.y, r: o.r || 8, done: false });
    // an old support beam from y0 down to y1 (holds the ceiling like a built one)
    else if (o.t === 'beam') (G.beams ||= []).push({ x, y0: o.y0, y1: o.y1 });
  }
  // the crew at the castle (the trapped ones above are already in the list, they go last)
  const trapped = crew.splice(0);
  const n = st.crew ?? 3,
    inv = st.inv || [['flint', 'rock'], ['loam'], ['rock']];
  for (let k = 0; k < n; k++) {
    const c = addClonk(G.base.x + 10 + k * 6, G.base.gy - 10);
    c.inv = [...(inv[k] || [])];
  }
  crew[0].pid = G.myId;
  G.money = st.money ?? 40;
  // Versus: two helpers at the second castle, which gets the same start money
  if (second) {
    for (let k = 0; k < 2; k++) {
      const c = addClonk(second.x + 16 + k * 6, second.gy - 10);
      Object.assign(c, { team: 1, inv: [k ? 'rock' : 'loam'] });
    }
    setupTeams([G.base, second]);
  }
  for (const c of trapped) crew.push(c);
}

function genLevel(L) {
  G.lvlSeed = L.seed || 1;
  const zone = stampMap(L, parseMap(L));
  findSurface();
  fillZones(L, zone);
  // grass and the top soil, as in a generated world
  for (let x = 0; x < W; x++)
    for (let y = surf[x] + 1; y <= surf[x] + 3 && y < H; y++) if (mat[y * W + x] === EARTH) shade[y * W + x] |= 4;
  settle();
  placeObjects(L);
  // nothing falls out of the sky in a level unless it says so
  G.meteorNext = L.rules?.meteors ? 15000 + rnd() * 8000 : 1e9;
  finishWorld();
}

export { genLevel };
