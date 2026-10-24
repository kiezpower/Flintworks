// Living buildings: chimney smoke, sawdust, sparks, bubbling tanks and glowing windows at night.
import { SPR, itemIcon } from './sprites.js';
import { idleReason } from './store.js';
import { G, builds, parts } from './state.js';
import { rnd } from './world.js';

// chimney tops per building type: [x, y] relative to the sprite
const CHIMNEY = { hut: [16, 0], shop: [20, 0], furnace: [13, 0], chem: [4, 0], pump: [4, 0] };
const WIN_COLS = ['#ffd77a', '#ffb347', '#b6f28f'];

// window pixels are found once by scanning each sprite for the lit window colours
const winCache = {};
function windows(type) {
  if (winCache[type]) return winCache[type];
  const spr = SPR[type],
    out = [];
  if (spr) {
    const d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data;
    const want = WIN_COLS.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
    for (let y = 0; y < spr.height; y++)
      for (let x = 0; x < spr.width; x++) {
        const i = (y * spr.width + x) * 4;
        if (want.some(w => w[0] === d[i] && w[1] === d[i + 1] && w[2] === d[i + 2])) out.push(x, y);
      }
  }
  return (winCache[type] = out);
}

function smoke(x, y, dark, big) {
  parts.push({
    x: x + rnd() * 2,
    y,
    vx: G.wind * 0.22 + (rnd() - 0.5) * 0.1,
    vy: -0.25 - rnd() * 0.15,
    l: 70 + rnd() * 50,
    c: dark ? (rnd() < 0.5 ? '#4e4a46' : '#625d58') : rnd() < 0.5 ? '#c9c4bd' : '#a9a49d',
    g: -0.002,
    s: big ? 2 : 1,
  });
}

// particles, called every simulation step
function updBuildFx() {
  if (parts.length > 1500) return;
  for (const b of builds) {
    if (!b.done) continue;
    const top = b.gy - b.h,
      ch = CHIMNEY[b.type];
    const busy = b.busy > 0;
    if (ch) {
      const rate =
        b.type === 'furnace' ? (busy ? 4 : 60) : b.type === 'chem' ? (busy ? 8 : 0) : b.type === 'pump' ? 0 : 45;
      if (rate && G.frame % rate === 0) smoke(b.x + ch[0], top + ch[1], b.type === 'furnace', busy);
      if (b.type === 'chem' && busy && G.frame % 9 === 0)
        parts.push({ x: b.x + ch[0] + 1, y: top, vx: G.wind * 0.2, vy: -0.3, l: 60, c: '#a8e07a', g: -0.002 });
    }
    if (!busy) continue;
    if (b.type === 'saw' && G.frame % 3 === 0)
      parts.push({
        x: b.x + 13,
        y: top + 7,
        vx: -0.6 - rnd() * 0.8,
        vy: -0.6 - rnd() * 0.6,
        l: 25,
        c: rnd() < 0.5 ? '#e8c896' : '#d9b98a',
        g: 0.05,
      });
    if (b.type === 'furnace' && G.frame % 7 === 0)
      parts.push({
        x: b.x + 7 + rnd() * 4,
        y: top + 15,
        vx: (rnd() - 0.5) * 0.6,
        vy: -0.8 - rnd() * 0.8,
        l: 20,
        c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2a',
        g: 0.03,
      });
    if (b.type === 'shop' && G.frame % 11 === 0)
      parts.push({ x: b.x + 18, y: top + 9, vx: (rnd() - 0.5) * 1.2, vy: -0.9, l: 14, c: '#ffe066', g: 0.06 });
  }
}

// overlays drawn right after the building sprite
function drawBuildFx(ctx, b, sx, sy) {
  if (b.done && !(b.busy > 0)) {
    // idle production building: bubble with what it is waiting for
    const why = idleReason(b);
    if (why) {
      const bx = Math.round(sx + b.w / 2 - 6),
        by = Math.round(sy - 15 + Math.sin(G.frame * 0.08) * 1);
      ctx.fillStyle = '#24160c';
      ctx.fillRect(bx - 1, by - 1, 14, 13);
      ctx.fillStyle = why.full ? '#e8f4d8' : '#f4ead2';
      ctx.fillRect(bx, by, 12, 11);
      ctx.fillRect(bx + 4, by + 11, 4, 2);
      ctx.drawImage(itemIcon(why.item), bx + 1, by + 1, 10, 10);
      ctx.fillStyle = why.full ? '#3f9e4a' : '#e0402f';
      if (why.full) ctx.fillRect(bx + 9, by - 2, 3, 3);
      else {
        ctx.fillRect(bx + 10, by - 3, 2, 4);
        ctx.fillRect(bx + 10, by + 2, 2, 1);
      }
    }
    return;
  }
  if (!b.done || !(b.busy > 0)) return;
  if (b.type === 'saw') {
    // spinning blade teeth
    const a = G.frame * 0.5;
    ctx.fillStyle = '#e4e8ec';
    for (let k = 0; k < 4; k++) {
      const r = a + (k * Math.PI) / 2;
      ctx.fillRect(Math.round(sx + 16 + Math.cos(r) * 3), Math.round(sy + 8 + Math.sin(r) * 3), 1, 1);
    }
  } else if (b.type === 'chem') {
    // bubbles in the green tank
    ctx.fillStyle = '#d8ffb8';
    for (let k = 0; k < 3; k++) {
      const y = 5 - ((G.frame * 0.15 + k * 2) % 5);
      ctx.fillRect(sx + 14 + k * 2, Math.round(sy + y), 1, 1);
    }
  }
}

// warm glow around windows on top of the night overlay
function drawWindowGlow(ctx, cx, cy, dark) {
  if (dark < 0.15) return;
  const a = Math.min(1, (dark - 0.15) * 2.2);
  for (const b of builds) {
    if (!b.done) continue;
    const w = windows(b.type);
    if (!w.length) continue;
    const sx = b.x - cx,
      sy = b.gy - b.h - cy;
    if (sx > G.VW || sx + b.w < 0) continue;
    const flick = 0.85 + Math.sin(G.frame * 0.07 + b.x) * 0.1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,170,70,${0.12 * a * flick})`;
    for (let k = 0; k < w.length; k += 2) ctx.fillRect(sx + w[k] - 2, sy + w[k + 1] - 2, 5, 5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffe39a';
    for (let k = 0; k < w.length; k += 2) ctx.fillRect(sx + w[k], sy + w[k + 1], 1, 1);
    ctx.globalAlpha = 1;
  }
}

export { drawBuildFx, drawWindowGlow, updBuildFx };
