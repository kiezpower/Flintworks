import { paintTerrainOnce } from './terrainart.js';
import { T, TEX } from './tex.js';
import { drawItemBig } from './sprites.js';
import { drawPortrait } from './portrait.js';
import { P } from './profile.js';
import { HEIGHT, ORIGIN, WIDTH, busy, finished, surface, trajectory } from './blastrange-model.js';

// Four canvas pixels per landscape cell. The cut is painted with the game's material art
// (terrainart.js) and repainted only after a blast; without it, the pixel texels are used.
const K = 4;
export function rangePainter(canvas) {
  canvas.width = WIDTH * K; canvas.height = HEIGHT * K;
  const g = canvas.getContext('2d'), terrain = document.createElement('canvas');
  terrain.width = canvas.width; terrain.height = canvas.height;
  let dirty = true, painted = false;
  function repaint(s) {
    const tg = terrain.getContext('2d');
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, terrain.width, terrain.height);
    // (what the blasts took away shows the back wall of the mine)
    const bg = new Uint8Array(WIDTH * HEIGHT), shade = new Uint8Array(WIDTH * HEIGHT);
    for (let x = 0; x < WIDTH; x++) {
      const top = surface(x);
      for (let y = top; y < HEIGHT; y++) bg[y * WIDTH + x] = 1;
      for (let y = top; y < top + 2 && y < HEIGHT; y++) if (s.cells[y * WIDTH + x] === 1) shade[y * WIDTH + x] = 4;
    }
    tg.scale(K, K);
    painted = paintTerrainOnce(tg, { W: WIDTH, H: HEIGHT, mat: s.cells, bg, shade, biome: 'meadow', patterns: false, tone: i => (s.cells[i] ? 1 : 0.8) });
    if (!painted) {
      tg.setTransform(1, 0, 0, 1, 0, 0);
      const lo = document.createElement('canvas'); lo.width = WIDTH * 2; lo.height = HEIGHT * 2;
      const lg = lo.getContext('2d'), img = lg.createImageData(lo.width, lo.height), px = new Uint32Array(img.data.buffer);
      for (let y = 0; y < HEIGHT * 2; y++) for (let x = 0; x < WIDTH * 2; x++) {
        const m = s.cells[(y >> 1) * WIDTH + (x >> 1)];
        px[y * WIDTH * 2 + x] = m ? TEX[m][(y & (T - 1)) * T + (x & (T - 1))] : 0;
      }
      lg.putImageData(img, 0, 0); tg.imageSmoothingEnabled = false; tg.drawImage(lo, 0, 0, terrain.width, terrain.height);
    }
    dirty = false;
  }
  const keg = (x, y, lit) => {
    // a powder keg: staves with two iron hoops and a fuse
    const wood = g.createLinearGradient(x, 0, x + 6, 0);
    wood.addColorStop(0, lit ? '#f0a252' : '#b5553a'); wood.addColorStop(0.5, lit ? '#e99440' : '#a14532'); wood.addColorStop(1, lit ? '#b8642a' : '#6e2c20');
    g.fillStyle = wood; g.strokeStyle = '#24160c'; g.lineWidth = 0.6;
    g.beginPath(); g.roundRect(x, y, 6, 8, 1.6); g.fill(); g.stroke();
    g.fillStyle = '#e5c58c'; g.fillRect(x + 0.3, y + 1.8, 5.4, 0.8); g.fillRect(x + 0.3, y + 5.6, 5.4, 0.8);
    g.strokeStyle = '#3a2a1e'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x + 3, y); g.quadraticCurveTo(x + 3.6, y - 1.6, x + 4.4, y - 2); g.stroke();
    g.fillStyle = lit ? '#fff2a0' : '#ffe699'; g.beginPath(); g.arc(x + 4.4, y - 2, lit ? 0.9 : 0.5, 0, 7); g.fill();
  };
  return (s, reducedMotion = false) => {
    if (s.events.length) dirty = true;
    if (dirty) repaint(s);
    g.setTransform(K, 0, 0, K, 0, 0); g.imageSmoothingEnabled = true;
    const sky = g.createLinearGradient(0, 0, 0, HEIGHT * 0.5);
    sky.addColorStop(0, s.course.sky); sky.addColorStop(1, '#f1e6cf');
    g.fillStyle = sky; g.fillRect(0, 0, WIDTH, HEIGHT);
    if (!painted) for (let x = 0; x < WIDTH; x++) {
      g.fillStyle = s.course.backing; g.fillRect(x, surface(x), 1, HEIGHT);
      if (s.cells[surface(x) * WIDTH + x]) { g.fillStyle = '#62865d'; g.fillRect(x, surface(x) - 1, 1, 2); }
    }
    g.drawImage(terrain, 0, 0, WIDTH, HEIGHT);
    drawPortrait(g, 11, surface(16) - 20, 1, P.cap, P.hat, false, P.outfit, P.hero);
    // Stocked powder kegs are visible in the cross-section, including their fuses.
    for (const b of s.barrels) if (!b.spent) keg(b.x - 3, b.y - 4, b.due != null);
    if (!busy(s) && !finished(s)) {
      g.fillStyle = '#fff2bd';
      for (const [x, y] of trajectory(s)) { g.beginPath(); g.arc(x + 0.5, y + 0.5, 0.6, 0, 7); g.fill(); }
      g.strokeStyle = '#fff2bd'; g.lineWidth = 0.7;
      g.beginPath(); g.roundRect(s.target - 3, surface(s.target) - 4, 6, 6, 1.5); g.stroke();
    }
    if (s.bomb) {
      drawItemBig(g, 'tnt', Math.round(s.bomb.x) - 2, Math.round(s.bomb.y) - 2, 5, 6);
      g.fillStyle = '#ffe699'; g.fillRect(Math.round(s.bomb.x) + 1, Math.round(s.bomb.y) - 4, 1, 1);
    }
    if (!reducedMotion) for (const b of s.blasts) {
      // Sparse, hard-edged rings keep the craters visible; no full-screen flash or shake.
      const r = b.radius * (1 - b.life / 22);
      g.strokeStyle = b.life > 12 ? '#ffe08a' : '#c37745'; g.lineWidth = 1.4; g.setLineDash([2, 3]);
      g.beginPath(); g.arc(b.x, b.y, Math.max(0.5, r), 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = '#24160c'; g.fillRect(0, HEIGHT - 2, WIDTH, 2);
    g.fillStyle = '#c8ab7f'; g.fillRect(ORIGIN.x - 2, ORIGIN.y + 5, 4, 1);
  };
}
