// Lobby backdrop in the style of the classic Clonk menus: a cut through the landscape with
// sky, mountains, the castle on a hill, tunnels with Wühlern at work and ore in the ground.
// The canvas fills the whole lobby; it has double resolution like the game view.
import { BIOMES } from './biomes.js';
import { drawClonkHi } from './clonkhi.js';
import { drawPortrait } from './portrait.js';
import { SPR, drawHi, treeSprite } from './sprites.js';
import { T, TEX, TUNNEL } from './tex.js';

let LW = 200,
  LH = 110;
let terrain = null,
  terrainKey = '';
const HERO = { x: 0.36 }; // hero position as a fraction of the width

const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const groundY = x =>
  Math.round(LH * 0.6 - 7 * Math.exp(-(((x - LW * HERO.x) / (LW * 0.18)) ** 2)) + Math.sin(x * 0.07) * 2);

// tunnels: from the hill down to a cave on the right, plus a small side cave on the left
function tunnelAt(x, y) {
  const x0 = LW * (HERO.x + 0.06),
    y0 = groundY(x0) + 4;
  if (x > x0 && x < LW * 0.75) {
    const ty = y0 + (x - x0) * 0.42;
    if (y > ty - 5 && y < ty + 6) return true;
  }
  const cx = LW * 0.78,
    cy = LH * 0.6 + (LW * 0.75 - x0) * 0.42 + 4;
  if (((x - cx) / 16) ** 2 + ((y - cy) / 8) ** 2 < 1) return true;
  if (((x - LW * 0.14) / 12) ** 2 + ((y - LH * 0.86) / 6) ** 2 < 1) return true;
  return false;
}
function blobAt(x, y) {
  const blobs = [
    [0.27, 0.8, 6, 3.5, 3],
    [0.58, 0.9, 5, 3, 3],
    [0.93, 0.78, 7, 4, 2],
    [0.08, 0.72, 6, 4, 11],
    [0.5, 0.97, 9, 3, 11],
    [0.66, 0.74, 5, 3, 10],
    [0.88, 0.96, 3, 2, 13],
  ];
  for (const [bx, by, rx, ry, m] of blobs) if (((x - LW * bx) / rx) ** 2 + ((y - LH * by) / ry) ** 2 < 1) return m;
  return 0;
}

// the static part (ground, tunnels, ore, castle, trees) is painted once per size and world type
function buildTerrain(biomeName) {
  const b = BIOMES[biomeName] || BIOMES.meadow;
  const c = document.createElement('canvas');
  c.width = LW * 2;
  c.height = LH * 2;
  const g = c.getContext('2d');
  const id = g.createImageData(c.width, c.height);
  const px = new Uint32Array(id.data.buffer);
  const top = b.top.map(rgb);
  const pack = (r, gg, bb) => (255 << 24) | (bb << 16) | (gg << 8) | r;
  const shade = (v, k) => {
    const r = Math.min(255, (v & 255) * k),
      gg = Math.min(255, ((v >> 8) & 255) * k),
      bb = Math.min(255, ((v >> 16) & 255) * k);
    return pack(r | 0, gg | 0, bb | 0) >>> 0;
  };
  for (let Y = 0; Y < c.height; Y++)
    for (let X = 0; X < c.width; X++) {
      const x = X >> 1,
        y = Y >> 1,
        gy = groundY(x);
      if (y < gy) continue;
      const ti = (Y & (T - 1)) * T + (X & (T - 1));
      let col;
      if (tunnelAt(x, y)) {
        // tunnel back wall, darker near the edges
        const edge = !tunnelAt(x, y - 2) || !tunnelAt(x, y + 2) || !tunnelAt(x - 2, y) || !tunnelAt(x + 2, y);
        col = shade(TUNNEL[ti], edge ? 0.6 : 0.85);
      } else {
        const m = blobAt(x, y);
        if (y - gy < 3) {
          const k = top[(X * 7 + Y * 3) % 4];
          col = pack(k[0], k[1], k[2]);
        } else col = (TEX[m || (biomeName === 'desert' && y - gy < 9 ? 4 : 1)] || TEX[1])[ti];
        // rim light on the surface, shadow under tunnel ceilings
        if (Y === gy * 2) col = shade(col, 1.3);
        else if (tunnelAt(x, y + 1) && Y & 1) col = shade(col, 0.6);
      }
      px[Y * c.width + X] = col >>> 0;
    }
  g.putImageData(id, 0, 0);
  // surface objects at landscape scale
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.imageSmoothingEnabled = false;
  const castleX = Math.round(LW * (HERO.x > 0.4 ? 0.04 : 0.1));
  drawHi(g, SPR.base, castleX, groundY(castleX + 18) - SPR.base.height + 1);
  const treeType = biomeName === 'desert' ? 'cactus' : biomeName === 'winter' ? 'snowpine' : 'oak';
  for (const [fx, stage, type] of [
    [0.5, 3, treeType],
    [0.56, 2, treeType === 'oak' ? 'pine' : treeType],
    [0.86, 4, treeType === 'oak' ? 'pine' : treeType],
    [0.93, 2, treeType],
  ]) {
    if (Math.abs(fx - HERO.x) < 0.12) continue; // keep the hero free
    const s = treeSprite(type, stage),
      x = Math.round(LW * fx);
    drawHi(g, s, x - (s.width >> 1), groundY(x) - s.height + 1);
  }
  return c;
}

