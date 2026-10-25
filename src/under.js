// The look of the underground, on top of the material textures: veins with a dark rim and a
// mineral stain in the earth around them, large soil patches, small finds in the ground that
// change with depth (roots, stones, bones, ammonites, crystals) and a back wall of caves and
// tunnels that shows the ground behind. Everything follows from the position alone, so it needs
// no storage and every player sees the same.
// Three styles to compare (address ?ug=a, b or c; without it the old look stays):
//   a – fine: subtle rims, few finds;  b – rich: many finds, earthy back wall;
//   c – mood: strong colour shift with depth, glowing veins.
const STYLES = {
  a: { rim: 0.78, halo: 0.2, patch: 0.06, deco: 0.45, wall: 0, depth: 0 },
  b: { rim: 0.68, halo: 0.35, patch: 0.12, deco: 1, wall: 0.34, depth: 0 },
  c: { rim: 0.6, halo: 0.5, patch: 0.08, deco: 0.6, wall: 0.26, depth: 1 },
};
let S = null;
try {
  S = STYLES[new URLSearchParams(location.search).get('ug')] || null;
} catch {}

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
  shell: ['..AaaA..', '.AaAAaA.', 'AaA..AaA', 'aA.aA.Aa', 'aA.Aa.aA', 'AaA.AaA.', '.AaaA...'],
  crystal: ['....K...', '..k.Kk..', '..kKkk.K', '.qkKkqkk', 'qqkkqqkq'],
};
for (const k in STAMPS) STAMPS[k] = { rows: STAMPS[k], w: STAMPS[k][0].length, h: STAMPS[k].length };
// which find a 20×20 pixel square holds, by depth (in landscape pixels below the surface)
function pickFind(h, d) {
  const k = S.deco;
  if (d < 2) return null;
  if (d < 22) return h < 0.3 * k ? (h < 0.15 * k ? 'root' : 'root2') : h < 0.38 * k ? 'stone' : null;
  if (d < 120) return h < 0.1 * k ? 'stone' : h < 0.17 * k ? 'stone2' : h < 0.2 * k ? 'bone' : h < 0.235 * k ? 'shell' : null;
  return h < 0.07 * k ? 'stone2' : h < 0.14 * k ? 'crystal' : h < 0.16 * k ? 'shell' : null;
}
const HOST = {
  root: [EARTH],
  root2: [EARTH],
  stone: [EARTH, LOAM],
  stone2: [EARTH, LOAM],
  bone: [EARTH, LOAM],
  shell: [EARTH, LOAM, ROCK],
  crystal: [EARTH, ROCK],
};
let surf = null,
  W = 0;
function findAt(x, y, m) {
  const gx = (x / 20) | 0,
    gy = (y / 20) | 0,
    cx = Math.min(W - 1, gx * 20 + 10);
  const kind = pickFind(hash(gx, gy, 501), gy * 20 + 10 - surf[cx]);
  if (!kind || !HOST[kind].includes(m)) return null;
  const st = STAMPS[kind],
    ox = Math.floor(hash(gx, gy, 502) * (21 - st.w)),
    oy = Math.floor(hash(gx, gy, 503) * (21 - st.h));
  let lx = x - gx * 20 - ox;
  const ly = y - gy * 20 - oy;
  if (lx < 0 || ly < 0 || lx >= st.w || ly >= st.h) return null;
  if (hash(gx, gy, 504) < 0.5) lx = st.w - 1 - lx;
  const ch = st.rows[ly][lx];
  return ch === '.' ? null : COL[ch];
}

const ch3 = (c, r, g, b) => {
  const f = (s, k) => Math.min(255, Math.max(0, Math.round(((c >>> s) & 255) * k))) << s;
  return (((c >>> 24) << 24) | f(16, b) | f(8, g) | f(0, r)) >>> 0;
};
const blend = (c, col) => {
  const a = col[3],
    f = (s, v) => Math.round(((c >>> s) & 255) * (1 - a) + v * a) << s;
  return (((c >>> 24) << 24) | f(16, col[2]) | f(8, col[1]) | f(0, col[0])) >>> 0;
};

