// Watching a Tagesschicht run again (like the replays of racing and puzzle games): while a shift
// is played, every play tick is written down – the player's input (stick, buttons), the state of
// the random numbers, the camera and the view – and every order from the panels with the random
// state it ran in. Played back in the same world (the day's seed), the game then goes exactly the
// same way: the random numbers are set before each tick (drawing between two ticks draws random
// numbers too, a different number of times on every device), the camera too (lightning and stones
// far off depend on it), and the helpers plan with a fixed number of search nodes instead of a
// time budget (helpers.js, G.detPlan). The last run of each day is kept on this device.
import { inp } from './input.js';
import { cam } from './render.js';
import { G, animals, crew, items } from './state.js';
import { H, W, activateAll, clearStamps, getSeed, mat, setSeed } from './world.js';

const KEY = 'flintworks-replay';
const V = 1;
let rec = null, // the run being written down
  play = null, // the run being played back
  view = null; // the view of this device while a tick of the playback runs

// a Tagesschicht run starts (main.js): write it down
function recStart(day) {
  play = null;
  G.replaying = false;
  G.detPlan = true;
  rec = { day, vw: G.VW, vh: G.VH, frame0: null, ax: [], ay: [], fl: [], sd: [], cx: [], cy: [], cmds: [] };
}
const FLAGS = ['dig', 'auto', 'jumpP', 'jumpUp', 'throwP', 'actP'];
// an order from a panel (commands.js send): written down with the random state it runs in
function recCmd(name, args) {
  if (!rec || G.state !== 'play') return;
  rec.cmds.push({ t: rec.ax.length, s: getSeed(), n: name, a: JSON.parse(JSON.stringify(args ?? {})) });
}
const recording = () => !!rec;
// every play tick (main.js step, after the input is read, before anything moves)
function replayTick() {
  if (play) return playTick();
  if (!rec) return;
  if (rec.frame0 == null) {
    rec.frame0 = G.frame;
    clearStamps();
    activateAll();
  }
  rec.ax.push(Math.round(inp.ax * 100));
  rec.ay.push(Math.round(inp.ay * 100));
  let f = 0;
  FLAGS.forEach((k, b) => inp[k] && (f |= 1 << b));
  rec.fl.push(f);
  rec.sd.push(getSeed());
  rec.cx.push(Math.round(cam.x * 4));
  rec.cy.push(Math.round(cam.y * 4));
  if (DEV) {
    (rec.chk ||= []).push(stateSum());
    (rec.parts ||= []).push(parts_());
  }
}
// (dev server only, with ?replaydbg in the address: a checksum of the world and what moves, every
// tick, and on a playback the first tick that parts ways in G.replayDiverge)
const DEV = import.meta.env.DEV && new URLSearchParams(location.search).has('replaydbg');
function stateSum() {
  let h = (worldHash() + (G.money | 0)) + items.length * 7919 + animals.length * 104729;
  for (const c of crew) h = (Math.imul(h, 31) + Math.round(c.x * 1e6) * 3 + Math.round(c.y * 1e6) + Math.round((c.digH || 0) * 1e6) + (c.energy | 0)) >>> 0;
  return h >>> 0;
}
const me_ = () => {
  const c = crew.find(o => o.pid === G.myId);
  return c && { x: c.x, y: c.y, vx: c.vx, vy: c.vy, face: c.face, dg: c.digging, ph: c.digPh, h: c.digH, s: c.digS, m: c.digM, climb: c.climb, hang: c.hangle, push: c.pushT, ramp: !!c.ramp, end: c.digEnd, latch: G.digLatch, ax: inp.ax, ay: inp.ay, dig: inp.dig, auto: inp.auto };
};
const parts_ = () => ({
  me: me_(),
  money: G.money,
  crew: crew.map(c => [Math.round(c.x * 16) / 16, Math.round(c.y * 16) / 16, c.energy | 0, c.job?.type || '', c.plan ? 1 : 0]),
  items: items.length,
  animals: animals.length,
  frame: G.frame,
  seed: getSeed(),
  world: worldHash(),
  sand: (() => {
    let n = 0;
    for (let i = 0; i < W * H; i++) if (mat[i] === 4) n++;
    return n;
  })(),
});
// the whole ground as one number: a playback that went the same way ends with the same one
function worldHash() {
  let h = 0;
  for (let i = 0; i < W * H; i++) h = (Math.imul(h, 31) + mat[i]) >>> 0;
  return h;
}
function playTick() {
  const t = play.t;
  // (the recording is over: so is the playback, however the run ended)
  if (t >= play.n) return void G.onLevelEnd?.(true);
  if (t === 0) {
    G.frame = play.frame0;
    clearStamps();
    activateAll();
  }
  // the orders given before this tick, each in its random state
  while (play.ci < play.cmds.length && play.cmds[play.ci].t <= t) {
    const c = play.cmds[play.ci++];
    setSeed(c.s);
    G.execCmd(G.myId, c.n, c.a);
  }
  inp.ax = play.ax[t] / 100;
  inp.ay = play.ay[t] / 100;
  FLAGS.forEach((k, b) => (inp[k] = !!(play.fl[t] & (1 << b))));
  setSeed(play.sd[t]);
  if (DEV && play.chk && G.replayDiverge == null && stateSum() !== play.chk[t])
    G.replayDiverge = { t, now: parts_(), then: play.parts?.[t], before: play.parts?.[t - 1], mine: play.prev };
  if (DEV) play.prev = parts_();
  // the camera and the view of the recording, for this tick (back to this device's after it)
  view = { x: cam.x, y: cam.y, vw: G.VW, vh: G.VH };
  cam.x = play.cx[t] / 4;
  cam.y = play.cy[t] / 4;
  G.VW = play.vw;
  G.VH = play.vh;
  play.t++;
}
// after a play tick (main.js step)
function replayAfter() {
  if (!view) return;
  cam.x = view.x;
  cam.y = view.y;
  G.VW = view.vw;
  G.VH = view.vh;
  view = null;
}

