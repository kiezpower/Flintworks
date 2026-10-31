// The look of the underground, on top of the material textures: veins with a dark rim and a
// mineral stain in the earth around them, large soil patches, small finds in the ground that
// change with depth (roots, stones, bones, trilobites, crystals) and a back wall of caves and
// tunnels that shows the ground behind. Everything follows from the position alone, so it needs
// no storage and every player sees the same.
// Colours follow the depth: warm just below the grass, cooler further down, violet in the deep;
// gold and gems glow out of the dark.
const S = { rim: 0.68, halo: 0.4, patch: 0.12, wall: 0.42, wallRock: 0.32 };

// material ids (as in world.js, which imports this module)
const EARTH = 1,
  ROCK = 2,
  GOLD = 3,
  SAND = 4,
  LOAM = 9,
  ORE = 10,
  COAL = 11,
  GEM = 13;
const VEIN = new Uint8Array(16);
VEIN[GOLD] = VEIN[ORE] = VEIN[COAL] = VEIN[GEM] = 1;
const LENS = new Uint8Array(16);
LENS[SAND] = LENS[LOAM] = 1;
// the colour a vein stains the earth around it with
const STAIN = { [GOLD]: [1.3, 1.12, 0.7], [GEM]: [0.8, 1.1, 1.3], [ORE]: [1.22, 0.9, 0.8], [COAL]: [0.72, 0.72, 0.75] };

