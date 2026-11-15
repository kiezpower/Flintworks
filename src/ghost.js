// Ghosts in the Tagesschicht: the best run of the day of every friend runs along as a pale Wühler
// (like the ghosts of racing games). The world is the same for everybody, so it is enough to know
// where a friend's Wühler was and what it had earned, twice a second: 6 bytes a sample, under 6 KB
// for a whole shift. The own best run of the day goes to the relay (server/relay.js keeps it in
// memory for mutual friends only), the friends' runs come from there and are kept on this device
// for the day, so they also run along without a connection.
// And the other way round: a friend who earns more than my best of today after I played is told
// here once ("Anna hat dich überholt"), also when it happened while the app was closed.
import { dayNo } from './daily.js';
import { tr } from './i18n.js';
import { P, saveProfile } from './profile.js';
import { G, crew } from './state.js';
import { toast } from './ui.js';

const STEP = 30; // play ticks between two samples
const KEY = 'flintworks-ghosts';
const MAX_SHOWN = 5;
const today = () => dayNo();

// ---- the own run ----
let track = null; // {day, pts: [x*4, y*4, earned, …], whole}
const me = () => crew.find(c => c.pid === G.myId) || crew[0];
const active = () => G.mode === 'daily' && !G.net && !G.replaying && !!G.daily;
// every play tick of a shift (main.js step)
function ghostTick() {
  if (!active()) return;
  const t = G.playTicks || 0,
    k = Math.floor(t / STEP);
  if (!track || track.day !== G.daily.n || t <= 1 || k * 3 < track.pts.length - 3) {
    // (a shift carried on after a reload has no beginning: it is not sent)
    track = { day: G.daily.n, pts: [], whole: t <= STEP };
    run = null;
  }
  if (t % STEP === 0 || !track.pts.length) {
    const c = me();
    if (c) {
      if (k * 3 > track.pts.length) track.whole = false;
      track.pts[k * 3] = Math.max(0, Math.min(65535, Math.round(c.x * 4)));
      track.pts[k * 3 + 1] = Math.max(0, Math.min(65535, Math.round(c.y * 4)));
      track.pts[k * 3 + 2] = Math.max(0, Math.min(65535, Math.round(G.earned || 0)));
    }
  }
  passTick();
}
function pack(pts) {
  const b = new DataView(new ArrayBuffer(pts.length * 2));
  for (let i = 0; i < pts.length; i++) b.setUint16(i * 2, pts[i] || 0);
  const u = new Uint8Array(b.buffer);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
function unpack(d) {
  const s = atob(d),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  const b = new DataView(u.buffer),
    pts = [];
  for (let i = 0; i + 1 < u.length; i += 2) pts.push(b.getUint16(i));
  return pts.slice(0, pts.length - (pts.length % 3));
}

// ---- kept on this device: my best run of the day and the friends' ----
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return { mine: s.mine || null, list: Array.isArray(s.list) ? s.list : [] };
  } catch {}
  return { mine: null, list: [] };
}
const S = load();
function keep() {
  const n = today();
  if (S.mine && S.mine.day !== n) S.mine = null;
  S.list = S.list.filter(g => g.day === n);
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {}
}
// a shift is over and it is the best of the day (daily.js record): keep the run and send it
function ghostRecord(day, score) {
  const t = track;
  track = null;
  if (!t || t.day !== day || !t.whole || t.pts.length < 6) return;
  t.pts[t.pts.length - 1] = Math.max(0, Math.min(65535, Math.round(score)));
  S.mine = { day, score, d: pack(t.pts) };
  keep();
  sent = null;
}
let sent = null; // the connection my ghost went over (once per connection and run)
// (net/friends.js: after every hello) line: something that changes with every connection
function myGhost(line) {
  const m = S.mine;
  if (!m || m.day !== today() || P.daily?.best?.[m.day] !== m.score || sent === line) return null;
  sent = line;
  return { day: m.day, score: m.score, d: m.d };
}
// the friends list came (net/friends.js): which ghosts are missing here? → their codes
const asked = new Map(); // fid → the score of the ghost asked for (once each)
function ghostsWanted(list) {
  const n = today();
  return list
    .filter(f => f.ghost != null && !S.list.some(g => g.fid === f.fid && g.day === n && g.score === f.ghost))
    .sort((a, b) => b.ghost - a.ghost)
    .slice(0, MAX_SHOWN)
    .filter(f => asked.get(f.fid) !== f.ghost && asked.set(f.fid, f.ghost))
    .map(f => f.fid);
}
// a friend's ghost from the relay
function ghostTake(m) {
  if (!m || typeof m.d !== 'string' || m.d.length > 16000 || !Number.isInteger(m.day) || m.day !== today()) return;
  if (!P.friends?.some(f => f.fid === m.fid)) return;
  let pts;
  try {
    pts = unpack(m.d);
  } catch {
    return;
  }
  if (pts.length < 6) return;
  S.list = S.list.filter(g => g.fid !== m.fid);
  S.list.push({ fid: m.fid, name: String(m.name || '').slice(0, 16), day: m.day, score: Math.max(0, Math.round(Number(m.score) || 0)), d: m.d, cap: String(m.cap || ''), hat: String(m.hat || ''), skin: String(m.skin || '') });
  S.list.sort((a, b) => b.score - a.score);
  S.list = S.list.slice(0, 20);
  keep();
  run = null;
}
// today's ghosts of people who are still friends, best first: [{fid, name, score}]
const ghostList = (n = today()) =>
  S.list
    .filter(g => g.day === n && P.friends?.some(f => f.fid === g.fid))
    .slice(0, MAX_SHOWN)
    .map(({ fid, name, score }) => ({ fid, name, score }));