// c: the texel so far, m: material, i: cell, x/y: texel position, sx/sy: texel within the cell,
// d: depth below the surface; mat and solid: the world
function underTexel(c, m, i, x, y, sx, sy, d, mat, SOLID, top) {
  if (!S) return c;
  if (VEIN[m] || LENS[m]) {
    // a dark rim where a vein or lens meets other ground
    const nx = mat[sx ? i + 1 : i - 1],
      ny = mat[sy ? i + W : i - W];
    if ((nx !== m && SOLID[nx]) || (ny !== m && SOLID[ny])) c = ch3(c, ...rimK(m));
    // style c: gold and gems glow out of the dark
    if (S.depth) return m === GOLD || m === GEM ? ch3(c, 1.3, 1.25, 1.2) : depthGrade(c, d);
    return c;
  }
  if (m !== EARTH && m !== LOAM && m !== ROCK) return c;
  if (!top) {
    // large soil patches: redder clay here, darker humus there
    if (S.patch && m !== ROCK) {
      const p = vnoise(x, y, 90, 510) - 0.5;
      c = p > 0 ? ch3(c, 1 + p * S.patch * 2, 1 - p * S.patch, 1 - p * S.patch * 1.6) : ch3(c, 1 + p * S.patch * 1.6, 1 + p * S.patch * 1.6, 1 + p * S.patch * 1.2);
    }
    // the stain of a vein close by
    const st = stainNear(i, mat);
    if (st) {
      const [r, g, b] = STAIN[st[0]],
        k = S.halo * st[1];
      c = ch3(c, 1 + (r - 1) * k * 2, 1 + (g - 1) * k * 2, 1 + (b - 1) * k * 2);
    }
    const f = findAt(x >> 1, y >> 1, m);
    if (f) c = blend(c, f);
  }
  return S.depth ? depthGrade(c, d) : c;
}
const rimK = m => (LENS[m] ? [1 - (1 - S.rim) * 0.5, 1 - (1 - S.rim) * 0.5, 1 - (1 - S.rim) * 0.5] : [S.rim, S.rim, S.rim]);
// the nearest vein within three pixels and how strongly it stains (1 next to it, fading out)
let STEPS = null;
function stainNear(i, mat) {
  if (!STEPS) {
    STEPS = [];
    for (let r = 1; r <= 3; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && Math.abs(dx) + Math.abs(dy) <= r + 1) STEPS.push([dy * W + dx, 1 - (r - 1) * 0.33]);
  }
  for (const [o, k] of STEPS) {
    const n = mat[i + o];
    if (STAIN[n]) return [n, k];
  }
  return null;
}
// style c: warm below the grass, cool and darker further down, violet in the deep
function depthGrade(c, d) {
  const t = Math.min(1, Math.max(0, (d - 20) / 100)),
    u = Math.min(1, Math.max(0, (d - 120) / 90));
  return ch3(c, 1.12 - t * 0.3 - u * 0.02, 1.0 - t * 0.12 - u * 0.14, 0.86 + t * 0.16 + u * 0.08);
}
// back wall of caves and tunnels: the ground behind, in deep shadow (null: keep the old wall)
function wallTexel(ti, d, TEX) {
  if (!S || !S.wall) return null;
  const tex = TEX[d > 140 ? ROCK : EARTH];
  return S.depth ? depthGrade(ch3(tex[ti], S.wall, S.wall, S.wall), d) : ch3(tex[ti], S.wall, S.wall * 0.96, S.wall * 0.92);
}
function setGround(s, w) {
  surf = s;
  W = w;
}
const underStyle = () => S;
// switch the style while playing (the world has to be painted again afterwards)
const setUnderStyle = id => (S = STYLES[id] || null);

export { setGround, setUnderStyle, underStyle, underTexel, wallTexel };