const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
function vnoise(x, y, cell, s) {
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
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// ---- finds in the ground: pixel art (one character = one landscape pixel = 2×2 texels) ----
const COL = {
  r: [74, 48, 28, 0.85],
  R: [104, 72, 44, 0.8],
  o: [40, 28, 20, 0.55],
  S: [138, 124, 108, 0.95],
  s: [170, 158, 140, 0.95],
  d: [96, 86, 76, 0.95],
  w: [224, 212, 186, 0.9],
  W: [190, 176, 150, 0.9],
  a: [196, 170, 128, 0.9],
  A: [150, 124, 88, 0.9],
  k: [150, 104, 220, 1],
  K: [222, 196, 255, 1],
  q: [96, 64, 160, 1],
};
const STAMPS = {
  root: ['...R....', '...r....', '..rr....', '..r.r...', '.r...r..', '.r....r.', 'r.......'],
  root2: ['....R...', '....r...', '...r.r..', '..r...r.', '..r.....', '.r......'],
  stone: ['.oSSo.', 'oSssSo', 'oSSSdo', '.oddo.'],
  stone2: ['..oo...', '.oSSSo.', 'oSsSSdo', 'oSSSSdo', '.oddoo.'],
  bone: ['wW.....Ww', '.wwwwwww.', 'Ww.....wW'],
  // a trilobite: head shield, ribbed body, tail
  trilobite: ['.oaaao.', 'oaAAAao', 'aAaaaAa', '.aAAAa.', 'aAaaaAa', '.aAAAa.', '.oaAao.', '..oao..'],
  crystal: ['....K...', '..k.Kk..', '..kKkk.K', '.qkKkqkk', 'qqkkqqkq'],
};
for (const k in STAMPS) STAMPS[k] = { rows: STAMPS[k], w: STAMPS[k][0].length, h: STAMPS[k].length };
// which find a 20×20 pixel square holds, by depth (in landscape pixels below the surface)
function pickFind(h, d) {
  const k = 1;
  if (d < 2) return null;
  if (d < 22) return h < 0.3 * k ? (h < 0.15 * k ? 'root' : 'root2') : h < 0.38 * k ? 'stone' : null;
  if (d < 120) return h < 0.1 * k ? 'stone' : h < 0.17 * k ? 'stone2' : h < 0.2 * k ? 'bone' : h < 0.235 * k ? 'trilobite' : null;
  return h < 0.07 * k ? 'stone2' : h < 0.14 * k ? 'crystal' : h < 0.16 * k ? 'trilobite' : null;
}
const HOST = {
  root: [EARTH],
  root2: [EARTH],
  stone: [EARTH, LOAM],
  stone2: [EARTH, LOAM],
  bone: [EARTH, LOAM],
  trilobite: [EARTH, LOAM, ROCK],
  crystal: [EARTH, ROCK],
};
let surf = null,
  W = 0;
// the find of the 20×20 block last asked for (cells are painted row by row, so neighbours
// nearly always share it)
let fbx = -1,
  fby = -1,
  fst = null,
  fhost = null,
  fox = 0,
  foy = 0,
  fflip = false;
function findAt(x, y, m) {
  const gx = (x / 20) | 0,
    gy = (y / 20) | 0;
  if (gx !== fbx || gy !== fby) {
    fbx = gx;
    fby = gy;
    const kind = pickFind(hash(gx, gy, 501), gy * 20 + 10 - surf[Math.min(W - 1, gx * 20 + 10)]);
    fst = kind && STAMPS[kind];
    if (fst) {
      fhost = HOST[kind];
      fox = gx * 20 + Math.floor(hash(gx, gy, 502) * (21 - fst.w));
      foy = gy * 20 + Math.floor(hash(gx, gy, 503) * (21 - fst.h));
      fflip = hash(gx, gy, 504) < 0.5;
    }
  }
  if (!fst) return null;
  let lx = x - fox;
  const ly = y - foy;
  if (lx < 0 || ly < 0 || lx >= fst.w || ly >= fst.h || !fhost.includes(m)) return null;
  if (fflip) lx = fst.w - 1 - lx;
  const ch = fst.rows[ly][lx];
  return ch === '.' ? null : COL[ch];
}

// scale the channels of a packed colour (alpha kept); written out, it runs for every texel
const ch3 = (c, r, g, b) => {
  const R = (c & 255) * r,
    G = ((c >>> 8) & 255) * g,
    B = ((c >>> 16) & 255) * b;
  return ((c & 0xff000000) | ((B > 255 ? 255 : B | 0) << 16) | ((G > 255 ? 255 : G | 0) << 8) | (R > 255 ? 255 : R | 0)) >>> 0;
};
const blend = (c, col) => {
  const a = col[3],
    R = (c & 255) * (1 - a) + col[0] * a,
    G = ((c >>> 8) & 255) * (1 - a) + col[1] * a,
    B = ((c >>> 16) & 255) * (1 - a) + col[2] * a;
  return ((c & 0xff000000) | ((B | 0) << 16) | ((G | 0) << 8) | (R | 0)) >>> 0;
};

// c: the texel so far, m: material, i: cell, x/y: texel position, sx/sy: texel within the cell,
// d: depth below the surface; mat and solid: the world
function underTexel(c, m, i, x, y, sx, sy, d, mat, SOLID, top) {
  if (VEIN[m] || LENS[m]) {
    // a dark rim where a vein or lens meets other ground
    const nx = mat[sx ? i + 1 : i - 1],
      ny = mat[sy ? i + W : i - W];
    // (a lens of sand or loam is lit from above: its top edge lighter, the other edges dark)
    const lit = LENS[m] && !sy && ny !== m && SOLID[ny];
    const rim = lit ? 1.16 : (nx !== m && SOLID[nx]) || (ny !== m && SOLID[ny]) ? S.rim : 1;
    if (m === GOLD || m === GEM) return ch3(c, 1.3 * rim, 1.25 * rim, 1.2 * rim);
    const o = dIdx(d);
    return ch3(c, DK[o] * rim, DK[o + 1] * rim, DK[o + 2] * rim);
  }
  if (m !== EARTH && m !== LOAM && m !== ROCK) return c;
  if (top) return depthGrade(c, d);
  if (!PATCH) makePatches();
  // soil patch, vein stain and depth colour make one factor per cell; the find is per cell too
  // (computed on the cell's first texel, which paintCell always asks for first)
  if (i !== ci || (!sx && !sy)) cellLook(i, x >> 1, y >> 1, m, d, mat);
  c = ch3(c, cr, cg, cb);
  return cf ? blend(c, cf) : c;
}
let ci = -1,
  cr = 1,
  cg = 1,
  cb = 1,
  cf = null;
function cellLook(i, x, y, m, d, mat) {
  ci = i;
  cr = cg = cb = 1;
  // large soil patches: redder clay here, darker humus there
  if (m !== ROCK) {
    const p = PATCH[i],
      k = S.patch;
    if (p > 0) {
      cr = 1 + p * k * 2;
      cg = 1 - p * k;
      cb = 1 - p * k * 1.6;
    } else {
      cr = cg = 1 + p * k * 1.6;
      cb = 1 + p * k * 1.2;
    }
  }
  // the stain of a vein close by
  const st = VB && !VB[((y >> 3) * VBW) + (x >> 3)] ? 0 : stainNear(i, mat);
  if (st) {
    const [r, g, b] = STAIN[STAINED],
      k = S.halo * st * 2;
    cr *= 1 + (r - 1) * k;
    cg *= 1 + (g - 1) * k;
    cb *= 1 + (b - 1) * k;
  }
  const o = dIdx(d);
  cr *= DK[o];
  cg *= DK[o + 1];
  cb *= DK[o + 2];
  cf = findAt(x, y, m);
}
// soil patches, worked out once for the whole world (they depend on the place only)
let PATCH = null;
function makePatches() {
  PATCH = new Float32Array(W * HGT);
  for (let y = 0; y < HGT; y++) for (let x = 0; x < W; x++) PATCH[y * W + x] = vnoise(x, y, 45, 510) - 0.5;
}
// the nearest vein within three pixels and how strongly it stains (1 next to it, fading out);
// offsets nearest first, as plain arrays because this runs for every cell of earth
let SO = null,
  SK = null,
  STAINED = 0;
function stainNear(i, mat) {
  if (!SO) {
    const o = [],
      k = [];
    for (let r = 1; r <= 3; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && Math.abs(dx) + Math.abs(dy) <= r + 1) {
            o.push(dy * W + dx);
            k.push(1 - (r - 1) * 0.33);
          }
    SO = Int32Array.from(o);
    SK = Float32Array.from(k);
  }
  for (let n = 0; n < SO.length; n++) {
    const v = mat[i + SO[n]];
    if (VEIN[v]) {
      STAINED = v;
      return SK[n];
    }
  }
  return 0;
}
// warm below the grass, cool and darker further down, violet in the deep (a table by depth)
const DK = new Float32Array(3 * 401);
for (let d = 0; d <= 400; d++) {
  const t = Math.min(1, Math.max(0, (d - 20) / 100)),
    u = Math.min(1, Math.max(0, (d - 120) / 90));
  DK[d * 3] = 1.12 - t * 0.3 - u * 0.02;
  DK[d * 3 + 1] = 1.0 - t * 0.12 - u * 0.14;
  DK[d * 3 + 2] = 0.86 + t * 0.16 + u * 0.08;
}
const dIdx = d => (d < 0 ? 0 : d > 400 ? 1200 : d * 3);
const depthGrade = (c, d) => {
  const o = dIdx(d);
  return ch3(c, DK[o], DK[o + 1], DK[o + 2]);
};
// back wall of caves and tunnels: the ground behind (earth, rock in the deep), in deep shadow;
// f: the shading of the wall on top
function wallTexel(ti, d, TEX, f) {
  const rock = d > 140,
    k = (rock ? S.wallRock : S.wall) * f,
    o = dIdx(d);
  return ch3(TEX[rock ? ROCK : EARTH][ti], DK[o] * k, DK[o + 1] * k * 0.96, DK[o + 2] * k * 0.92);
}
// 8×8 blocks with a vein within three pixels (worked out before the whole world is painted;
// veins only ever disappear afterwards, so a stale block just means a needless look)
let VB = null,
  VBW = 0;
function prepareUnder(mat) {
  VBW = Math.ceil(W / 8);
  VB = new Uint8Array(VBW * Math.ceil(HGT / 8));
  for (let i = 0; i < W * HGT; i++)
    if (VEIN[mat[i]]) {
      const x = i % W,
        y = (i / W) | 0;
      for (const yy of [y - 3, y + 3]) for (const xx of [x - 3, x + 3]) if (xx >= 0 && yy >= 0 && xx < W && yy < HGT) VB[(yy >> 3) * VBW + (xx >> 3)] = 1;
    }
}
let HGT = 0;
// also after the world changed its size: the caches that depend on it are made anew
function setGround(s, w, h) {
  surf = s;
  W = w;
  HGT = h;
  PATCH = SO = null;
  fbx = fby = -1;
}
export { prepareUnder, setGround, underTexel, wallTexel };