// ---- running along ----
let run = null; // the ghosts of the shift being played: [{name, score, pts, c, passed}]
const CAP_RE = /^#[0-9a-fA-F]{6}$/;
function runners() {
  if (run && run.day === G.daily.n) return run.list;
  const ok = new Set(ghostList(G.daily.n).map(g => g.fid));
  run = {
    day: G.daily.n,
    list: S.list
      .filter(g => ok.has(g.fid))
      .map(g => {
        let pts = [];
        try {
          pts = unpack(g.d);
        } catch {}
        // (a figure for the drawing of the Wühler, diggerhi.js)
        const c = { x: 0, y: 0, vx: 0, vy: 0, face: 1, anim: 0, inv: [], cap: CAP_RE.test(g.cap) ? g.cap : '#9aa7b8', hat: g.hat || 'none', skin: g.skin };
        return { name: g.name, score: g.score, pts, c, passed: false, at: 0 };
      })
      .filter(g => g.pts.length >= 6),
  };
  return run.list;
}
// where a ghost is at play tick t: null when its run was over by then
function place(g, t) {
  const n = g.pts.length / 3,
    f = t / STEP,
    k = Math.floor(f);
  if (k >= n - 1) return k > n ? null : { x: g.pts[(n - 1) * 3] / 4, y: g.pts[(n - 1) * 3 + 1] / 4, e: g.pts[(n - 1) * 3 + 2], dx: 0 };
  const a = k * 3,
    b = a + 3,
    u = f - k;
  return {
    x: (g.pts[a] + (g.pts[b] - g.pts[a]) * u) / 4,
    y: (g.pts[a + 1] + (g.pts[b + 1] - g.pts[a + 1]) * u) / 4,
    e: g.pts[a + 2],
    dx: g.pts[b] - g.pts[a],
  };
}
// I earned more than a ghost has in the end: say so once
function passTick() {
  if ((G.playTicks || 0) % 30) return;
  const e = G.earned || 0;
  for (const g of runners())
    if (!g.passed && e > g.score) {
      g.passed = true;
      toast('Du hast {name} überholt!', { name: g.name });
    }
}
// drawn over the landscape (render.js): pale Wühler with the name and what they had earned by now
function drawGhosts(ctx, cx, cy, drawDigger, nameTag) {
  if (!active() || G.state !== 'play') return;
  const t = G.playTicks || 0;
  for (const g of runners()) {
    const p = place(g, t);
    if (!p) continue;
    const c = g.c;
    if (Math.abs(p.dx) > 1) c.face = p.dx > 0 ? 1 : -1;
    c.vx = Math.abs(p.dx) > 1 ? c.face : 0;
    if (c.vx) c.anim += 0.2;
    c.x = p.x;
    c.y = p.y;
    g.at = p.e;
    const x = Math.floor(p.x - cx),
      y = Math.floor(p.y - cy);
    if (x < -30 || x > G.VW + 30 || y < -20 || y > G.VH + 10) continue;
    ctx.globalAlpha = 0.45;
    drawDigger(c, x, y, c.face, ctx);
    ctx.globalAlpha = 0.8;
    nameTag(`${g.name} ${p.e}`, x + 3, y - 4, c.cap);
    ctx.globalAlpha = 1;
  }
}
G.drawGhosts = drawGhosts;
// for the HUD of the shift (daily.js status): the ghost just ahead of me, or the best one behind
function ghostRival() {
  if (!active()) return null;
  const e = G.earned || 0,
    list = runners().map(g => ({ name: g.name, e: g.at, score: g.score }));
  if (!list.length) return null;
  const ahead = list.filter(g => g.e > e).sort((a, b) => a.e - b.e)[0];
  return ahead || list.sort((a, b) => b.e - a.e)[0];
}

