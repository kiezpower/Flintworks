import { tr } from './i18n.js';
import { drawTerrainArt, invalidateTerrainArt } from './terrainart.js';
import { drawSceneArt } from './sceneart.js';
import { objectArtReady } from './objectart.js';
// Lobby backdrop in the style of classic game menus: a cut through the landscape with
// sky, mountains, the castle on a hill, tunnels and ore in the ground. The ground is a real
// little world: the lobby workers (lobbyworkers.js) dig through it and carry the ore home.
// The canvas fills the whole lobby; it has double resolution like the game view.
import { parseSkin } from './skins.js';
import { BIOMES } from './biomes.js';
import { drawPortrait } from './portrait.js';
import { SPR, drawHi, treeSprite } from './sprites.js';
import { drawCrafted } from './bldart.js';
import { T, TEX, TUNNEL } from './tex.js';
import { drawWorkers, resetWorkers, updWorkers } from './lobbyworkers.js';

const EARTH = 1,
  GOLD = 3,
  ORE = 10,
  COAL = 11,
  GEM = 13;
// shared with the workers
const land = { LW: 200, LH: 110, cells: null, round: 0, castleX: 20, heroX: 72, groundY: null, dig: null };
let terrain = null, // ground with tunnels (repainted where the workers dig)
  overlay = null, // castle and trees
  img = null,
  px = null,
  terrainKey = '',
  biomeName = 'meadow',
  dirty = false,
  topCols = [],
  paintedTerrain = null;
const HERO = { x: 0.5 };
let heroScale = 2;
objectArtReady.then(() => { terrainKey = ''; });
const podiumTop = () => groundY(land.heroX) - 3;
// Friends stand on either side of the hero, in landscape pixels.
const friendDx = () => [-Math.max(20, heroScale * 11), Math.max(20, heroScale * 11)];

const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const groundY = x =>
  Math.round(
    land.LH * 0.6 - 7 * Math.exp(-(((x - land.LW * HERO.x) / (land.LW * 0.18)) ** 2)) + Math.sin(x * 0.07) * 2,
  );
land.groundY = groundY;

// tunnels at the start: from the hill down to a cave on the right
function tunnelAt(x, y) {
  const { LW, LH } = land;
  const x0 = LW * 0.79,
    y0 = groundY(x0) + 4;
  if (x > x0 && x < LW * 0.93) {
    const ty = y0 + (x - x0) * 0.42;
    if (y > ty - 5 && y < ty + 6) return true;
  }
  const cx = LW * 0.93,
    cy = y0 + (LW * 0.93 - x0) * 0.42 + 2;
  return ((x - cx) / 13) ** 2 + ((y - cy) / 7) ** 2 < 1;
}
// ore blobs, new ones every round (the workers dig them out, then the ground is renewed)
function mkBlobs() {
  let s = (land.round * 9301 + 49297) % 233280;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const kinds = [GOLD, GOLD, COAL, ORE, GOLD, COAL, GEM];
  return kinds.map((m, k) => {
    // spread along the ground, not under the castle
    // (only where the menus do not cover the ground)
    const portrait = land.LH > land.LW;
    const x0 = land.castleX + 44,
      x1 = land.LW - 8,
      y1 = portrait ? land.LH * 0.66 : land.LH - 6;
    const x = x0 + ((k + 0.1 + r() * 0.8) / kinds.length) * (x1 - x0);
    const gy = groundY(Math.round(x));
    return [
      x,
      gy + 9 + r() * Math.max(4, y1 - gy - 12),
      m === GEM ? 3 : 4 + r() * 3,
      m === GEM ? 2 : 2.5 + r() * 1.5,
      m,
    ];
  });
}

