// Procedural material textures (64×64 tiles at double resolution, seamless).
// Each landscape pixel shows 2×2 texels, so earth gets pebbles, rock gets strata and cracks,
// gold/coal/ore/gems become chunky stones with highlights.
const T = 128;

// ---- tileable noise ----
const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
function vnoise(x, y, cell, s) {
  const n = T / cell;
  const gx = x / cell,
    gy = y / cell;
  const x0 = Math.floor(gx),
    y0 = Math.floor(gy);
  const fx = gx - x0,
    fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const v = (a, b) => hash(((a % n) + n) % n, ((b % n) + n) % n, s);
  const a = v(x0, y0),
    b = v(x0 + 1, y0),
    c = v(x0, y0 + 1),
    d = v(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x, y, s) =>
  vnoise(x, y, 32, s) * 0.45 +
  vnoise(x, y, 16, s + 1) * 0.3 +
  vnoise(x, y, 8, s + 2) * 0.15 +
  vnoise(x, y, 4, s + 3) * 0.1;
// Voronoi on a torus: distance to nearest and second nearest feature point, plus cell id
function voronoi(x, y, cells, s) {
  const size = T / cells;
  const cx = Math.floor(x / size),
    cy = Math.floor(y / size);
  let d1 = 1e9,
    d2 = 1e9,
    id = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i,
        gy = cy + j;
      const wx = ((gx % cells) + cells) % cells,
        wy = ((gy % cells) + cells) % cells;
      const px = (gx + 0.15 + hash(wx, wy, s) * 0.7) * size,
        py = (gy + 0.15 + hash(wx, wy, s + 9) * 0.7) * size;
      const d = Math.hypot(px - x, py - y);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = wy * cells + wx;
      } else if (d < d2) d2 = d;
    }
  return { d1, d2, id, size };
}

// ---- colour helpers ----
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const pack = (r, g, b, a = 255) =>
  ((a << 24) |
    (Math.max(0, Math.min(255, b | 0)) << 16) |
    (Math.max(0, Math.min(255, g | 0)) << 8) |
    Math.max(0, Math.min(255, r | 0))) >>>
  0;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
function make(fn) {
  const t = new Uint32Array(T * T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const c = fn(x, y);
      t[y * T + x] = pack(c[0], c[1], c[2], c[3] ?? 255);
    }
  return t;
}

