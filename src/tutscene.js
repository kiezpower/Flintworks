// What the tutorial world shows beyond its terrain (tutlevel.js, tutsteps.js): the village of
// Funkenhain (huts, the well, the cold hearth that burns again at the end), the Glutstein on its
// rock and in the Wühler's hands, the stones of the cave-in, the pointing finger at the spot of
// the current step, and the warm light that floods the scene when the fire is lit.
// drawTutScene is drawn behind the Wühler (decor.js), drawTutFront in front of everything and
// after the darkness (tutorial.js), so glows shine through it.
import { drawArrow } from './arrow.js';
import { beginGlow, endGlow, warmGlow } from './light.js';
import { sfx } from './sound.js';
import { G, parts } from './state.js';
import { TUT, at, caveFloor, glutSpot, ground } from './tutlevel.js';

const isTut = () => G.mode === 'tut';
const bob = (k = 0.15, a = 2) => (G.reduceMotion ? 0 : Math.sin(G.frame * k) * a);
function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
const glutState = () => (G.tut?.run?.glut) || (G.tutLit ? 'placed' : 'room');

// ---- small effects the steps use ----
let flashEl = null;
function flash(big = false) {
  if (!flashEl) {
    flashEl = document.createElement('div');
    flashEl.id = 'tutFlash';
    document.getElementById('game').appendChild(flashEl);
  }
  flashEl.className = '';
  void flashEl.offsetWidth; // (restarts the animation)
  flashEl.className = big ? 'big' : 'on';
}
// a few motes rising from a spot
function sparkle(x, y, c = '#fff3c0') {
  for (let k = 0; k < 3; k++) parts.push({ x: x + (Math.random() - 0.5) * 6, y: y - 1, vx: 0, vy: -0.12 - Math.random() * 0.1, l: 30, c, g: 0 });
}

// ---- the cave-in: stones loosen from the ceiling (dust first), fall and burst on the floor ----
const rocks = [];
function dropRock(x, warn = 30) {
  if (rocks.length > 10) return;
  x = Math.max(TUT.hall.x0 + 2, Math.min(TUT.hall.x1 - 4, Math.round(x)));
  rocks.push({ x, y: at(TUT.cave.top), vy: 0, warn: G.reduceMotion ? warn + 10 : warn, s: 3 + ((Math.random() * 2) | 0) });
}
const clearRocks = () => (rocks.length = 0);
// moves the stones; true when one hit the Wühler c
function updRocks(c) {
  let hit = false;
  const floor = caveFloor();
  for (let k = rocks.length - 1; k >= 0; k--) {
    const r = rocks[k];
    if (r.warn > 0) {
      r.warn--;
      if (r.warn % 4 === 0) parts.push({ x: r.x + Math.random() * r.s, y: r.y + 1, vx: 0, vy: 0.4, l: 26, c: '#a08a70', g: 0.04 });
      continue;
    }
    r.vy = Math.min(3.4, r.vy + 0.2);
    r.y += r.vy;
    const inBox = r.x + r.s > c.x && r.x < c.x + 6 && r.y + r.s > c.y && r.y < c.y + 10;
    if (inBox || r.y + r.s >= floor) {
      for (let q = 0; q < 8; q++)
        parts.push({ x: r.x + 1, y: r.y + r.s - 1, vx: (Math.random() - 0.5) * 1.6, vy: -Math.random() * 1.2, l: 22, c: q % 2 ? '#8a847c' : '#b7a58c', g: 0.06 });
      sfx(inBox ? 'hurt' : 'thud', r.x, r.y);
      if (inBox) hit = true;
      rocks.splice(k, 1);
    }
  }
  return hit;
}

