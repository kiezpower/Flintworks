// The campaign as a mine shaft (levelselect.js): each chapter is a cross-section of the ground,
// a tunnel dug from level to level ever deeper – chapter 1 starts at the surface under a
// headframe, chapter 2 goes on down to the granite and the glow of lava. The levels are stations
// in chambers along the tunnel: a round porthole with the level's picture and a sign with its name
// and stars. The tunnel is dug as far as the levels are open; beyond it only a crack shows the way.
// Your own Wühler stands at the station where it goes on. The ground is drawn in landscape pixels
// (3 screen pixels each) with the colours of the game's materials (world.js PAL), the same for
// every opening (its own random numbers).
import { BIOMES } from './biomes.js';
import { drawPortrait } from './portrait.js';
import { P } from './profile.js';
import { drawSceneArt } from './sceneart.js';
import { paintTerrainOnce } from './terrainart.js';

const S = 3, // screen pixels per landscape pixel
  STEP = 150, // from station to station
  ST_W = 116, // a station's width (porthole and sign)
  PORT = 70, // the porthole
  LEFT = 64; // room before the first station (the headframe in chapter 1)

// the materials' colours (world.js PAL): earth, its grass, loam, rock, granite, the specks
const EARTH = ['#8a5a32', '#7d5230', '#94633a', '#71482a'],
  GRASS = ['#5f9a3c', '#6fae4a', '#558a34', '#79b955'],
  LOAM = ['#b07a45', '#a8703e', '#bb854f', '#9f6a3a'],
  ROCK = ['#6f6a64', '#7b766f', '#625d58', '#888179'],
  GRAN = ['#3b3640', '#45404b', '#34303a', '#4f4955'],
  TUN = ['#3a2416', '#33200f', '#402a1a', '#2e1c10'],
  GOLD = ['#e8b923', '#f5cf3d', '#ffe066'],
  ORE = ['#9a5a46', '#c07658'],
  COAL = ['#2a2626', '#3b3735'],
  GEM = ['#3fb5d6', '#b6f6ff'],
  LAVA = ['#ff6a1a', '#ff8a2a', '#e8501a', '#ffb03a'],
  WOOD = '#8a5a32',
  WOOD_D = '#5e3b1e',
  RAIL = '#9a948c';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// a fixed noise value per cell (the texture does not flicker between openings)
const hash = (x, y) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mix = (a, b, f) => {
  const p = c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16));
  const A = p(a),
    B = p(b);
  return `rgb(${A.map((v, k) => Math.round(v + (B[k] - v) * f)).join(',')})`;
};