// colour of one landscape cell (2×2 texels)
function paintCell(x, y) {
  const { LW, LH, cells } = land;
  if (x < 0 || y < 0 || x >= LW || y >= LH) return;
  const gy = groundY(x),
    m = cells[y * LW + x],
    W2 = LW * 2;
  const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const shade = (v, k) =>
    pack(
      Math.min(255, (v & 255) * k) | 0,
      Math.min(255, ((v >> 8) & 255) * k) | 0,
      Math.min(255, ((v >> 16) & 255) * k) | 0,
    );
  const solid = (a, b) => b >= gy && b < LH && a >= 0 && a < LW && cells[b * LW + a] !== 0;
  for (let Y = y * 2; Y < y * 2 + 2; Y++)
    for (let X = x * 2; X < x * 2 + 2; X++) {
      let col = 0;
      if (y >= gy) {
        const ti = (Y & (T - 1)) * T + (X & (T - 1));
        if (!m) {
          // tunnel back wall, darker along the edges
          const edge = solid(x, y - 2) || solid(x, y + 2) || solid(x - 2, y) || solid(x + 2, y);
          col = shade(TUNNEL[ti], edge ? 0.6 : 0.85);
        } else {
          if (y - gy < 3 && m === EARTH) {
            const k = topCols[(X * 7 + Y * 3) % 4];
            col = pack(k[0], k[1], k[2]);
          } else col = (TEX[m === EARTH && biomeName === 'desert' && y - gy < 9 ? 4 : m] || TEX[1])[ti] >>> 0;
          // rim light on the surface, shadow under tunnel ceilings
          if (Y === gy * 2) col = shade(col, 1.3);
          else if (y + 1 < LH && !cells[(y + 1) * LW + x] && Y & 1) col = shade(col, 0.6);
        }
      }
      px[Y * W2 + X] = col;
    }
}
function paintSoftTerrain() {
  const { LW, LH, cells } = land;
  const c = paintedTerrain || document.createElement('canvas');
  if (c.width !== LW * 8 || c.height !== LH * 8) { c.width = LW * 8; c.height = LH * 8; }
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.scale(8, 8);
  const soil = g.createLinearGradient(0, LH * 0.55, 0, LH);
  soil.addColorStop(0, biomeName === 'winter' ? '#827b69' : biomeName === 'desert' ? '#bc8551' : '#87633f');
  soil.addColorStop(1, '#382d27');
  const contour = () => {
    g.beginPath(); g.moveTo(0, groundY(0));
    for (let x = 0; x <= LW; x += 2) g.lineTo(x, groundY(x));
    g.lineTo(LW, LH); g.lineTo(0, LH); g.closePath();
  };
  contour(); g.fillStyle = soil; g.fill();
  g.save(); contour(); g.clip();
  // Low-contrast rounded mineral inclusions, deterministic across frames.
  for (let k = 0; k < LW * LH / 40; k++) {
    const x = (k * 47.73) % LW, y = (k * 31.17) % LH;
    g.fillStyle = k % 3 ? '#e5ce9a16' : '#191c2025';
    g.beginPath(); g.ellipse(x, y, 0.3 + (k % 4) * 0.13, 0.2 + (k % 3) * 0.12, k, 0, Math.PI * 2); g.fill();
  }
  const colors = { 3: '#e7b942', 10: '#b87452', 11: '#30373a', 13: '#65c9d3' };
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    if (y < groundY(x)) continue;
    const m = cells[y * LW + x];
    if (!m) {
      g.fillStyle = '#251e1b'; g.beginPath(); g.roundRect(x - 0.15, y - 0.15, 1.3, 1.3, 0.35); g.fill();
    } else if (colors[m]) {
      g.fillStyle = colors[m];
      g.beginPath(); g.ellipse(x + 0.5, y + 0.5, 0.65, 0.55, (x + y) * 0.7, 0, Math.PI * 2); g.fill();
      if ((x * 3 + y * 7) % 4 === 0) { g.fillStyle = '#fff5cf65'; g.beginPath(); g.arc(x + 0.35, y + 0.25, 0.2, 0, Math.PI * 2); g.fill(); }
    }
  }
  g.restore();
  // Flowing turf edge, with fine blades rather than enlarged green squares.
  g.strokeStyle = biomeName === 'winter' ? '#e9f3ee' : biomeName === 'desert' ? '#cdb978' : '#6f9d46';
  g.lineWidth = 1.6; g.lineJoin = 'round';
  g.beginPath(); for (let x = 0; x <= LW; x++) { if (!x) g.moveTo(x, groundY(x)); else g.lineTo(x, groundY(x)); } g.stroke();
  if (biomeName === 'meadow') {
    g.strokeStyle = '#a3bc69'; g.lineWidth = 0.18;
    g.beginPath(); for (let x = 0; x < LW; x += 0.9) { const y = groundY(x); g.moveTo(x, y); g.lineTo(x + 0.2, y - 0.4 - (x * 7 % 1)); } g.stroke();
  }
  paintedTerrain = c;
}

function dig(x, y) {
  const { LW, LH, cells } = land;
  if (x < 0 || y < 0 || x >= LW || y >= LH) return 0;
  const m = cells[y * LW + x];
  if (!m) return 0;
  cells[y * LW + x] = 0;
  for (let b = Math.max(0, (y - 2) >> 5); b <= (y + 2) >> 5; b++)
    for (let a = Math.max(0, (x - 2) >> 5); a <= (x + 2) >> 5; a++) invalidateTerrainArt(a, b);
  for (let b = y - 2; b <= y + 2; b++) for (let a = x - 2; a <= x + 2; a++) paintCell(a, b);
  dirty = true;
  return m;
}
land.dig = dig;

