// Gamepads (Xbox / PlayStation layout, the browser's "standard" mapping). Read once a tick from
// readInput (input.js). In the game:
//   left stick / d-pad  walk, aim          A  jump            X or right trigger (held)  dig
//   B  action (castle, open, chop …)       Y  throw / use     RB build    LB hook (hold, let go)
//   right stick  aim the throw, the bow, the catapult (and the hook)   LT  next weapon / item
//   Start  menu                            Back / Select  map
// The buttons go by where they sit (the browser's standard mapping): the bottom one jumps on every
// pad. Only the names differ (labels(): Xbox A/B/X/Y, PlayStation ✕/○/□/△, Nintendo B/A/Y/X).
// rumble() shakes the pad played last, where the browser can (vibrationActuator).
// In panels, the lobby and the level selection the pad moves the focus: d-pad or stick to the
// next button in that direction, A presses it, B goes back (like Escape).
// pad(n) gives the n-th connected pad's state for a second player (local play, coop.js).
import { G } from './state.js';
import { toast } from './ui.js';

const DEAD = 0.28;
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// the name of each button, by the kind of pad (where the button sits is the same on all of them)
const NAMES = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', START: 'Start', BACK: 'Select' },
  ps: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', START: 'Options', BACK: 'Share' },
  nintendo: { A: 'B', B: 'A', X: 'Y', Y: 'X', LB: 'L', RB: 'R', LT: 'ZL', RT: 'ZR', START: '+', BACK: '−' },
};
// what kind of pad it is, from the name the browser gives it (vendor 057e Nintendo, 054c Sony)
function kindOf(id = '') {
  if (/057e|nintendo|joy-con|pro controller/i.test(id)) return 'nintendo';
  if (/054c|playstation|dualsense|dualshock|wireless controller/i.test(id)) return 'ps';
  return 'xbox';
}
let lastUsed = null; // the pad played last (index and name), for labels() and rumble()
const last = new Map(); // pad index → buttons pressed in the last poll (for presses, not holds)
const navLast = new Map(); // pad index → direction of the last menu move (and when, for repeats)