// ---- keeping and loading (a binary block in base64: 3 bytes input, 4 seed, 4 camera a tick) ----
function pack(r) {
  const n = r.ax.length,
    b = new DataView(new ArrayBuffer(n * 11));
  for (let t = 0; t < n; t++) {
    const o = t * 11;
    b.setInt8(o, r.ax[t]);
    b.setInt8(o + 1, r.ay[t]);
    b.setUint8(o + 2, r.fl[t]);
    b.setUint32(o + 3, r.sd[t]);
    b.setInt16(o + 7, r.cx[t]);
    b.setInt16(o + 9, r.cy[t]);
  }
  const u = new Uint8Array(b.buffer);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
function unpack(d) {
  const s = atob(d.bin),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  const b = new DataView(u.buffer),
    n = Math.floor(u.length / 11),
    r = { ...d, n, t: 0, ci: 0, ax: [], ay: [], fl: [], sd: [], cx: [], cy: [] };
  for (let t = 0; t < n; t++) {
    const o = t * 11;
    r.ax.push(b.getInt8(o));
    r.ay.push(b.getInt8(o + 1));
    r.fl.push(b.getUint8(o + 2));
    r.sd.push(b.getUint32(o + 3));
    r.cx.push(b.getInt16(o + 7));
    r.cy.push(b.getInt16(o + 9));
  }
  return r;
}
// the run is over (main.js endScreen): keep it, with its result to check the playback against
function recStop() {
  if (!rec) return null;
  const r = rec;
  rec = null;
  G.detPlan = false;
  if (!r.ax.length) return null;
  const d = { v: V, app: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '', day: r.day, vw: r.vw, vh: r.vh, frame0: r.frame0, earned: G.earned || 0, hash: worldHash(), cmds: r.cmds, bin: pack(r), ...(DEV ? { chk: r.chk, parts: r.parts } : {}) };
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {}
  return d;
}
// the kept run, when it is one of this version (another version may play differently)
function savedReplay() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.v === V && d.app === (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '')) return d;
  } catch {}
  return null;
}
// play a kept run back: the same day's shift, steered by the recording
function playStart(d) {
  rec = null;
  play = unpack(d);
  G.replaying = true;
  G.detPlan = true;
  G.replayDay = d.day;
}
function playStop() {
  const p = play;
  play = null;
  view = null;
  G.replaying = false;
  G.detPlan = false;
  G.replayDay = null;
  return p;
}
const playing = () => !!play;

G.replayHook = { playing: () => !!play, recCmd };
export { worldHash, playStart, playStop, playing, recCmd, recStart, recStop, recording, replayAfter, replayTick, savedReplay };
