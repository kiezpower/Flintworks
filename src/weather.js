import { biome } from './biomes.js';
import { hurt, startTumble } from './clonk.js';
import { spawnItem } from './entities.js';
import { topSolid } from './gen.js';
import { explode, ignite } from './objects.js';
import { cam } from './render.js';
import { sfx } from './sound.js';
import { G, birds, clouds, crew, meteors, parts, trees } from './state.js';
import { toast } from './ui.js';
import { AIR, H, LIQ, SOLID, W, bg, clamp, mat, ri, rnd } from './world.js';

// ---- Weather & day ----
function updWeather() {
  G.dayT = (G.dayT + 1 / 36000) % 1; // one day = 10 minutes
  if (G.frame % 1500 === 0) G.windT = 0.25 + rnd() * 0.75;
  G.wind += ((G.rainT > 0 ? Math.min(1.2, G.windT + 0.35) : G.windT) - G.wind) * 0.002;
  for (const c of clouds) {
    c.x += c.vx;
    if (c.x > W + 60) c.x = -60;
  }
  for (const b of birds) {
    b.x += b.vx;
    b.ph += 0.25;
    b.y += Math.sin(b.ph * 0.2) * 0.08;
    if (b.x > W + 30) b.x = -30;
    if (b.x < -30) b.x = W + 30;
  }
  if (--G.meteorNext <= 0) {
    G.meteorNext = 9000 + rnd() * 9000;
    const n = ri(1, 3);
    for (let k = 0; k < n; k++) {
      const x = cam.x + rnd() * G.VW + (rnd() - 0.5) * 120;
      meteors.push({ x: x - 60, y: -10 - k * 30, vx: 1.1 + rnd() * 0.5, vy: 2.2 });
    }
    toast('Meteore am Himmel!');
    sfx('whoosh');
  }
  for (let k = meteors.length - 1; k >= 0; k--) {
    const m = meteors[k];
    m.x += m.vx;
    m.y += m.vy;
    parts.push({
      x: m.x,
      y: m.y,
      vx: (rnd() - 0.5) * 0.3,
      vy: -0.2,
      l: 18,
      c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f',
      g: -0.005,
    });
    if (rnd() < 0.4) parts.push({ x: m.x, y: m.y, vx: 0, vy: 0, l: 40, c: '#5d5852', g: -0.002 });
    const tx = Math.floor(m.x),
      ty = Math.floor(m.y);
    if (tx < 0 || tx >= W || ty >= H) {
      meteors.splice(k, 1);
      continue;
    }
    if (ty >= 0 && (SOLID[mat[ty * W + tx]] || LIQ[mat[ty * W + tx]])) {
      meteors.splice(k, 1);
      explode(m.x, m.y, 13);
      spawnItem('nug', m.x - 1, m.y - 4, (rnd() - 0.5) * 2, -2, 10);
      if (rnd() < 0.6) spawnItem('flint', m.x, m.y - 4, (rnd() - 0.5) * 2, -2, 10);
    }
  }
  if (G.rainT > 0) {
    G.rainT--;
    if (parts.length < 1800) {
      for (let k = 0; k < 5; k++) {
        const x = Math.floor(cam.x - 30 + rnd() * (G.VW + 60)),
          y = Math.max(0, Math.floor(cam.y) - 2);
        if (x < 0 || x >= W) continue;
        if (mat[y * W + x] === AIR && bg[y * W + x] === 0)
          parts.push(
            G.biome === 'winter'
              ? {
                  x,
                  y,
                  vx: (rnd() - 0.5) * 0.5,
                  vy: 0.6 + rnd() * 0.4,
                  g: 0,
                  l: 900,
                  c: '#ffffff',
                  rain: true,
                  snow: true,
                }
              : { x, y, vx: -0.35, vy: 2.5 + rnd(), l: 400, c: '#a9cdee', rain: true },
          );
      }
    }
    if (rnd() < 1 / 700) lightning();
    if (G.rainT === 0) {
      G.rainNext = 4000 + rnd() * 5000;
    }
  } else if (--G.rainNext <= 0) {
    G.rainT = (1300 + rnd() * 900) * biome().rain;
    toast(G.biome === 'winter' ? 'Es fängt an zu schneien' : 'Es fängt an zu regnen');
  }
}
function lightning() {
  const x = Math.floor(cam.x + 20 + rnd() * (G.VW - 40));
  if (x < 0 || x >= W) return;
  const gy = topSolid(x);
  const pts = [];
  let px0 = x;
  for (let y = Math.max(0, gy - 120); y < gy; y += 6) {
    px0 += Math.round((rnd() - 0.5) * 6);
    pts.push([px0, y]);
  }
  pts.push([x, gy]);
  G.bolt = { pts, l: 8 };
  G.shake = Math.max(G.shake, 4);
  sfx('thunder');
  for (const t of trees)
    if (!t.fall && Math.abs(t.x - x) < 10) {
      ignite(t);
      break;
    }
  for (const c of crew)
    if (!c.dead && Math.abs(c.x + 3 - x) < 8 && Math.abs(c.y + 10 - gy) < 14) {
      hurt(c, 30);
      startTumble(c, (rnd() - 0.5) * 3, -2);
      c.burn = 120;
    }
  for (let q = 0; q < 10; q++)
    parts.push({ x, y: gy - 1, vx: (rnd() - 0.5) * 2, vy: -rnd() * 2, l: 15, c: '#fff6c0' });
}
function sunAlt() {
  return Math.sin(2 * Math.PI * G.dayT);
}
function darkness() {
  return clamp((0.18 - sunAlt()) * 1.1, 0, 0.68);
}
function mixC(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
const SKY = {
  day: [
    [111, 169, 222],
    [215, 234, 242],
  ],
  dusk: [
    [214, 122, 92],
    [246, 196, 138],
  ],
  night: [
    [10, 18, 44],
    [34, 44, 82],
  ],
};
function skyCols() {
  const s = sunAlt();
  let top, bot;
  const day = biome().sky;
  if (s > 0.25) {
    top = day[0];
    bot = day[1];
  } else if (s > -0.05) {
    const t = (s + 0.05) / 0.3;
    top = mixC(SKY.dusk[0], day[0], t);
    bot = mixC(SKY.dusk[1], day[1], t);
  } else {
    const t = clamp((s + 0.35) / 0.3, 0, 1);
    top = mixC(SKY.night[0], SKY.dusk[0], t);
    bot = mixC(SKY.night[1], SKY.dusk[1], t);
  }
  if (G.rainT > 0) {
    const g = [120, 128, 138];
    top = mixC(top, g, 0.45);
    bot = mixC(bot, g, 0.45);
  }
  return [`rgb(${top})`, `rgb(${bot})`];
}

export { SKY, darkness, lightning, mixC, skyCols, sunAlt, updWeather };