// ---- "… hat dich überholt" ----
// P.dailyPass: {day, told: {fid: score}, fresh}: whom I already know to be ahead of my best
function passStore() {
  const n = today();
  if (!P.dailyPass || P.dailyPass.day !== n) P.dailyPass = { day: n, told: {}, fresh: true };
  return P.dailyPass;
}
// the friends list came: who went past my best of today since I last looked? Tells it (a toast)
// and returns the names. Friends who were already ahead when I played are not news.
function passCheck(list) {
  const n = today(),
    mine = P.daily?.best?.[n];
  if (mine == null) return [];
  const D = passStore(),
    out = [];
  let dirty = false;
  for (const f of list) {
    if (f.daily == null || f.daily <= mine) continue;
    if (D.told[f.fid] === f.daily) continue;
    if (!D.fresh && !(D.told[f.fid] > mine)) out.push(f);
    D.told[f.fid] = f.daily;
    dirty = true;
  }
  if (D.fresh) {
    D.fresh = false;
    dirty = true;
  }
  if (dirty) saveProfile();
  if (out.length) {
    out.sort((a, b) => b.daily - a.daily);
    D.news = out[0].fid;
    saveProfile();
    toast('{name} hat dich in der Tagesschicht überholt: {n} Taler', { name: out[0].name || '?', n: out[0].daily });
  }
  return out;
}
// a new best of mine (daily.js record): who is still ahead stays known, the others may pass again
// (the next friends list only sets the marks: net/friends.js hands it over at once when it has one)
function passReset() {
  const D = passStore(),
    mine = P.daily?.best?.[today()] ?? 0;
  for (const k of Object.keys(D.told)) if (D.told[k] <= mine) delete D.told[k];
  delete D.news;
  D.fresh = true;
  saveProfile();
}
// the friend who leads today, ahead of my best (the lobby sign and the panel): {name, score, news}
function leader(list) {
  const n = today(),
    mine = P.daily?.best?.[n];
  const f = list.filter(x => x.daily != null && (mine == null || x.daily > mine)).sort((a, b) => b.daily - a.daily)[0];
  if (!f) return null;
  return { name: f.name || '?', score: f.daily, news: P.dailyPass?.day === n && !!P.dailyPass.news };
}
// the news was seen (the Tagesschicht panel was opened)
function passSeen() {
  if (P.dailyPass?.news) {
    delete P.dailyPass.news;
    saveProfile();
  }
}
// "Anna 620 · Bert 480" for the panel and the end card
const ghostLine = n => ghostList(n).map(g => `${g.name} ${g.score}`).join(' · ');
const ghostHint = n => (ghostList(n).length ? tr('👻 Geister deiner Freunde laufen mit: {list}', { list: ghostLine(n) }) : '');

export { drawGhosts, ghostHint, ghostList, ghostRecord, ghostRival, ghostTake, ghostTick, ghostsWanted, leader, myGhost, passCheck, passReset, passSeen };
