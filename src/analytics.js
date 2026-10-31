// Analytics: one place for every funnel event (docs/ANALYTICS.md). An event has a stable,
// language-independent name from the table below and only the fields listed there; every event
// gets the same context (session, order, time, version, platform, input, language). Nothing
// personal: no player name, no device id, no position in the world.
//
// Events are kept on this device only (a ring buffer in localStorage) – there is no provider
// yet. setSink(fn) hands every event to a provider later; it is called asynchronously and its
// errors are swallowed, so blocked storage, being offline or a broken provider never touch the
// game. A provider that sends data away needs the player's consent first (see the docs).
import { getLang } from './i18n.js';
import { isNative } from './platform.js';
import { G } from './state.js';

const KEY = 'flintworks-analytics';
const MAX = 300; // events kept on the device
// name → allowed fields and their type ('n' number, 's' string, 'b' boolean); once: at most once
// per session (true) or per tutorial run ('run')
const EVENTS = {
  app_open: { f: { first: 'b', days_since: 'n' }, once: true },
  onb_start: { f: { entry: 's' }, once: 'run' },
  onb_first_input: { f: { ms: 'n', kind: 's' }, once: 'run' },
  onb_step_start: { f: { step: 's', i: 'n' } },
  onb_first_action: { f: { kind: 's', sec: 'n' } },
  onb_hint: { f: { step: 's', level: 's' } },
  onb_rescue: { f: { step: 's', kind: 's' } },
  onb_recover: { f: { kind: 's' } },
  onb_step_done: { f: { step: 's', i: 'n', sec: 'n', prompted: 'b', hints: 'n' } },
  onb_first_success: { f: { sec: 'n', money: 'n' }, once: 'run' },
  onb_skip: { f: { step: 's', sec: 'n', via: 's' }, once: 'run' },
  onb_menu: { f: { action: 's' } },
  onb_complete: { f: { sec: 'n', hints: 'n', skilled: 'b' }, once: 'run' },
  onb_card: { f: { choice: 's', result: 's' }, once: 'run' },
  onb_exit: { f: { step: 's', sec: 'n' } },
  onb_resume: { f: { step: 's' } },
  core_round_start: { f: { mode: 's', after_onb: 'b' } },
  session_end: { f: { sec: 'n', state: 's' }, once: true },
};
const TYPES = { n: 'number', s: 'string', b: 'boolean' };
const sid = Math.random().toString(36).slice(2, 10);
const t0 = performance.now();
let seq = 0,
  run = 0,
  sink = null;
const seen = new Set();
let buf = [];
try {
  buf = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (!Array.isArray(buf)) buf = [];
} catch {
  buf = [];
}
const platform = () => (isNative() ? 'android' : matchMedia?.('(display-mode: standalone)').matches ? 'pwa' : 'web');
function bad(msg) {
  if (import.meta.env.DEV) console.warn('[analytics]', msg);
  return null;
}
// check an event against the table; the cleaned fields, or null when it is not valid
function check(name, props) {
  const spec = EVENTS[name];
  if (!spec) return bad(`unknown event ${name}`);
  const out = {};
  for (const k in props) {
    if (!(k in spec.f)) return bad(`${name}: unknown field ${k}`);
    const v = props[k];
    if (typeof v !== TYPES[spec.f[k]] || (typeof v === 'number' && !Number.isFinite(v)))
      return bad(`${name}: ${k} should be ${TYPES[spec.f[k]]}`);
    out[k] = typeof v === 'number' ? Math.round(v * 10) / 10 : v;
  }
  return out;
}
// record one event; returns it, or null when it was invalid or a duplicate
function ev(name, props = {}) {
  try {
    const f = check(name, props);
    if (!f) return null;
    const once = EVENTS[name].once;
    if (once) {
      const k = once === 'run' ? `${name}#${run}` : name;
      if (seen.has(k)) return null;
      seen.add(k);
    }
    const e = {
      e: name,
      ...f,
      sid,
      seq: ++seq,
      t: Math.round(performance.now() - t0),
      v: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
      plat: platform(),
      input: G.inputKind || 'keys',
      lang: getLang(),
    };
    buf.push(e);
    if (buf.length > MAX) buf.splice(0, buf.length - MAX);
    persist();
    if (sink) {
      const s = sink;
      setTimeout(() => {
        try {
          s(e);
        } catch {
          // a broken provider must not break the game
        }
      }, 0);
    }
    if (import.meta.env.DEV) G.onEvent?.(e);
    return e;
  } catch {
    return null;
  }
}
// written at once: events are rare (a few dozen a session) and the last ones come while the page
// is going away (pagehide), when a timer would not run any more
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(buf));
  } catch {
    // storage full or blocked: the events stay in memory for this session
  }
}
// a new tutorial run: its once-per-run events may come again
const newRun = () => run++;
const setSink = fn => (sink = typeof fn === 'function' ? fn : null);
const events = () => buf.slice();
const sessionEvents = () => buf.filter(e => e.sid === sid);
function clearEvents() {
  buf = [];
  seen.clear();
  persist();
}

// the visit: first time, or how many days since the last one (a return)
(() => {
  let last = null;
  try {
    last = Number(localStorage.getItem(KEY + '-last')) || null;
    localStorage.setItem(KEY + '-last', String(Date.now()));
  } catch {}
  ev('app_open', { first: !last, days_since: last ? Math.floor((Date.now() - last) / 86400000) : 0 });
})();
// (registered after the other modules' own pagehide events, so the session ends last)
setTimeout(() =>
  addEventListener('pagehide', () => {
    ev('session_end', { sec: (performance.now() - t0) / 1000, state: String(G.state || '') });
  }),
);

export { EVENTS, clearEvents, ev, events, newRun, sessionEvents, setSink };