// ---- materials ----
function earth(base = '#7a5030') {
  const b = rgb(base),
    dark = mul(b, 0.66),
    light = mul(b, 1.16);
  return make((x, y) => {
    const n = fbm(x, y, 11);
    let c = mix(dark, light, n);
    // clumps and darker soil streaks
    const streak = vnoise(x * 0.5, y * 1.6, 16, 14);
    c = mul(c, 0.9 + streak * 0.18);
    // pebbles of different sizes, scattered unevenly
    const v = voronoi(x, y, 18, 21);
    const want = 0.1 + vnoise(x, y, 32, 24) * 0.25;
    if (hash(v.id, 3, 22) < want) {
      const r = v.size * (0.18 + hash(v.id, 4, 25) * 0.22);
      if (v.d1 < r) {
        const tone = hash(v.id, 5, 23);
        const stone = tone < 0.4 ? [128, 112, 96] : tone < 0.75 ? [104, 80, 58] : [146, 120, 84];
        c = mix(c, stone, 0.85);
        if (v.d1 < r * 0.45 && y % 2 === 0) c = mul(c, 1.18);
        else if (v.d1 > r * 0.75) c = mul(c, 0.78);
      }
    }
    // fine grain
    c = mul(c, 0.92 + hash(x, y, 31) * 0.16);
    return c;
  });
}
function rock(base = '#6f6a64', seed = 40) {
  const b = rgb(base);
  return make((x, y) => {
    const strata = Math.sin((y + fbm(x, y, seed) * 22) * 0.4) * 0.5 + 0.5;
    let c = mul(b, 0.82 + strata * 0.3);
    const v = voronoi(x, y, 12, seed + 3);
    const crack = v.d2 - v.d1;
    if (crack < 1.1) c = mul(c, 0.62);
    else if (crack < 2.2) c = mul(c, 1.12);
    c = mul(c, 0.93 + hash(x, y, seed + 7) * 0.14);
    return c;
  });
}
// chunky stones (gold, coal, ore, gems) in a darker matrix
function chunks(stone, matrix, { cells = 9, hi = 1.45, gloss = 0.25, seed = 60 } = {}) {
  const s = rgb(stone),
    m = rgb(matrix);
  return make((x, y) => {
    const v = voronoi(x, y, cells, seed);
    const edge = v.d2 - v.d1;
    if (edge < 1.3) return mul(m, 0.8 + hash(x, y, seed + 1) * 0.3);
    // dome shading: brighter towards the upper left of each stone
    const shadeK = 1 - Math.min(1, v.d1 / (v.size * 0.7)) * 0.35;
    let c = mul(s, (0.85 + hash(v.id, 1, seed + 2) * 0.3) * shadeK);
    if (hash(x, y, seed + 3) < gloss && v.d1 < v.size * 0.25) c = mul(c, hi);
    return c;
  });
}
function sand() {
  const b = rgb('#d9b56a');
  return make((x, y) => {
    const ripple = Math.sin((x * 0.35 + y * 0.9 + fbm(x, y, 70) * 6) * 0.9) * 0.05;
    return mul(b, 0.92 + ripple + hash(x, y, 71) * 0.14);
  });
}
function loam() {
  const b = rgb('#b07a45');
  return make((x, y) => {
    const smear = vnoise(x * 0.4, y * 2, 8, 80);
    return mul(b, 0.86 + smear * 0.22 + hash(x, y, 81) * 0.06);
  });
}
function plank() {
  const b = rgb('#a0703f');
  return make((x, y) => {
    const board = Math.floor(y / 8),
      off = hash(board, 0, 90) * 64;
    let k = 0.9 + Math.sin((x + off) * 0.25 + vnoise(x, y, 8, 91) * 4) * 0.08;
    if (y % 8 === 0) k = 0.6;
    if ((x + off) % 32 < 1) k = 0.65;
    return mul(b, k + hash(x, y, 92) * 0.05);
  });
}
function granite() {
  const b = rgb('#3b3640');
  return make((x, y) => {
    let c = mul(b, 0.85 + fbm(x, y, 100) * 0.35);
    const h = hash(x, y, 101);
    if (h < 0.05) c = [120, 110, 130];
    else if (h < 0.1) c = mul(c, 0.6);
    return c;
  });
}
function topSoil(cols) {
  const c = cols.map(rgb);
  return make((x, y) => {
    const n = fbm(x, y, 120);
    const k = Math.floor(n * 3.99);
    return mul(c[k], 0.92 + hash(x, y, 121) * 0.14);
  });
}
// back wall of dug tunnels: dark, softly structured earth
function tunnel() {
  const b = rgb('#3a2416');
  return make((x, y) => {
    let c = mul(b, 0.75 + fbm(x, y, 130) * 0.45);
    const v = voronoi(x, y, 16, 131);
    if (hash(v.id, 2, 132) < 0.2 && v.d1 < v.size * 0.3) c = mul(c, 1.25);
    return c;
  });
}

const TEX = [];
TEX[1] = earth();
TEX[2] = rock();
TEX[3] = chunks('#f2c230', '#8a6212', { cells: 20, hi: 1.5, gloss: 0.35, seed: 61 });
TEX[4] = sand();
TEX[6] = granite();
TEX[9] = loam();
TEX[10] = chunks('#a65a40', '#5a3226', { cells: 18, hi: 1.6, gloss: 0.2, seed: 62 });
TEX[11] = chunks('#2e2a2a', '#151212', { cells: 16, hi: 2.6, gloss: 0.18, seed: 63 });
TEX[12] = plank();
TEX[13] = chunks('#45c8e6', '#1f5f80', { cells: 14, hi: 1.7, gloss: 0.4, seed: 64 });
const TUNNEL = tunnel();
let TOP = topSoil(['#5f9a3c', '#6fae4a', '#558a34', '#79b955']);
const setTopSoil = cols => (TOP = topSoil(cols));
// large-scale light variation across the world so the tiling never shows
function worldShade(W, H) {
  const out = new Float32Array(W * H);
  const big = (x, y, cell, s) => {
    const gx = x / cell,
      gy = y / cell,
      x0 = Math.floor(gx),
      y0 = Math.floor(gy),
      fx = gx - x0,
      fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0, s),
      b = hash(x0 + 1, y0, s),
      c = hash(x0, y0 + 1, s),
      d = hash(x0 + 1, y0 + 1, s);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) out[y * W + x] = 0.86 + big(x, y, 37, 200) * 0.18 + big(x, y, 11, 201) * 0.1;
  return out;
}
const topTex = () => TOP;

export { T, TEX, TUNNEL, setTopSoil, topTex, worldShade };