function connected() {
  try {
    return [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(p => p && p.connected);
  } catch {
    return [];
  }
}
// the state of the n-th connected pad, or null: stick and buttons, and what was just pressed
function pad(n = 0) {
  const p = connected()[n];
  if (!p) return null;
  const down = k => {
    const b = p.buttons[k];
    return !!b && (b.pressed || b.value > 0.5);
  };
  const prev = last.get(p.index) || {},
    now = {};
  for (const k in B) now[k] = down(B[k]);
  last.set(p.index, now);
  const hit = k => now[k] && !prev[k],
    off = k => !now[k] && prev[k];
  let ax = Math.abs(p.axes[0] || 0) > DEAD ? p.axes[0] : 0,
    ay = Math.abs(p.axes[1] || 0) > DEAD ? p.axes[1] : 0;
  if (now.LEFT) ax = -1;
  if (now.RIGHT) ax = 1;
  if (now.UP) ay = -1;
  if (now.DOWN) ay = 1;
  const rx = Math.abs(p.axes[2] || 0) > DEAD ? p.axes[2] : 0,
    ry = Math.abs(p.axes[3] || 0) > DEAD ? p.axes[3] : 0;
  const any = Object.values(now).some(Boolean) || ax || ay || rx || ry;
  if (any) lastUsed = { index: p.index, id: p.id };
  return {
    index: p.index,
    any: !!any,
    ax,
    ay,
    rx,
    ry,
    dig: now.X || now.RT,
    jumpP: hit('A'),
    throwP: hit('Y'),
    actP: hit('B'),
    build: hit('RB'),
    hookDown: hit('LB'),
    hookUp: off('LB'),
    next: hit('LT'),
    menu: hit('START'),
    map: hit('BACK'),
    // for the menus: A, B and a direction (repeats while held)
    ok: hit('A'),
    back: hit('B'),
    dir: dirOf(p.index, ax, ay),
  };
}
// a menu step: the first push at once, then again every 180 ms while held
function dirOf(i, ax, ay) {
  const d = Math.abs(ax) > 0.6 ? (ax > 0 ? 'Right' : 'Left') : Math.abs(ay) > 0.6 ? (ay > 0 ? 'Down' : 'Up') : null,
    l = navLast.get(i),
    t = performance.now();
  if (!d) {
    navLast.delete(i);
    return null;
  }
  if (l && l.d === d && t - l.t < (l.n ? 180 : 380)) return null;
  navLast.set(i, { d, t, n: l && l.d === d ? l.n + 1 : 0 });
  return d;
}

// ---- moving through menus ----
const visible = el => {
  if (!el || el.disabled) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) return false;
  return getComputedStyle(el).visibility !== 'hidden' && el.closest('[hidden]') == null;
};
// what can take the focus in front: an open panel first, else the whole page
function focusables() {
  const panel = document.getElementById('panel');
  const root = panel && !panel.hidden ? panel : document;
  return [...root.querySelectorAll('button, [tabindex]:not([tabindex="-1"]), input, select, a[href]')].filter(visible);
}
// the nearest button in that direction (centre to centre, the straight way counts more)
function navMove(dir) {
  const list = focusables();
  if (!list.length) return;
  const cur = document.activeElement;
  if (!list.includes(cur)) return list[0].focus();
  // a part of the page that moves itself with the arrow keys (the level selection) gets the key
  const ev = new KeyboardEvent('keydown', { key: 'Arrow' + dir, code: 'Arrow' + dir, bubbles: true, cancelable: true });
  ev.padNav = true; // (the game's own keys leave it alone, input.js)
  if (!cur.dispatchEvent(ev) || document.activeElement !== cur) return;
  const a = cur.getBoundingClientRect(),
    ax = a.left + a.width / 2,
    ay = a.top + a.height / 2,
    v = { Up: [0, -1], Down: [0, 1], Left: [-1, 0], Right: [1, 0] }[dir];
  let best = null,
    bd = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect(),
      dx = r.left + r.width / 2 - ax,
      dy = r.top + r.height / 2 - ay,
      along = dx * v[0] + dy * v[1];
    if (along <= 2) continue;
    const side = Math.abs(dx * v[1] + dy * v[0]),
      d = along + side * 2.5;
    if (d < bd) {
      bd = d;
      best = el;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
}
function navOk() {
  // the start screen goes on with any key (veil.js)
  if (G.state === 'veil') return dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' }));
  const el = document.activeElement;
  if (!el || el === document.body) return navMove('Down');
  if (el.matches('button, a[href], input[type=checkbox]')) return el.click();
  const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
  ev.padNav = true;
  el.dispatchEvent(ev);
}
function navBack() {
  const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
  (document.activeElement || document.body).dispatchEvent(ev);
}
const padCount = () => connected().length;
// the button names of a pad (the one played last, else the first one plugged in)
function labels(id) {
  return NAMES[kindOf(id ?? lastUsed?.id ?? connected()[0]?.id)];
}
// shake the pad played last (both motors; strength from 0 to 1); false where it cannot
function rumble(ms, strength = 0.6) {
  try {
    const p = lastUsed && connected().find(q => q.index === lastUsed.index),
      v = p && p.vibrationActuator;
    if (!v || !v.playEffect) return false;
    v.playEffect(v.type || 'dual-rumble', {
      duration: Math.round(ms),
      strongMagnitude: Math.min(1, strength),
      weakMagnitude: Math.min(1, strength * 0.8),
    }).catch?.(() => {});
    return true;
  } catch {
    return false;
  }
}
// a pad plugged in: a short line saying so (and how the buttons go, with this pad's names)
addEventListener('gamepadconnected', e => {
  const n = labels(e.gamepad?.id);
  toast('Gamepad verbunden: {j} springen, {d} graben, {a} Aktion, {t} werfen, {w} Waffe', {
    j: n.A,
    d: n.X,
    a: n.B,
    t: n.Y,
    w: n.LT,
  });
});
G.padCount = padCount;
G.padLabels = labels;

export { kindOf, labels, navBack, navMove, navOk, pad, padCount, rumble };
