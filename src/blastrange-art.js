import { T, TEX } from './tex.js';
import { drawItemBig } from './sprites.js';
import { drawPortrait } from './portrait.js';
import { P } from './profile.js';
import { HEIGHT, ORIGIN, WIDTH, busy, finished, surface, trajectory } from './blastrange-model.js';

// Two texels per landscape cell, just like the main game. Repaint terrain only after a blast.
export function rangePainter(canvas) {
  canvas.width = WIDTH * 2; canvas.height = HEIGHT * 2;
  const g = canvas.getContext('2d'), terrain = document.createElement('canvas');
  terrain.width = canvas.width; terrain.height = canvas.height;
  let dirty = true;
  function repaint(s) {
    const tg = terrain.getContext('2d'), img = tg.createImageData(terrain.width, terrain.height), px = new Uint32Array(img.data.buffer);
    for (let y = 0; y < HEIGHT * 2; y++) for (let x = 0; x < WIDTH * 2; x++) {
      const m = s.cells[(y >> 1) * WIDTH + (x >> 1)];
      px[y * WIDTH * 2 + x] = m ? TEX[m][(y & (T - 1)) * T + (x & (T - 1))] : 0;
    }
    tg.putImageData(img, 0, 0); dirty = false;
  }
  return (s, reducedMotion = false) => {
    if (s.events.length) dirty = true;
    if (dirty) repaint(s);
    g.setTransform(2, 0, 0, 2, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = s.course.sky; g.fillRect(0, 0, WIDTH, HEIGHT);
    // A painted cut through the mine: dark backing is revealed by the blasts.
    for (let x = 0; x < WIDTH; x++) {
      g.fillStyle = s.course.backing; g.fillRect(x, surface(x), 1, HEIGHT);
      if (s.cells[surface(x) * WIDTH + x]) { g.fillStyle = '#62865d'; g.fillRect(x, surface(x) - 1, 1, 2); }
    }
    g.drawImage(terrain, 0, 0, WIDTH, HEIGHT);
    drawPortrait(g, 11, surface(16) - 20, 1, P.cap, P.hat, false, P.outfit);
    // Stocked powder kegs are visible in the cross-section, including their fuses.
    for (const b of s.barrels) if (!b.spent) {
      const x = b.x - 3, y = b.y - 4;
      g.fillStyle = '#24160c'; g.fillRect(x - 1, y, 8, 9);
      g.fillStyle = b.due != null ? '#e99440' : '#a14532'; g.fillRect(x, y, 6, 8);
      g.fillStyle = '#e5c58c'; g.fillRect(x, y + 2, 6, 1); g.fillRect(x, y + 6, 6, 1);
      g.fillStyle = '#ffe699'; g.fillRect(x + 3, y - 2, 1, 2);
    }
    if (!busy(s) && !finished(s)) {
      g.fillStyle = '#fff2bd';
      for (const [x, y] of trajectory(s)) g.fillRect(Math.round(x), Math.round(y), 1, 1);
      g.strokeStyle = '#fff2bd'; g.lineWidth = 1;
      g.strokeRect(s.target - 3, surface(s.target) - 4, 6, 6);
    }
    if (s.bomb) {
      drawItemBig(g, 'tnt', Math.round(s.bomb.x) - 2, Math.round(s.bomb.y) - 2, 5, 6);
      g.fillStyle = '#ffe699'; g.fillRect(Math.round(s.bomb.x) + 1, Math.round(s.bomb.y) - 4, 1, 1);
    }
    if (!reducedMotion) for (const b of s.blasts) {
      // Sparse, hard-edged rings keep the craters visible; no full-screen flash or shake.
      const r = b.radius * (1 - b.life / 22);
      g.fillStyle = b.life > 12 ? '#ffe08a' : '#c37745';
      for (let k = 0; k < 20; k++) {
        const a = k * Math.PI / 10;
        g.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r), 2, 2);
      }
    }
    g.fillStyle = '#24160c'; g.fillRect(0, HEIGHT - 2, WIDTH, 2);
    g.fillStyle = '#c8ab7f'; g.fillRect(ORIGIN.x - 2, ORIGIN.y + 5, 4, 1);
  };
}