// mountains and hills far away, gently drifting
function drawSky(g, b, t) {
  const sk = g.createLinearGradient(0, 0, 0, LH * 0.6);
  sk.addColorStop(0, `rgb(${b.sky[0]})`);
  sk.addColorStop(1, `rgb(${b.sky[1]})`);
  g.fillStyle = sk;
  g.fillRect(0, 0, LW, LH);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let k = 0; k < 4; k++) {
    const x = ((t * (0.03 + k * 0.01) + k * 61) % (LW + 40)) - 20,
      y = 6 + k * 7;
    g.fillRect(Math.round(x), y, 14, 3);
    g.fillRect(Math.round(x) + 3, y - 2, 8, 2);
  }
  const layers = [
    [b.rock, 0.36, 18, 0.05],
    [b.hills[0], 0.48, 8, 0.11],
    [b.hills[1], 0.54, 5, 0.19],
  ];
  layers.forEach(([col, base, amp, f], k) => {
    g.fillStyle = col;
    for (let x = 0; x < LW; x++) {
      const wx = x + t * f * 0.2;
      const h =
        k === 0
          ? amp * (Math.abs(Math.sin(wx * 0.045)) * 0.7 + Math.abs(Math.sin(wx * 0.11 + 1)) * 0.3)
          : amp * (Math.sin(wx * 0.06 + k) * 0.5 + 0.5);
      const y = Math.round(LH * base - h);
      g.fillRect(x, y, 1, LH - y);
      if (k === 0 && h > amp * 0.75) {
        g.fillStyle = '#f4f8fb';
        g.fillRect(x, y, 1, 2);
        g.fillStyle = col;
      }
    }
  });
}

const helperA = { cap: '#2f7fd0', hurt: 0, dead: false, x: 5, inv: [], isel: 0, digDir: [0.9, 0.4] };
const helperB = { cap: '#3f9e4a', hurt: 0, dead: false, x: 9, inv: ['nug'], isel: 0 };
const dust = [];

function drawScene(g, opts) {
  const { t, biome, cap, hat, jumpY, spin, sparks } = opts;
  const b = BIOMES[biome] || BIOMES.meadow;
  const key = `${biome}|${LW}|${LH}`;
  if (key !== terrainKey) {
    terrain = buildTerrain(biome);
    terrainKey = key;
  }
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.imageSmoothingEnabled = false;
  drawSky(g, b, t);
  g.drawImage(terrain, 0, 0, LW, LH);
  // a Wühler digging at the end of the tunnel, another one walking with a gold nugget
  const x0 = LW * (HERO.x + 0.06),
    tx = LW * 0.68,
    ty = groundY(x0) + 4 + (tx - x0) * 0.42;
  helperA.anim = t * 0.3;
  helperA.digging = true;
  helperA.vx = 0;
  drawClonkHi(helperA, Math.round(tx) - 3, Math.round(ty) - 5, 1, g);
  if (t % 6 === 0)
    dust.push({ x: tx + 5, y: ty + 2, vx: Math.random() * 0.6, vy: -Math.random() * 0.6, l: 20, c: '#8a6a4a' });
  const walk = (t * 0.25) % 80;
  const wx = x0 + LW * 0.05 + (walk < 40 ? walk : 80 - walk) * 0.4;
  helperB.anim = t * 0.25;
  helperB.vx = 0.5;
  const wy = groundY(x0) + 4 + (wx - x0) * 0.42;
  drawClonkHi(helperB, Math.round(wx) - 3, Math.round(wy) - 5, walk < 40 ? 1 : -1, g);
  for (let k = dust.length - 1; k >= 0; k--) {
    const d = dust[k];
    d.x += d.vx;
    d.y += d.vy;
    d.vy += 0.04;
    if (--d.l <= 0) dust.splice(k, 1);
    g.fillStyle = d.c;
    g.fillRect(d.x, d.y, 0.5, 0.5);
  }
  // the hero on the hill: twice as big as in the game, bobbing and turning now and then
  const hx = Math.round(LW * HERO.x),
    hy = groundY(hx);
  const bob = jumpY < 0 ? 0 : Math.floor(t / 30) % 2;
  const f = spin > 0 ? (Math.floor(spin / 6) % 2 ? 1 : -1) : 1;
  // portrait texels at one landscape pixel each: 16×20, double the in-game size
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(hx - 6, hy - 1, 12, 1);
  drawPortrait(g, hx - 8, hy - 20 + bob + Math.round(jumpY), f, cap, hat, t % 240 < 6);
  for (let k = sparks.length - 1; k >= 0; k--) {
    const s = sparks[k];
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.03;
    if (--s.l <= 0) sparks.splice(k, 1);
    g.fillStyle = s.c;
    g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
  }
}

// canvas size follows the screen: about 5 screen pixels per landscape pixel
function sizeScene(cv) {
  const r = cv.getBoundingClientRect();
  if (!r.width) return false;
  const w = Math.max(150, Math.min(260, Math.round(r.width / 5)));
  const h = Math.round((w * r.height) / r.width);
  HERO.x = h > w ? 0.5 : 0.36;
  if (w === LW && h === LH) return false;
  LW = w;
  LH = h;
  cv.width = LW * 2;
  cv.height = LH * 2;
  return true;
}
// where the hero stands, in screen pixels relative to the canvas (for the invite slots and the name tag)
function heroScreen(cv) {
  const r = cv.getBoundingClientRect(),
    k = r.width / LW;
  const x = LW * HERO.x;
  return { x: x * k, y: groundY(Math.round(x)) * k, k };
}
const heroOrigin = () => ({ x: LW * HERO.x, y: groundY(Math.round(LW * HERO.x)) - 14 });

export { drawScene, heroOrigin, heroScreen, sizeScene };
