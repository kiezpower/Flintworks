// The landscape over the network. Everybody builds the same world from the seed; after that
// the host sends the 32×32 chunks that changed (dug, flooded, blasted), run-length coded, or
// only their changed cells when that is shorter.
// A slow round-robin refresh of all chunks repairs anything that went missing.
import { b64, unb64 } from '../save.js';
import { crew } from '../state.js';
import { ACID, AIR, CHn, CS, CWn, H, LAVA, OIL, SOLID, W, WATER, bg, mat, markFresh, netDirty, onResize, paint } from '../world.js';

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
// only the cells of a chunk that changed since it was last sent: 2 bytes each (offset in the
// chunk, 10 bits; cell, 5 bits), sent as "~" + base64 when that is shorter than the whole chunk
// (digging changes a few cells of a chunk at a time). Clients that understand it say so
// (client.js "td"); the host sends whole chunks while one of them does not.
function encodeDiff(c, limit) {
  const x0 = (c % CWn) * CS,
    y0 = ((c / CWn) | 0) * CS,
    x1 = Math.min(x0 + CS, W),
    y1 = Math.min(y0 + CS, H);
  const out = [];
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = y * W + x,
        v = mat[i] | (bg[i] << 4);
      if (v === sent[i]) continue;
      if (out.length >= limit) return null;
      const off = (y - y0) * CS + (x - x0);
      out.push(off & 255, (off >> 8) | (v << 2));
    }
  return '~' + b64(new Uint8Array(out));
}
function decodeDiff(c, str) {
  const x0 = (c % CWn) * CS,
    y0 = ((c / CWn) | 0) * CS;
  const u = unb64(str.slice(1));
  for (let k = 0; k + 1 < u.length; k += 2) {
    const off = u[k] | ((u[k + 1] & 3) << 8),
      v = u[k + 1] >> 2,
      x = x0 + (off % CS),
      y = y0 + ((off / CS) | 0);
    if (x >= W || y >= H) continue;
    const i = y * W + x,
      m = v & 15,
      b = (v >> 4) & 1;
    if (mat[i] === m && bg[i] === b) continue;
    if (m === AIR && b && SOLID[mat[i]]) markFresh(i);
    mat[i] = m;
    bg[i] = b;
    paint(i);
  }
}
function decodeChunk(c, str) {
  if (str[0] === '~') return decodeDiff(c, str);
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
      // dug out on the host: the wall is fresh here too
      if (m === AIR && b && SOLID[mat[i]]) markFresh(i);
      mat[i] = m;
      bg[i] = b;
      paint(i);
    }
  }
  if (n !== w * (y1 - y0)) console.warn('chunk size mismatch', c);
}

// what the clients have (as far as the host knows), cell = material | dug << 4
let sent = null;
let liqT = new Int32Array(CWn * CHn);
// a new world size: what the clients had no longer fits
onResize(() => {
  sent = null;
  liqT = new Int32Array(CWn * CHn);
});
function resetSent() {
  sent = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) sent[i] = mat[i] | (bg[i] << 4);
}
const FLOW = new Set([AIR, WATER, ACID, LAVA, OIL]);
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
function takeChunks(frame, diffs = false) {
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
    // (the repair chunk always goes out whole)
    const full = encodeChunk(c),
      diff = diffs && c !== refresh ? encodeDiff(c, (full.length * 3) / 4 - 2) : null;
    markSent(c);
    out.push(c, diff && diff.length < full.length ? diff : full);
  }
  return out;
}
// client: what the host sent replaces the own ground (that is no change of our own)
function applyChunks(list) {
  for (let k = 0; k < list.length; k += 2) {
    decodeChunk(list[k], list[k + 1]);
    netDirty[list[k]] = 0;
  }
}
// host: the chunks a client asks for
function chunksOf(ids) {
  const out = [];
  for (const c of ids.slice(0, 32)) if (c >= 0 && c < CWn * CHn) out.push(c, encodeChunk(c));
  return out;
}
// client: chunks changed here (own digging ahead of the host) that the host has not confirmed
// within a second get asked for again, so a guess that went wrong does not stay
const guessed = new Map();
// (right where the Wühler digs, the host is just a moment behind: wait longer there)
function staleGuesses(frame, me) {
  const busy = c =>
    me &&
    Math.abs((c % CWn) * CS + CS / 2 - me.x) < CS + 16 &&
    Math.abs(((c / CWn) | 0) * CS + CS / 2 - me.y) < CS + 16;
  for (let c = 0; c < netDirty.length; c++)
    if (netDirty[c]) {
      netDirty[c] = 0;
      if (!guessed.has(c)) guessed.set(c, frame);
    }
  const ask = [];
  for (const [c, t] of guessed)
    if (frame - t > (busy(c) ? 240 : 60) && ask.length < 16) {
      ask.push(c);
      guessed.delete(c);
    }
  return ask;
}
// (a diff only says what the host changed, not that the own guesses there were right: only a
// whole chunk confirms them)
const confirmChunks = list => {
  for (let k = 0; k < list.length; k += 2) if (list[k + 1][0] !== '~') guessed.delete(list[k]);
};

// the whole landscape (for a player who joins late or comes back)
function allChunks() {
  const out = [];
  for (let c = 0; c < CWn * CHn; c++) out.push(c, encodeChunk(c));
  return out;
}

export { allChunks, applyChunks, chunksOf, confirmChunks, resetSent, staleGuesses, takeChunks };