// ---- behind the Wühler: village, well, hearth, Glutstein on its rock, falling stones ----
function drawTutScene(ctx, cx, cy) {
  if (!isTut()) return;
  const gy = ground() + 1 - cy;
  const lit = !!G.tutLit;
  for (const h of TUT.huts) hut(ctx, h.x - cx, gy, h.w, h.h, lit, cx, cy);
  well(ctx, TUT.well.x - cx, gy);
  hearth(ctx, TUT.hearth.x - cx, gy, lit, cx, cy);
  if (glutState() === 'room') {
    const g = glutSpot();
    glutstein(ctx, g.x - cx, g.y - cy + bob(0.08, 0.6));
  }
  for (const r of rocks) {
    const x = r.x - cx,
      y = r.y - cy;
    if (r.warn > 0) {
      // a crack in the ceiling where it will come down, and its shadow on the floor
      px(ctx, x - 1, y, r.s + 2, 1, '#2a1a10');
      if (r.warn % 8 < 4) px(ctx, x, y + 1, r.s, 2, '#a08a70');
      px(ctx, x - 1, caveFloor() - 1 - cy, r.s + 2, 1, `rgba(0,0,0,${(0.6 - r.warn / 80).toFixed(2)})`);
      continue;
    }
    px(ctx, x, y, r.s, r.s, '#8a837a');
    px(ctx, x, y, r.s, 1, '#c2b8aa');
    px(ctx, x + r.s - 1, y + 1, 1, r.s - 1, '#5e5852');
  }
}
function hut(ctx, x, gy, w, h, lit, cx, cy) {
  if (x < -30 || x > G.VW + 30) return;
  px(ctx, x, gy - h, w, h, '#6e5440');
  for (let k = 0; k < h; k += 3) px(ctx, x, gy - h + k, w, 1, '#5e4636'); // planks
  for (let k = 0; k < Math.ceil(w / 2) + 2; k++) px(ctx, x - 2 + k, gy - h - k, w + 4 - 2 * k, 1, k % 2 ? '#8a3a2a' : '#9c4632');
  // the window: dark while the fire is out, warm when it burns again
  px(ctx, x + 3, gy - h + 4, 4, 3, '#3a2a1e');
  px(ctx, x + 4, gy - h + 5, 2, 1, lit ? '#ffd27a' : '#1a1410');
  px(ctx, x + 3, gy - h + 4, 4, 1, lit ? '#ffb03c' : '#2a1d14');
  px(ctx, x + w - 6, gy - 8, 4, 8, '#3b2a1e');
  px(ctx, x + w - 5, gy - h - Math.ceil(w / 2) + 1, 2, 5, '#5b4b44');
  if (lit && G.frame % 20 === 0) parts.push({ x: x + w - 4 + cx, y: gy - h - w / 2 - 2 + cy, vx: 0.05, vy: -0.25, l: 60, c: '#8c8c90', g: -0.002 });
}
function well(ctx, x, gy) {
  if (x < -20 || x > G.VW + 20) return;
  px(ctx, x - 6, gy - 6, 12, 6, '#7a7a80');
  for (let k = 0; k < 12; k += 3) px(ctx, x - 6 + k, gy - 6 + (k % 2), 2, 2, '#5e5e64');
  px(ctx, x - 6, gy - 6, 12, 1, '#a6a6ac');
  px(ctx, x - 5, gy - 16, 1, 10, '#5a3e28');
  px(ctx, x + 4, gy - 16, 1, 10, '#5a3e28');
  for (let k = 0; k < 7; k++) px(ctx, x - 7 + k, gy - 17 - Math.min(k, 6 - k), 14 - 2 * k, 1, k % 2 ? '#8a3a2a' : '#9c4632');
  px(ctx, x - 1, gy - 15, 1, 5 + Math.round(bob(0.05, 1)), '#c9b89a'); // the rope
  px(ctx, x - 2, gy - 10 + Math.round(bob(0.05, 1)), 3, 2, '#6e5440'); // the bucket
}
function hearth(ctx, x, gy, lit, cx, cy) {
  if (x < -30 || x > G.VW + 30) return;
  // a pile of firewood beside it, logs in the middle and a ring of stones
  for (let k = 0; k < 3; k++) px(ctx, x + 10 + k, gy - 2 - k * 2, 6 - k * 2, 2, k % 2 ? '#7a5234' : '#6a4428');
  px(ctx, x - 4, gy - 2, 8, 1, '#4a3020');
  px(ctx, x - 3, gy - 3, 6, 1, '#5a3a24');
  for (let k = 0; k < 7; k++) {
    const sx = x - 8 + Math.round(k * 2.5),
      up = k === 0 || k === 6 ? 0 : 1;
    px(ctx, sx, gy - 2 - up, 2, 2 + up, k % 2 ? '#6d6a66' : '#8a8680');
    px(ctx, sx, gy - 2 - up, 2, 1, '#a8a49c');
  }
  if (!lit) {
    // cold grey ashes, and a thin thread of smoke now and then
    px(ctx, x - 2, gy - 4, 4, 1, '#6a6660');
    px(ctx, x - 1, gy - 5, 2, 1, '#55524e');
    if (G.frame % 70 === 0) parts.push({ x: x + cx, y: gy - 6 + cy, vx: 0.02, vy: -0.15, l: 70, c: '#6f6a66', g: -0.001 });
    return;
  }
  // the fire: a flickering heart with the Glutstein glowing at its foot
  const t = G.frame;
  px(ctx, x - 1, gy - 4, 3, 2, '#ffcf4a');
  for (let k = -3; k <= 3; k++) {
    const h = Math.max(1, Math.round(6 - Math.abs(k) * 1.4 + Math.sin(t * 0.3 + k * 1.7) * 1.5));
    px(ctx, x + k, gy - 3 - h, 1, h, Math.abs(k) > 1 ? '#e0572f' : '#ff9a2a');
    if (Math.abs(k) < 2) px(ctx, x + k, gy - 3 - Math.max(1, h - 2), 1, Math.max(1, h - 3), '#ffe27a');
  }
  if (t % 5 === 0)
    parts.push({ x: x + cx + (Math.random() - 0.5) * 4, y: gy - 8 + cy, vx: (Math.random() - 0.5) * 0.3, vy: -0.4 - Math.random() * 0.4, l: 40, c: Math.random() < 0.5 ? '#ffcf4a' : '#ff7a2a', g: -0.004 });
}
function glutstein(ctx, x, y) {
  const p = 0.5 + 0.5 * Math.sin(G.frame * 0.09);
  px(ctx, x - 2, y - 2, 5, 4, '#b8361e');
  px(ctx, x - 1, y - 3, 3, 1, '#e0572f');
  px(ctx, x - 1, y - 1, 3, 2, p > 0.5 ? '#ffcf4a' : '#ff9a2a');
  px(ctx, x, y - 1, 1, 1, '#fff6c0');
}

