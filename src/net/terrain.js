// The landscape over the network. Everybody builds the same world from the seed; after that
// the host sends the 32×32 chunks that changed (dug, flooded, blasted), run-length coded.
// A slow round-robin refresh of all chunks repairs anything that went missing.
import { b64, unb64 } from '../save.js';
import { crew } from '../state.js';
import { ACID, AIR, CHn, CS, CWn, H, LAVA, W, WATER, bg, mat, netDirty, paint } from '../world.js';

const MAX_PER_PACKET = 24;
let refresh = 0,
  tick = 0;

// cell = material (4 bits) + dug background (1 bit); runs of [count, cell]
function encodeChunk(c) {
  const x0 = (c % CWn) * CS,
    y0 = ((c / CWn) | 0) * CS,
    x1 = Math.min(x0 + CS, W),
    y1 = Math.min(y0 + CS, H);
  const out = [];
  let prev = -1,
    run = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = y * W + x,
        v = mat[i] | (bg[i] << 4);
      if (v === prev && run < 255) run++;
      else {
        if (run) out.push(run, prev);
        prev = v;
        run = 1;
      }
    }
  out.push(run, prev);
  return b64(new Uint8Array(out));
}
function decodeChunk(c, str) {
  const x0 = (c % CWn) * CS,
    y0 = ((c / CWn) | 0) * CS,
    x1 = Math.min(x0 + CS, W),
    y1 = Math.min(y0 + CS, H),
    w = x1 - x0;
  const u = unb64(str);
  let n = 0;
  for (let k = 0; k < u.length; k += 2) {
    const run = u[k],
      v = u[k + 1],
      m = v & 15,
      b = (v >> 4) & 1;
    for (let q = 0; q < run; q++, n++) {
      const i = (y0 + ((n / w) | 0)) * W + x0 + (n % w);
      if (i >= W * H || (mat[i] === m && bg[i] === b)) continue;
      mat[i] = m;
      bg[i] = b;
      paint(i);
    }
  }
  if (n !== w * (y1 - y0)) console.warn('chunk size mismatch', c);
}

// what the clients have (as far as the host knows), cell = material | dug << 4
let sent = null;
const liqT = new Int32Array(CWn * CHn);
function resetSent() {
  sent = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) sent[i] = mat[i] | (bg[i] << 4);
}
const FLOW = new Set([AIR, WATER, ACID, LAVA]);
// 2: something solid changed (send now), 1: only liquid moved, 0: nothing
function changeKind(c) {
  const x0 = (c % CWn) * CS,
    y0 = ((c / CWn) | 0) * CS,
    x1 = Math.min(x0 + CS, W),
    y1 = Math.min(y0 + CS, H);
  let kind = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = y * W + x,
        v = mat[i] | (bg[i] << 4),
        o = sent[i];
      if (v === o) continue;
      if ((v ^ o) & 16 || !FLOW.has(v & 15) || !FLOW.has(o & 15)) return 2;
      kind = 1;
    }
  return kind;
}
function markSent(c) {
  const x0 = (c % CWn) * CS,
    y0 = ((c / CWn) | 0) * CS,
    x1 = Math.min(x0 + CS, W),
    y1 = Math.min(y0 + CS, H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sent[y * W + x] = mat[y * W + x] | (bg[y * W + x] << 4);
}

// host: changed chunks, closest to a player first; water that only sloshes around goes out
// at most once a second per chunk; plus one chunk now and then for the slow repair
function takeChunks(frame) {
  if (!sent) resetSent();
  const list = [];
  for (let c = 0; c < netDirty.length; c++) {
    if (!netDirty[c]) continue;
    const k = changeKind(c);
    if (k === 0) netDirty[c] = 0;
    else if (k === 2 || frame - liqT[c] > 60) list.push(c);
  }
  const near = c => {
    const cx = (c % CWn) * CS + 16,
      cy = ((c / CWn) | 0) * CS + 16;
    let d = 1e9;
    for (const p of crew) if (p.pid != null) d = Math.min(d, Math.abs(p.x - cx) + Math.abs(p.y - cy));
    return d;
  };
  if (list.length > MAX_PER_PACKET) list.sort((a, b) => near(a) - near(b));
  const send = list.slice(0, MAX_PER_PACKET);
  // slow repair: one chunk every 10th packet (whole world in about 5 minutes)
  if (++tick % 10 === 0) {
    refresh = (refresh + 1) % (CWn * CHn);
    if (!send.includes(refresh)) send.push(refresh);
  }
  const out = [];
  for (const c of send) {
    netDirty[c] = 0;
    liqT[c] = frame;
    markSent(c);
    out.push(c, encodeChunk(c));
  }
  return out;
}
function applyChunks(list) {
  for (let k = 0; k < list.length; k += 2) decodeChunk(list[k], list[k + 1]);
}

export { applyChunks, resetSent, takeChunks };
