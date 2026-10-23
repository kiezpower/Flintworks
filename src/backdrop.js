// Painted parallax background: three layers per world type (far peaks, hills with forest, near hills),
// generated once at double resolution and tiled seamlessly.
import { G } from './state.js';

const TW = 1200; // tile width in canvas pixels (= 600 landscape pixels)
const TAU = Math.PI * 2;
const per = (x, k, ph) => Math.sin((x / TW) * TAU * k + ph); // periodic over the tile

const LAYERS = {
  meadow: [
    { kind: 'peaks', col: '#9fb4c8', snow: 0.62, top: 46, h: 70, f: 0.1, amp: 44 },
    { kind: 'hills', col: '#8eae9c', tree: 'mixed', top: 78, h: 60, f: 0.25, amp: 12 },
    { kind: 'hills', col: '#6e9670', tree: 'mixed', top: 94, h: 60, f: 0.45, amp: 10, big: true },
  ],
  desert: [
    { kind: 'mesa', col: '#dcae86', top: 56, h: 70, f: 0.1, amp: 30 },
    { kind: 'dunes', col: '#e8d2a2', tree: 'cactus', top: 80, h: 60, f: 0.25, amp: 10 },
    { kind: 'dunes', col: '#d8b47c', tree: 'cactus', top: 96, h: 60, f: 0.45, amp: 8, big: true },
  ],
  winter: [
    { kind: 'peaks', col: '#b6c6d8', snow: 0.35, top: 40, h: 76, f: 0.1, amp: 50 },
    { kind: 'hills', col: '#d6e0ea', tree: 'snowpine', top: 76, h: 60, f: 0.25, amp: 12 },
    { kind: 'hills', col: '#b8c8d8', tree: 'snowpine', top: 94, h: 60, f: 0.45, amp: 10, big: true },
  ],
};

const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = (c, k = 1) => `rgb(${(c[0] * k) | 0},${(c[1] * k) | 0},${(c[2] * k) | 0})`;
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function ridgeFn(L) {
  const a = L.amp * 2;
  if (L.kind === 'peaks')
    return x => {
      const r = Math.abs(per(x, 3, 0.4)) * 0.55 + Math.abs(per(x, 7, 1.3)) * 0.3 + Math.abs(per(x, 17, 2.1)) * 0.15;
      return a * (1 - r);
    };
  if (L.kind === 'mesa')
    return x => {
      const r = per(x, 2, 0.3) * 0.6 + per(x, 5, 1.1) * 0.4;
      // flat plateaus with steep sides
      const step = r > 0.25 ? 0.15 : r > -0.2 ? 0.55 : 0.95;
      return a * step + per(x, 23, 0.7) * 2;
    };
  if (L.kind === 'dunes') return x => a * (0.5 + per(x, 4, 0.9) * 0.35 + per(x, 9, 2.4) * 0.15);
  return x => a * (0.5 + per(x, 3, 1.7) * 0.3 + per(x, 8, 0.2) * 0.2);
}

function tri(g, x, top, w, h) {
  g.beginPath();
  g.moveTo(x, top);
  g.lineTo(x + w, top + h);
  g.lineTo(x - w, top + h);
  g.closePath();
  g.fill();
}
function drawTree(g, x, y, kind, s, col) {
  const dark = css(col, 0.74),
    darker = css(col, 0.62);
  if (kind === 'cactus') {
    const h = (9 + rand() * 6) * s;
    g.fillStyle = darker;
    g.fillRect(x - s, y - h, 3 * s, h);
    g.fillRect(x - 4 * s, y - h * 0.55, 3 * s, 2 * s);
    g.fillRect(x - 4 * s, y - h * 0.85, 2 * s, h * 0.32);
    g.fillRect(x + 2 * s, y - h * 0.4, 3 * s, 2 * s);
    g.fillRect(x + 3 * s, y - h * 0.7, 2 * s, h * 0.32);
    return;
  }
  const pine = kind === 'snowpine' || (kind === 'mixed' && rand() < 0.45);
  if (pine) {
    const h = (11 + rand() * 9) * s,
      w = h * 0.36;
    g.fillStyle = darker;
    g.fillRect(x - s * 0.5, y - h * 0.25, s, h * 0.25);
    for (let t = 0; t < 3; t++) {
      const top = y - h + (t * h) / 4,
        tw = w * (0.55 + t * 0.25),
        th = h * 0.42;
      g.fillStyle = t % 2 ? darker : dark;
      tri(g, x, top, tw, th);
      if (kind === 'snowpine') {
        g.fillStyle = 'rgba(250,252,255,0.9)';
        tri(g, x - tw * 0.15, top, tw * 0.55, th * 0.45);
      }
    }
  } else {
    const r = (4 + rand() * 4) * s;
    g.fillStyle = darker;
    g.fillRect(x - s * 0.5, y - r, s, r);
    g.fillStyle = dark;
    g.beginPath();
    g.arc(x, y - r - r * 0.6, r, 0, TAU);
    g.fill();
    g.fillStyle = css(col, 0.86);
    g.beginPath();
    g.arc(x - r * 0.3, y - r - r * 0.9, r * 0.45, 0, TAU);
    g.fill();
  }
}

