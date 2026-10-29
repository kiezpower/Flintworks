// Living buildings: chimney smoke, sawdust, sparks, bubbling tanks and glowing windows at night.
import { SPR, itemIcon } from './sprites.js';
import { FX_PAL, flicker, px, sparks } from './effects.js';
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

// the lit windows as rectangles [x, y, w, h], merged from their pixels (for one halo per pane)
const rectCache = {};
function winRects(type) {
  if (rectCache[type]) return rectCache[type];
  const w = windows(type),
    on = new Set(),
    out = [];
  for (let k = 0; k < w.length; k += 2) on.add(w[k] * 256 + w[k + 1]);
  for (let k = 0; k < w.length; k += 2) {
    const x = w[k],
      y = w[k + 1];
    if (on.has((x - 1) * 256 + y) || on.has(x * 256 + y - 1)) continue;
    let rw = 1,
      rh = 1;
    while (on.has((x + rw) * 256 + y)) rw++;
    while (on.has(x * 256 + y + rh)) rh++;
    out.push(x, y, rw, rh);
  }
  return (rectCache[type] = out);
}

// the first opaque row of every column of a building sprite: its roof line (for rain and snow)
const roofCache = {};
function roofTops(type) {
  if (roofCache[type]) return roofCache[type];
  const spr = SPR[type],
    out = [];
  if (spr) {
    const w = spr.width,
      h = spr.height,
      d = spr.getContext('2d').getImageData(0, 0, w, h).data;
    for (let x = 0; x < w; x++) {
      let y = 0;
      while (y < h && d[(y * w + x) * 4 + 3] < 128) y++;
      out.push(y);
    }
  }
  return (roofCache[type] = out);
}

// a puff grows in steps as it rises and cools from a warm, fire-lit grey to a cold blue grey;
// in the rain the wind presses it flat
function smoke(x, y, dark, big) {
  const wet = G.rainT > 0,
    l = 70 + rnd() * 50;
  parts.push({
    x: x + rnd() * 2,
    y,
    vx: G.wind * (wet ? 0.4 : 0.22) + (rnd() - 0.5) * 0.1,
    vy: (-0.25 - rnd() * 0.15) * (wet ? 0.6 : 1),
    l,
    l0: l,
    pal: dark ? FX_PAL.smokeDark : FX_PAL.smoke,
    g: -0.002,
    s: 1,
    grow: big ? 1 : 0.5,
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
    if (b.type === 'furnace') {
      // embers out of the fire door, and a few up the chimney
      if (G.frame % 7 === 0) sparks(b.x + 9, top + 15, 1, 1.3);
      if (G.frame % 23 === 0) sparks(b.x + ch[0] + 1, top + ch[1], 1, 0.8);
    }
    if (b.type === 'shop' && G.frame % 11 === 0)
      parts.push({ x: b.x + 18, y: top + 9, vx: (rnd() - 0.5) * 1.2, vy: -0.9, l: 14, c: '#ffe066', g: 0.06 });
  }
}

// overlays drawn right after the building sprite
function drawBuildFx(ctx, b, sx, sy) {
  if (b.busy > 0) b.idleK = null; // (working again: the waiting starts over)
  if (b.done && !(b.busy > 0)) {
    // idle production building: bubble with what it is waiting for
    const why = idleReason(b);
    // how long it has waited for the same thing: after 30 seconds the bubble calls louder
    const key = why ? (why.full ? 'full:' : '') + why.item : '';
    if (b.idleK !== key) {
      b.idleK = key;
      b.idleF = G.frame;
    }
    if (why) {
      const long = G.frame - b.idleF > 1800,
        bx = Math.round(sx + b.w / 2 - 6),
        by = Math.round(sy - 15 + Math.sin(G.frame * (long ? 0.2 : 0.08)) * (long ? 2 : 1));
      ctx.fillStyle = long && !why.full && G.frame % 40 < 20 ? '#e0402f' : '#24160c';
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
    const flick = flicker(b.x),
      u = px();
    // two hard bands of light: a solid halo right around each pane, a dithered ring further out
    const r = winRects(b.type);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,170,70,${0.18 * a * flick})`;
    for (let k = 0; k < r.length; k += 4) ctx.fillRect(sx + r[k] - 1, sy + r[k + 1] - 1, r[k + 2] + 2, r[k + 3] + 2);
    ctx.fillStyle = `rgba(255,140,50,${0.16 * a * flick})`;
    for (let k = 0; k < r.length; k += 4) {
      const x0 = sx + r[k] - 2,
        y0 = sy + r[k + 1] - 2,
        x1 = x0 + r[k + 2] + 3,
        y1 = y0 + r[k + 3] + 3;
      for (let x = x0; x <= x1; x += 2 * u) {
        ctx.fillRect(x, y0, u, u);
        ctx.fillRect(x + u, y1 + 1 - u, u, u);
      }
      for (let y = y0 + 2 * u; y < y1; y += 2 * u) {
        ctx.fillRect(x0, y, u, u);
        ctx.fillRect(x1 + 1 - u, y + u, u, u);
      }
    }
    // a warm patch of light on the ground in front of the house
    ctx.fillStyle = `rgba(255,150,60,${0.1 * a * flick})`;
    ctx.fillRect(sx + 2, sy + b.h, b.w - 4, 1);
    for (let x = 3; x < b.w - 3; x += 2 * u) ctx.fillRect(sx + x, sy + b.h + 1, u, u);
    ctx.globalCompositeOperation = 'source-over';
    // the panes themselves stay fully warm over the cold night
    ctx.globalAlpha = a;
    ctx.fillStyle = flick < 0.9 ? '#ffd27a' : '#ffe39a';
    for (let k = 0; k < w.length; k += 2) ctx.fillRect(sx + w[k], sy + w[k + 1], 1, 1);
    ctx.globalAlpha = 1;
  }
}

export { drawBuildFx, drawWindowGlow, roofTops, updBuildFx };
