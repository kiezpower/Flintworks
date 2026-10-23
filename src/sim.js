import { sfx } from './sound.js';
import { G, parts } from './state.js';
import {
  ACID,
  AIR,
  CHn,
  CS,
  CWn,
  EARTH,
  H,
  LAVA,
  LIQ,
  LOAM,
  ROCK,
  SAND,
  W,
  WATER,
  acidChunk,
  bg,
  markActive,
  mat,
  paint,
  rnd,
  stamp,
  swapActive,
} from './world.js';

// ---- Falling-sand simulation ----
G.frame = 1;
G.hissT = 0;
function swap(i, j) {
  const t = mat[i];
  mat[i] = mat[j];
  mat[j] = t;
  stamp[j] = G.frame;
  paint(i);
  paint(j);
}
function flow(i, x, y, spread) {
  const b = i + W;
  if (mat[b] === AIR) {
    swap(i, b);
    return;
  }
  const d = rnd() < 0.5 ? -1 : 1;
  for (let s = 0; s < 2; s++) {
    const dd = s ? -d : d,
      nx = x + dd;
    if (nx < 0 || nx >= W) continue;
    if (mat[b + dd] === AIR && mat[i + dd] === AIR) {
      swap(i, b + dd);
      return;
    }
  }
  let tgt = -1;
  for (let s = 0; s < 2 && tgt < 0; s++) {
    const dd = s ? -d : d;
    for (let k = 1; k <= spread; k++) {
      const nx = x + dd * k;
      if (nx < 0 || nx >= W) break;
      const j = i + dd * k;
      if (mat[j] !== AIR) break;
      tgt = j;
      if (mat[j + W] === AIR) break;
    }
  }
  if (tgt >= 0) swap(i, tgt);
}
function lavaReact(i, x, y) {
  const nb = [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1];
  for (const j of nb) {
    if (j < 0 || j >= W * H) continue;
    if (mat[j] === WATER) {
      mat[j] = AIR;
      paint(j);
      mat[i] = ROCK;
      paint(i);
      parts.push({
        x: j % W,
        y: (j / W) | 0,
        vx: (rnd() - 0.5) * 0.4,
        vy: -0.5 - rnd() * 0.4,
        l: 40,
        c: '#e8eef2',
        g: -0.004,
      });
      if (G.hissT <= 0) {
        sfx('hiss', x, y);
        G.hissT = 20;
      }
      return true;
    }
  }
  return false;
}
function simulate() {
  G.frame++;
  if (G.hissT > 0) G.hissT--;
  const act = swapActive();
  const frame = G.frame;
  const ltr = frame & 1;
  for (let cy = CHn - 1; cy >= 0; cy--) {
    for (let k = 0; k < CWn; k++) {
      const cx = ltr ? k : CWn - 1 - k,
        ci = cy * CWn + cx;
      if (!act[ci]) continue;
      let hasAcid = false;
      const x0 = cx * CS,
        y0 = cy * CS,
        x1 = Math.min(x0 + CS, W),
        y1 = Math.min(y0 + CS, H - 1);
      for (let y = y1 - 1; y >= y0; y--) {
        for (let q = 0; q < x1 - x0; q++) {
          const x = ltr ? x0 + q : x1 - 1 - q;
          const i = y * W + x,
            m = mat[i];
          if (m !== SAND && !LIQ[m]) continue;
          if (stamp[i] === frame) continue;
          if (m === SAND) {
            const b = i + W,
              mb = mat[b];
            if (mb === AIR || LIQ[mb]) {
              swap(i, b);
              continue;
            }
            const d = rnd() < 0.5 ? -1 : 1;
            for (let s = 0; s < 2; s++) {
              const dd = s ? -d : d,
                nx = x + dd;
              if (nx < 0 || nx >= W) continue;
              const mj = mat[b + dd],
                ms = mat[i + dd];
              if ((mj === AIR || LIQ[mj]) && (ms === AIR || LIQ[ms])) {
                swap(i, b + dd);
                break;
              }
            }
            continue;
          }
          if (m === LAVA) {
            if (lavaReact(i, x, y)) continue;
            if ((frame + x) % 3) continue;
            flow(i, x, y, 2);
            continue;
          }
          if (m === ACID) {
            hasAcid = true;
            if (rnd() < 0.03) {
              const r = (rnd() * 4) | 0,
                j = r === 0 ? i - W : r === 1 ? i + W : r === 2 ? (x > 0 ? i - 1 : -1) : x < W - 1 ? i + 1 : -1;
              if (j >= 0 && j < W * H) {
                const mj = mat[j];
                if (mj === EARTH || mj === SAND || mj === LOAM) {
                  mat[j] = AIR;
                  bg[j] = 1;
                  paint(j);
                  if (rnd() < 0.3) {
                    mat[i] = AIR;
                    paint(i);
                  }
                  if (rnd() < 0.3) parts.push({ x, y, vx: 0, vy: -0.3, l: 20, c: '#b6f28f', g: -0.002 });
                  continue;
                }
              }
            }
          }
          flow(i, x, y, m === WATER ? 4 : 3);
        }
      }
      acidChunk[ci] = hasAcid ? 1 : 0;
    }
  }
  if (G.frame % 30 === 0) for (let c = 0; c < acidChunk.length; c++) if (acidChunk[c]) markActive(c);
}

export { flow, lavaReact, simulate, swap };