// the ground is built once per size, world type and round
function buildTerrain() {
  const { LW, LH } = land;
  land.castleX = Math.round(LW * (HERO.x > 0.4 ? 0.04 : 0.1));
  land.heroX = Math.round(LW * HERO.x);
  land.cells = new Uint8Array(LW * LH);
  land.artBg = new Uint8Array(LW * LH);
  land.artShade = new Uint8Array(LW * LH);
  const blobs = mkBlobs();
  for (let y = 0; y < LH; y++)
    for (let x = 0; x < LW; x++) {
      if (y < groundY(x)) continue;
      land.artBg[y * LW + x] = 1;
      if (y - groundY(x) < 2) land.artShade[y * LW + x] = 4;
      if (tunnelAt(x, y)) continue;
      let m = EARTH;
      for (const [bx, by, rx, ry, k] of blobs) if (((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 < 1) m = k;
      land.cells[y * LW + x] = m;
    }
  paintTerrain();
}
// colours and surface objects; a new world type only repaints, the dug tunnels stay
function paintTerrain() {
  const { LW, LH } = land;
  topCols = (BIOMES[biomeName] || BIOMES.meadow).top.map(rgb);
  terrain = document.createElement('canvas');
  terrain.width = LW * 2;
  terrain.height = LH * 2;
  const g = terrain.getContext('2d');
  img = g.createImageData(LW * 2, LH * 2);
  px = new Uint32Array(img.data.buffer);
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) paintCell(x, y);
  g.putImageData(img, 0, 0);
  paintSoftTerrain();
  // surface objects at landscape scale
  overlay = document.createElement('canvas');
  overlay.width = LW * 8;
  overlay.height = LH * 8;
  const o = overlay.getContext('2d');
  o.setTransform(8, 0, 0, 8, 0, 0);
  o.imageSmoothingEnabled = true;
  drawCrafted(o, SPR.base, land.castleX, groundY(land.castleX + 18) - SPR.base.height + 1);
  // Real building artwork keeps the lobby a place in the game, rather than a menu backdrop.
  for (const [type, fx] of [['saw', 0.23], ['lift', 0.88]]) {
    const s = SPR[type];
    if (!s) continue;
    const x = Math.round(LW * fx);
    drawCrafted(o, s, x, groundY(x + s.width / 2) - s.height + 1);
  }
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
    drawHi(o, s, x - (s.width >> 1), groundY(x) - s.height + 1);
  }
}
// all ore dug out: new ground for the next round
function renewGround() {
  land.round++;
  buildTerrain();
}
land.renew = renewGround;