// ---- in front: glows, the carried Glutstein, the finger, the light of the finale ----
function drawTutFront(ctx, cx, cy, c, target) {
  if (!isTut()) return;
  const g = glutState(),
    pulse = 0.75 + 0.25 * Math.sin(G.frame * 0.09);
  beginGlow(ctx);
  if (g === 'room') {
    const s = glutSpot();
    warmGlow(ctx, s.x - cx, s.y - cy, 44, 0.75 * pulse);
  }
  if (g === 'carried' && c) warmGlow(ctx, c.x + 3 - cx, c.y - 4 - cy, 30, 0.5 * pulse);
  if (G.tutLit) warmGlow(ctx, TUT.hearth.x - cx, ground() - 4 - cy, 46, 0.6 * pulse);
  endGlow(ctx);
  if (g === 'carried' && c) glutstein(ctx, c.x + 3 - cx, c.y - 3 - cy + bob(0.2, 0.5));
  if (target) pointAt(ctx, target.x - cx, target.y - cy, target.finger);
  if (G.tutLit) flood(ctx, cx, cy);
}
// a white glove pointing down at the spot (when it is on screen), else the yellow edge arrow
function pointAt(ctx, x, y, finger) {
  const m = 6,
    on = x > m && x < G.VW - m && y > m + 10 && y < G.VH - m;
  if (!finger || !on) return drawArrow(ctx, x, y);
  const fx = Math.round(x) - 5,
    fy = Math.round(y - 2 - Math.abs(bob(0.16, 3))) - HAND.length;
  for (let r = 0; r < HAND.length; r++)
    for (let k = 0; k < HAND[r].length; k++) {
      const col = HAND_COL[HAND[r][k]];
      if (col) px(ctx, fx + k, fy + r, 1, 1, col);
    }
}
// a white glove pointing down, with a red cuff (R cuff, X outline, W glove, S its shade)
const HAND = [
  '..RRRRRR..',
  '.XWWWWWWX.',
  'XWWWWWWWSX',
  'XWWWWWWWSX',
  'XWWXWWXWSX',
  '.XXXWSXXX.',
  '...XWSX...',
  '...XWSX...',
  '...XWSX...',
  '....XX....',
];
const HAND_COL = { R: '#d04a2a', X: '#24160c', W: '#ffffff', S: '#d6cdbd' };
// the hearth is burning: warm light spreads over the whole view, then settles
function flood(ctx, cx, cy) {
  const t = (G.frame - G.tutLit) / 60;
  if (t < 0 || t > 4) return;
  const a = t < 0.4 ? t / 0.4 : Math.max(0, 1 - (t - 0.4) / 3.6),
    r = 20 + Math.min(1, t / 1.2) * Math.max(G.VW, G.VH) * 1.3;
  const x = TUT.hearth.x - cx,
    y = ground() - 4 - cy;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,220,140,${(0.6 * a).toFixed(3)})`);
  gr.addColorStop(0.5, `rgba(255,160,60,${(0.35 * a).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, G.VW, G.VH);
  ctx.restore();
}

G.drawTutScene = drawTutScene;

export { clearRocks, drawTutFront, drawTutScene, dropRock, flash, sparkle, updRocks };