// the ground of a chapter: deep0..deep1 is how deep it reaches (0 the surface, 1 the lava)
function ground(g, w, h, deep0, deep1, surface, rec = null) {
  const sky = BIOMES.meadow.sky;
  for (let x = 0; x < w; x++) {
    const top = surface ? Math.round(9 + Math.sin(x / 11) * 1.2 + Math.sin(x / 4.3) * 0.5) : -1;
    for (let y = 0; y < h; y++) {
      let col;
      if (y < top) {
        // the sky, with far hills
        const f = y / Math.max(1, top);
        col = `rgb(${sky[0].map((v, k) => Math.round(v + (sky[1][k] - v) * f)).join(',')})`;
        const hill = top - 3 - Math.round(2.5 + 2.5 * Math.sin(x / 17 + 1));
        if (y >= hill) col = BIOMES.meadow.hills[(x >> 5) % 2];
      } else if (surface && y < top + 2) {
        col = GRASS[Math.floor(hash(x, y) * 4)];
        if (rec) {
          rec.mat[y * w + x] = 1;
          rec.shade[y * w + x] = 4;
        }
      } else {
        // how deep this cell is: down the picture and a little to the right (the tunnel goes
        // down that way), with wavy borders between the layers
        const d = deep0 + (deep1 - deep0) * (y / h * 0.8 + (x / w) * 0.2) + Math.sin(x / 9 + y / 23) * 0.025;
        // (the texture in clumps of 2×2 and blobs of 4×4, not single pixels: it reads as stone)
        const n = hash(x >> 2, y >> 2),
          q = hash(x >> 1, y >> 1) * 0.7 + hash(x, y) * 0.3;
        const set = d < 0.16 ? EARTH : d < 0.27 ? (n < 0.5 ? LOAM : EARTH) : d < 0.42 ? EARTH : d < 0.62 ? ROCK : d < 0.84 ? (n < 0.35 ? GRAN : ROCK) : GRAN;
        col = set[Math.min(set.length - 1, Math.floor(q * set.length))];
        // pebbles in the earth, specks of what lies deeper (2×2 nuggets, few of them)
        const r = hash((x >> 1) * 7 + 3, (y >> 1) * 5 + 1);
        if (set === EARTH && r < 0.025) col = ROCK[(x >> 1) % 4];
        else if (r > 0.9965) col = d > 0.7 ? GEM[(x + y) & 1] : GOLD[(x + y) % 3];
        else if (r > 0.992) col = d > 0.45 ? ORE[(x + y) & 1] : GOLD[x % 3];
        else if (r > 0.986 && d > 0.2 && d < 0.6) col = COAL[(x + y) & 1];
        if (rec) {
          // (the same cut in the game's materials, for the painted picture: terrainart.js)
          // layers with soft, wavy pockets instead of the pixel drawing's small blocks, and
          // finds as little round lumps
          const wave = Math.sin(x / 7 + y / 5) + Math.sin(x / 13 - y / 9 + 2) + Math.sin(y / 4 + x / 23),
            pocket = wave > 0.9;
          let m = d < 0.16 ? 1 : d < 0.27 ? (pocket ? 9 : 1) : d < 0.42 ? 1 : d < 0.62 ? 2 : d < 0.84 ? (pocket ? 6 : 2) : 6;
          const lx = (x % 4) - 1.5,
            ly = (y % 4) - 1.5,
            lump = hash((x >> 2) * 7 + 3, (y >> 2) * 5 + 1);
          if (lx * lx + ly * ly < 2.6) {
            if (lump > 0.994) m = d > 0.7 ? 13 : 3;
            else if (lump > 0.987) m = d > 0.45 ? 10 : 3;
            else if (lump > 0.979 && d > 0.2 && d < 0.6) m = 11;
            else if (lump < 0.018 && m === 1) m = 2;
          }
          rec.mat[y * w + x] = m;
          rec.tone[y * w + x] = 1 - Math.min(0.45, Math.max(0, (d - 0.3) * 0.5));
        }
        // darker the deeper
        col = mix(col, '#120a06', Math.min(0.45, Math.max(0, (d - 0.3) * 0.5)));
      }
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
}
// the middle line of the tunnel at x: level between two stations, then sloping down
function lineAt(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1],
      [x1, y1] = pts[k];
    if (x > x1) continue;
    const t = (x - x0) / (x1 - x0),
      s = t < 0.3 ? 0 : t > 0.8 ? 1 : (t - 0.3) / 0.5;
    return Math.round(y0 + (y1 - y0) * s * s * (3 - 2 * s));
  }
  return pts[pts.length - 1][1];
}
function tunnel(g, pts, dug, to) {
  // dug: as far as the levels are open (x in landscape pixels); then a crack to the end
  for (let x = pts[0][0]; x <= to; x++) {
    const y = lineAt(pts, x);
    if (x > dug) {
      // not dug yet: a dark crack and loose stones along it
      if (x % 3) {
        g.fillStyle = TUN[1];
        g.fillRect(x, y, 1, 1);
      }
      if (hash(x, y) < 0.15) {
        g.fillStyle = ROCK[3];
        g.fillRect(x, y - 1, 1, 1);
      }
      continue;
    }
    for (let dy = -3; dy <= 2; dy++) {
      g.fillStyle = TUN[Math.floor(hash(x, y + dy) * 4)];
      g.fillRect(x, y + dy, 1, 1);
    }
    // the rails and their sleepers
    g.fillStyle = RAIL;
    g.fillRect(x, y + 1, 1, 1);
    if (x % 4 === 0) {
      g.fillStyle = WOOD_D;
      g.fillRect(x, y + 2, 1, 1);
    }
    // wooden props every few steps
    if (x % 18 === 9) {
      g.fillStyle = WOOD;
      g.fillRect(x - 2, y - 3, 1, 5);
      g.fillRect(x + 2, y - 3, 1, 5);
      g.fillRect(x - 2, y - 4, 5, 1);
      g.fillStyle = WOOD_D;
      g.fillRect(x - 2, y - 3, 5, 1);
    }
  }
}
// a chamber round a station; open ones are lit by a lantern
function chamber(g, cx, cy, lit, plain = false) {
  const rx = 19,
    ry = 13;
  for (let y = -ry; y <= ry + 1; y++)
    for (let x = -rx; x <= rx; x++) {
      const e = (x / rx) ** 2 + (y / ry) ** 2 + Math.sin((cx + x) * 1.7) * 0.06;
      if (e > 1) continue;
      g.fillStyle = TUN[Math.floor(hash(cx + x, cy + y) * 4)];
      if (!lit) g.fillStyle = mix(g.fillStyle, '#000000', 0.35);
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  // its floor of planks
  g.fillStyle = lit ? WOOD : WOOD_D;
  g.fillRect(cx - rx + 3, cy + ry - 1, 2 * rx - 5, 1);
  if (!lit) return;
  // the lantern on a post, its warm light
  g.fillStyle = WOOD_D;
  g.fillRect(cx + rx - 5, cy - 2, 1, ry + 1);
  g.fillStyle = '#ffe066';
  g.fillRect(cx + rx - 6, cy - 4, 3, 2);
  if (plain) return;
  const glow = g.createRadialGradient(cx + rx - 5, cy - 3, 1, cx + rx - 5, cy - 3, 22);
  glow.addColorStop(0, 'rgba(255,214,120,0.35)');
  glow.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = glow;
  g.fillRect(cx - 30, cy - 30, 60, 60);
}
// the headframe over the shaft at the surface (chapter 1)
function headframe(g, x, top, y1) {
  // the shaft down to the first tunnel
  for (let y = top; y <= y1; y++)
    for (let dx = -2; dx <= 2; dx++) {
      g.fillStyle = TUN[Math.floor(hash(x + dx, y) * 4)];
      g.fillRect(x + dx, y, 1, 1);
    }
  g.fillStyle = WOOD;
  for (let y = top; y <= y1; y += 4) g.fillRect(x - 2, y, 5, 1);
  // the frame: two legs, braces, the wheel on top
  g.fillStyle = WOOD_D;
  for (let k = 0; k < 9; k++) {
    g.fillRect(x - 5 + Math.floor(k / 3), top - 1 - k, 1, 1);
    g.fillRect(x + 5 - Math.floor(k / 3), top - 1 - k, 1, 1);
  }
  g.fillStyle = WOOD;
  g.fillRect(x - 4, top - 4, 9, 1);
  g.fillRect(x - 3, top - 7, 7, 1);
  g.fillStyle = '#4a4a4a';
  for (let a = 0; a < 12; a++) g.fillRect(Math.round(x + Math.cos((a / 12) * 6.283) * 2.5), Math.round(top - 11 + Math.sin((a / 12) * 6.283) * 2.5), 1, 1);
  g.fillRect(x, top - 11, 1, 10);
}
// lava at the bottom of the deepest chamber (end of chapter 2)
function lava(g, w, h) {
  for (let x = w - 70; x < w; x++)
    for (let y = h - 6 + Math.round(Math.sin(x / 5) * 1.5); y < h; y++) {
      g.fillStyle = LAVA[Math.floor(hash(x, y) * 4)];
      g.fillRect(x, y, 1, 1);
    }
  const glow = g.createLinearGradient(0, h - 26, 0, h);
  glow.addColorStop(0, 'rgba(255,106,26,0)');
  glow.addColorStop(1, 'rgba(255,106,26,0.35)');
  g.fillStyle = glow;
  g.fillRect(w - 90, h - 26, 90, 26);
}

// The same cut in the painted look. The pixel drawing above stays the source of truth for
// where things are: the ground gives the materials, and whatever tunnel, chambers and headframe
// change on top of it is read back – dark tunnel pixels become cave wall, the rest (beams,
// rails, lanterns) small coloured blocks. Returns false while the paintings are not loaded.
const K = 4; // canvas pixels per landscape pixel
function paintShaft(cv, w, h, part, over, lanterns) {
  const rec = { mat: new Uint8Array(w * h), shade: new Uint8Array(w * h), tone: new Float32Array(w * h).fill(1) },
    bg = new Uint8Array(w * h);
  const lo = document.createElement('canvas');
  lo.width = w;
  lo.height = h;
  const lg = lo.getContext('2d', { willReadFrequently: true });
  ground(lg, w, h, part ? 0.5 : 0, part ? 1 : 0.5, !part, rec);
  const before = lg.getImageData(0, 0, w, h).data.slice();
  over(lg);
  const after = lg.getImageData(0, 0, w, h).data,
    blocks = [];
  for (let i = 0; i < w * h; i++) {
    const r = after[i * 4],
      gr = after[i * 4 + 1],
      b = after[i * 4 + 2];
    if (r === before[i * 4] && gr === before[i * 4 + 1] && b === before[i * 4 + 2]) continue;
    if (r < 72 && gr < 46 && b < 32 && r >= gr && gr >= b) {
      // tunnel and chamber: open, with the back wall; unlit chambers are darker
      rec.mat[i] = 0;
      rec.shade[i] = 0;
      bg[i] = 1;
      rec.tone[i] = r < 44 ? 0.62 : 0.9;
    } else blocks.push(i, r, gr, b);
  }
  const g = cv.getContext('2d');
  cv.width = w * K;
  cv.height = h * K;
  if (!part && !drawSceneArt(g, 'meadow', w * K, 14 * K)) return false;
  g.save();
  g.scale(K, K);
  const ok = paintTerrainOnce(g, { W: w, H: h, mat: rec.mat, bg, shade: rec.shade, biome: 'meadow', patterns: false, tone: i => rec.tone[i] });
  if (!ok) {
    g.restore();
    return false;
  }
  for (let k = 0; k < blocks.length; k += 4) {
    g.fillStyle = `rgb(${blocks[k + 1]},${blocks[k + 2]},${blocks[k + 3]})`;
    const i = blocks[k];
    g.fillRect(i % w, Math.floor(i / w), 1.02, 1.02);
  }
  // warm light of the lanterns, and the lava far down in chapter 2
  for (const [x, y] of lanterns) {
    const glow = g.createRadialGradient(x, y, 1, x, y, 24);
    glow.addColorStop(0, 'rgba(255,214,120,0.42)');
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    g.fillStyle = glow;
    g.fillRect(x - 26, y - 26, 52, 52);
  }
  if (part) {
    const pool = g.createLinearGradient(0, h - 8, 0, h);
    pool.addColorStop(0, '#ffb03a');
    pool.addColorStop(1, '#e8501a');
    g.fillStyle = pool;
    g.beginPath();
    g.moveTo(w - 70, h);
    for (let x = w - 70; x <= w; x += 2) g.lineTo(x, h - 6 + Math.sin(x / 5) * 1.5);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    const glow = g.createLinearGradient(0, h - 26, 0, h);
    glow.addColorStop(0, 'rgba(255,106,26,0)');
    glow.addColorStop(1, 'rgba(255,106,26,0.35)');
    g.fillStyle = glow;
    g.fillRect(w - 90, h - 26, 90, 26);
  }
  g.restore();
  cv.classList.add('painted');
  return true;
}

// the shaft of a chapter. ids: its levels; card(id): a level card (levelselect.js); open(id),
// next: which are open and where it goes on; part: 0 for chapter 1 (from the surface), 1 deeper
function mineShaft(ids, { card, open, next, part }) {
  const H = Math.round(Math.min(340, Math.max(232, innerHeight * 0.58))),
    W = LEFT + (ids.length - 1) * STEP + ST_W + 40,
    box = document.createElement('div');
  box.className = 'ls-cards ls-mine';
  box.style.height = H + 'px';
  const cv = document.createElement('canvas');
  cv.className = 'ls-ground';
  cv.width = Math.ceil(W / S);
  cv.height = Math.ceil(H / S);
  cv.style.width = cv.width * S + 'px';
  cv.style.height = cv.height * S + 'px';
  box.appendChild(cv);
  // where the stations stand (screen pixels: their top left), from high left to deep right
  const top = part ? 26 : 52,
    bottom = H - PORT - 44,
    pos = ids.map((_, k) => [LEFT + k * STEP, Math.round(top + (bottom - top) * (ids.length > 1 ? k / (ids.length - 1) : 0))]);
  // the porthole's middle, in landscape pixels: the tunnel runs from one to the next
  const mid = pos.map(([x, y]) => [Math.round((x + ST_W / 2) / S), Math.round((y + PORT / 2 + 6) / S)]);
  const g = cv.getContext('2d'),
    w = cv.width,
    h = cv.height;
  let last = -1;
  ids.forEach((id, k) => open(id) && (last = k));
  const lead = [[part ? 0 : mid[0][0] - 14, mid[0][1]], ...mid];
  const over = (g, plain = true) => {
    // dug as far as the last open level; past it, a crack to the end
    tunnel(g, lead, last < 0 ? lead[0][0] : mid[last][0], mid[mid.length - 1][0] + (part ? 20 : 8));
    if (!part) headframe(g, mid[0][0] - 14, Math.round(9 + Math.sin((mid[0][0] - 14) / 11) * 1.2), mid[0][1]);
    ids.forEach((id, k) => chamber(g, mid[k][0], mid[k][1], open(id), plain));
  };
  const lanterns = ids.map((id, k) => open(id) && [mid[k][0] + 14, mid[k][1] - 3]).filter(Boolean);
  if (!paintShaft(cv, w, h, part, over, lanterns)) {
    // (the pixel drawing, while the paintings are missing)
    cv.width = w;
    cv.height = h;
    ground(g, w, h, part ? 0.5 : 0, part ? 1 : 0.5, !part);
    if (part) lava(g, w, h);
    over(g, false);
  }
  // the stations
  ids.forEach((id, k) => {
    const c = card(id, { next });
    c.classList.add('ls-st');
    c.style.left = pos[k][0] + 'px';
    c.style.top = pos[k][1] + 'px';
    box.appendChild(c);
  });
  // your Wühler waits at the station where it goes on
  const at = ids.indexOf(next);
  if (at >= 0) {
    const wc = document.createElement('canvas');
    wc.className = 'ls-me';
    wc.width = 16;
    wc.height = 20;
    drawPortrait(wc.getContext('2d'), 0, 0, 1, P.cap || '#2f7fd0', P.hat, false, P.outfit, P.hero);
    wc.style.left = pos[at][0] - 22 + 'px';
    wc.style.top = pos[at][1] + PORT - 50 + 'px';
    box.appendChild(wc);
  }
  // (scrolled so the station where it goes on is in the middle, once it is on the screen)
  const focusAt = at >= 0 ? at : Math.max(0, last);
  requestAnimationFrame(() => (box.scrollLeft = Math.max(0, pos[focusAt][0] + ST_W / 2 - box.clientWidth / 2)));
  return box;
}

export { mineShaft };