// mountains and hills far away, gently drifting
function drawSky(g, b, t) {
  const { LW, LH } = land;
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

function drawScene(g, opts) {
  const { biome, cap, hat, outfit, hero, jumpY, spin, sparks, friends = [], reducedMotion = false, mastered = false, masterTitle = '' } = opts;
  const t = reducedMotion ? 0 : opts.t;
  const b = BIOMES[biome] || BIOMES.meadow;
  const key = `${land.LW}|${land.LH}`;
  if (key !== terrainKey) {
    biomeName = biome;
    buildTerrain();
    resetWorkers(land);
    terrainKey = key;
  } else if (biome !== biomeName) {
    biomeName = biome;
    paintTerrain();
  }
  if (!reducedMotion) updWorkers(land, t);
  if (dirty) {
    terrain.getContext('2d').putImageData(img, 0, 0);
    paintSoftTerrain();
    dirty = false;
  }
  const { LW, LH } = land;
  g.setTransform(g.canvas.width / land.LW, 0, 0, g.canvas.height / land.LH, 0, 0);
  g.imageSmoothingEnabled = false;
  if (!drawSceneArt(g, biome, LW, LH)) drawSky(g, b, t);
  g.imageSmoothingEnabled = true;
  g.drawImage(paintedTerrain || terrain, 0, 0, LW, LH);
  drawTerrainArt(g, 0, 0, LW, LH, { W: LW, H: LH, mat: land.cells, bg: land.artBg, shade: land.artShade, biome, patterns: false, tone: () => 0.93 });
  g.drawImage(overlay, 0, 0, LW, LH);
  drawWorkers(g, reducedMotion);
  // the hero on the hill: twice as big as in the game, bobbing and turning now and then
  const hx = land.heroX,
    hy = podiumTop();
  // Soft focus behind the real, customisable Wühler; no flattened menu artwork.
  const halo = g.createRadialGradient(hx, hy - 12 * heroScale, 0, hx, hy - 12 * heroScale, 20 * heroScale);
  halo.addColorStop(0, 'rgba(255,239,163,0.6)');
  halo.addColorStop(1, 'rgba(255,239,163,0)');
  g.fillStyle = halo;
  g.fillRect(hx - 22 * heroScale, hy - 34 * heroScale, 44 * heroScale, 36 * heroScale);
  // A smooth carved stone podium with a living grass edge.
  const half = 10 * heroScale;
  g.save();
  const stone = g.createLinearGradient(0, hy, 0, hy + 6);
  stone.addColorStop(0, '#c8c5a6'); stone.addColorStop(0.3, '#91917b'); stone.addColorStop(1, '#4c594d');
  g.fillStyle = '#283d32';
  g.beginPath(); g.roundRect(hx - half - 3, hy + 2, half * 2 + 6, 5, 2); g.fill();
  g.fillStyle = stone;
  g.beginPath(); g.roundRect(hx - half - 2, hy, half * 2 + 4, 5, 1.5); g.fill();
  g.strokeStyle = '#e6ddae'; g.lineWidth = 0.3;
  g.beginPath(); g.moveTo(hx - half, hy + 1); g.lineTo(hx + half, hy + 1); g.stroke();
  g.fillStyle = b.top[0];
  g.beginPath(); g.roundRect(hx - half - 1, hy - 1, half * 2 + 2, 1.7, 0.8); g.fill();
  g.restore();
  const bob = jumpY < 0 ? 0 : Math.floor(t / 30) % 2;
  const f = spin > 0 ? (Math.floor(spin / 6) % 2 ? 1 : -1) : 1;
  // portrait texels at one landscape pixel each: 16×20, double the in-game size
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(hx - 6, hy - 1, 12, 1);
  g.save();
  g.translate(hx, hy + bob + Math.round(jumpY));
  g.scale(heroScale * f, heroScale);
  g.imageSmoothingEnabled = true;
  drawPortrait(g, -8, -20, 1, cap, hat, !reducedMotion && t % 240 < 6, outfit, hero, mastered ? 'master' : null);
  g.restore();
  if (mastered && masterTitle) {
    g.save(); g.font = '600 4px "Nunito Sans", sans-serif'; g.textAlign = 'center';
    g.fillStyle = '#fff0b8'; g.fillText('★ ' + tr(masterTitle), hx, hy + 8); g.restore();
  }
  // friends in the room stand left and right of the hero, facing it
  friends.slice(0, 2).forEach((p, k) => {
    const fx = hx + friendDx()[k],
      fy = groundY(Math.round(fx));
    g.globalAlpha = p.online ? 1 : 0.45;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(fx - 6, fy - 1, 12, 1);
    drawPortrait(
      g,
      fx - 8,
      fy - 20 + (Math.floor(t / 30 + k) % 2),
      friendDx()[k] > 0 ? -1 : 1,
      p.cap,
      p.hat,
      !reducedMotion && (t + k * 90) % 240 < 6,
      parseSkin(p.skin).outfit,
      parseSkin(p.skin).hero,
    );
    g.globalAlpha = 1;
  });
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
  const heroX = 0.5;
  // Leave the top controls clear even on short landscape phones.
  const safeTop = window.innerWidth <= 600 ? 16 : 64;
  const feet = h * 0.6 - 10 + Math.sin(w * 0.5 * 0.07) * 2;
  heroScale = Math.max(1, Math.min(3.4, (h * 0.43) / 20, (feet - safeTop * w / r.width) / 20));
  const moved = HERO.x !== heroX;
  HERO.x = heroX;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(r.width * dpr), ph = Math.round(r.height * dpr);
  if (!moved && w === land.LW && h === land.LH && cv.width === pw && cv.height === ph) return false;
  if (moved) terrainKey = '';
  land.LW = w;
  land.LH = h;
  cv.width = pw;
  cv.height = ph;
  return true;
}
// where the hero stands, in screen pixels relative to the canvas (for the invite slots and the name tag)
function heroScreen(cv) {
  const r = cv.getBoundingClientRect(),
    k = r.width / land.LW;
  const x = land.LW * HERO.x;
  return { x: x * k, y: podiumTop() * k, k, scale: heroScale, height: 20 * heroScale * k };
}
const heroOrigin = () => ({ x: land.LW * HERO.x, y: podiumTop() - 14 * heroScale });

export { COAL, EARTH, GEM, GOLD, ORE, drawScene, friendDx, heroOrigin, heroScreen, sizeScene };