function makeLayer(L, idx) {
  seed = 1000 + idx * 77;
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = L.h * 2;
  const g = c.getContext('2d');
  const col = rgb(L.col);
  const ridge = ridgeFn(L);
  // body with a vertical gradient: lighter at the ridge, deeper below
  for (let x = 0; x < TW; x++) {
    const y = Math.round(ridge(x));
    const gr = g.createLinearGradient(0, y, 0, c.height);
    gr.addColorStop(0, css(col, 1.04));
    gr.addColorStop(1, css(col, 0.8));
    g.fillStyle = gr;
    g.fillRect(x, y, 1, c.height - y);
    // light from the left: slopes facing left are brighter
    const slope = ridge(x + 1) - ridge(x - 1);
    if (L.kind === 'peaks' || L.kind === 'mesa') {
      g.fillStyle = slope > 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,30,0.1)';
      g.fillRect(x, y, 1, Math.min(40, c.height - y));
    }
    if (L.snow !== undefined && y < L.amp * 2 * (1 - L.snow)) {
      g.fillStyle = '#f4f8fb';
      const depth = Math.round(L.amp * 2 * (1 - L.snow) - y);
      g.fillRect(x, y, 1, Math.min(depth, 6 + ((x * 7) % 5)));
    }
    // rim light along the top edge
    g.fillStyle = css(col, 1.16);
    g.fillRect(x, y, 1, 1);
  }
  if (L.tree) {
    const s = L.big ? 2 : 1;
    for (let x = 6; x < TW - 6; x += Math.round((L.big ? 26 : 14) + rand() * (L.big ? 40 : 22))) {
      if (L.tree === 'cactus' && rand() < 0.6) continue;
      // keep trees clear of the tile seam
      drawTree(g, x, Math.round(ridge(x)) + 2, L.tree, s, col);
      if (L.tree !== 'cactus' && rand() < 0.6) drawTree(g, x + 5 * s, Math.round(ridge(x + 5 * s)) + 3, L.tree, s, col);
    }
  }
  return { cv: c, f: L.f, top: L.top, h: L.h, bottom: css(col, 0.8) };
}

const cache = {};
function layersFor(name) {
  if (!cache[name]) cache[name] = (LAYERS[name] || LAYERS.meadow).map(makeLayer);
  return cache[name];
}

// draws all layers; ctx is in landscape units (canvas transform ×2)
function drawBackdrop(ctx, cx, cy) {
  const tw = TW / 2;
  for (const L of layersFor(G.biome)) {
    const y = Math.round(L.top - cy * 0.85);
    if (y > G.VH) continue;
    let x = -((cx * L.f) % tw);
    x = Math.round(x * 2) / 2;
    for (; x < G.VW; x += tw) ctx.drawImage(L.cv, x, y, tw, L.h);
    if (y + L.h < G.VH) {
      ctx.fillStyle = L.bottom;
      ctx.fillRect(0, y + L.h, G.VW, G.VH - y - L.h);
    }
  }
}

export { drawBackdrop };
