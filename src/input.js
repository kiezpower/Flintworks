import { setGoal } from './tapgo.js';
import { NOIN, canToss } from './digger.js';
import { sel_ } from './entities.js';
import { cam, cv } from './render.js';
import { audioInit } from './sound.js';
import { G, crew } from './state.js';
import { closePanel, openBag, openBuild, panelEl, toast, toggleMap, weaponsOf } from './ui.js';
import { navBack, navMove, navOk, pad, rumble } from './gamepad.js';
import { p1HasPad, p2Pad } from './local.js';
import { send } from './commands.js';
import { hasGear } from './tools.js';
import { mapKey } from './keys.js';
import { vehicleOf } from './vehicles/core.js';

// ---- Input ----
const inp = { ax: 0, ay: 0, dig: false, jumpP: false, jumpUp: false, throwP: false, actP: false };
const keys = { l: 0, r: 0, u: 0, d: 0, dig: 0 };
const held = { dig: false };
G.digLatch = false;
G.joyUpArmed = true;
// what the player steers with right now ('touch' or 'keys'), so texts can name the right buttons
G.inputKind = matchMedia('(hover: none), (pointer: coarse)').matches ? 'touch' : 'keys';
// a short shake: the gamepad when one is played right now, else the phone
function buzz(ms) {
  if (G.vibe === false) return;
  try {
    if (G.padUsed && rumble(ms, Math.min(1, 0.25 + ms / 160))) return;
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {}
}
const edge = { jump: false, jumpUp: false, throw: false, act: false };
const joy = { x: 0, y: 0 };
const KEYMAP = {
  ArrowLeft: 'l',
  KeyA: 'l',
  ArrowRight: 'r',
  KeyD: 'r',
  ArrowUp: 'u',
  KeyW: 'u',
  ArrowDown: 'd',
  KeyS: 'd',
  ShiftLeft: 'dig',
  ShiftRight: 'dig',
  KeyX: 'dig',
};
addEventListener('keydown', e => {
  // (arrow keys and Enter a gamepad sends to move through menus are not the game's keys)
  if (e.padNav) return;
  G.inputKind = 'keys';
  G.padUsed = false;
  if (G.state === 'veil') return; // the start screen takes the key (veil.js)
  if (e.code === 'Escape') {
    // Esc closes an open panel, otherwise opens the game menu (also the way to skip the tutorial)
    if (panelEl.hidden && G.state === 'play') G.openMenu?.();
    else closePanel();
    return;
  }
  if (!panelEl.hidden) return;
  // (own keys from the settings stand in for the standard ones, keys.js)
  const code = mapKey(e.code);
  if (code in KEYMAP) {
    keys[KEYMAP[code]] = 1;
    e.preventDefault();
  }
  if (e.repeat) return;
  if (code === 'Space') {
    edge.jump = true;
    e.preventDefault();
  }
  if (code === 'ArrowUp' || code === 'KeyW') edge.jumpUp = true;
  if (code === 'KeyC' || code === 'KeyE' || code === 'KeyK') edge.throw = true;
  if (code === 'KeyF') edge.act = true;
  if (code === 'KeyG') hookKeyDown();
  if (code === 'KeyB') openBuild();
  if (code === 'KeyM') toggleMap();
  if (code === 'KeyI') openBag();
  // quick heal: the first healing potion in the bag (potions.js)
  if (code === 'KeyH') send('quickheal', {});
  // the score in a shared round (scoreboard.js; through G to keep the modules apart)
  if (code === 'KeyP') G.openScore?.();
  if (code === 'Tab') {
    e.preventDefault();
    cycleCrew();
  }
  const c = sel_();
  // (sent like a tap on a slot, so it also works as a guest in multiplayer)
  // the hotbar: the weapons first, then the things in the bag (Q goes round all of them)
  if (c && (code === 'KeyQ' || /^Digit[1-9]$/.test(code)))
    pickSlot(c, code === 'KeyQ' ? 'next' : +code.slice(5) - 1);
  // Enter: a focused button on a card presses itself; otherwise the main button of the screen
  const onCard = document.activeElement?.tagName === 'BUTTON' && document.activeElement.closest('#overlay');
  if (code === 'Enter' && G.state !== 'play' && !onCard)
    document.getElementById(G.state === 'menu' ? 'lbPlay' : 'goBtn')?.click();
});
// a slot of the hotbar: n counted from 0, or 'next' (Q, the pad's LT) for the one after the current
function pickSlot(c, n) {
  const wps = weaponsOf(),
    cur = c.wield ? wps.indexOf(c.wield) : wps.length + c.isel,
    all = wps.length + c.inv.length;
  if (n === 'next') n = all ? (cur + 1) % all : -1;
  if (n >= 0 && n < wps.length) send('wield', { id: wps[n] });
  else if (n >= wps.length && n < all) send('isel', { i: n - wps.length });
}
addEventListener('keyup', e => {
  const code = mapKey(e.code);
  if (code in KEYMAP) keys[KEYMAP[code]] = 0;
  if (code === 'KeyG') hookKeyUp(true);
});
addEventListener('blur', () => {
  for (const k in keys) keys[k] = 0;
  held.dig = false;
  hookKeyUp(false);
});
const game = document.getElementById('game'),
  joyEl = document.getElementById('joy'),
  knob = document.getElementById('knob');
G.joyId = null;
G.jx0 = 0;
G.jy0 = 0;
function joyHome() {
  const r = game.getBoundingClientRect();
  joyEl.style.left = '76px';
  joyEl.style.top = r.height - 80 + 'px';
  knob.style.transform = '';
}
game.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') G.inputKind = 'touch';
  G.padUsed = false;
  audioInit();
  if (G.AC && G.AC.state === 'suspended') G.AC.resume();
  if (e.pointerType === 'mouse' && G.state === 'play' && panelEl.hidden && e.target === cv) {
    setGoal(e.clientX, e.clientY);
    return;
  }
  if (e.pointerType === 'mouse' || G.state !== 'play' || !panelEl.hidden) return;
  if (e.target.closest('button,#hud,#panel,#overlay')) return;
  const r = game.getBoundingClientRect();
  if (e.clientX - r.left > r.width * 0.55) {
    setGoal(e.clientX, e.clientY);
    return;
  }
  G.joyId = e.pointerId;
  G.jx0 = e.clientX;
  G.jy0 = e.clientY;
  joyEl.style.left = G.jx0 - r.left + 'px';
  joyEl.style.top = G.jy0 - r.top + 'px';
  try {
    game.setPointerCapture(e.pointerId);
  } catch {}
  e.preventDefault();
});
game.addEventListener('pointermove', e => {
  if (e.pointerId !== G.joyId) return;
  let dx = e.clientX - G.jx0,
    dy = e.clientY - G.jy0;
  const d = Math.hypot(dx, dy),
    R = 42;
  if (d > R) {
    dx *= R / d;
    dy *= R / d;
  }
  joy.x = dx / R;
  joy.y = dy / R;
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  if (joy.y < -0.7 && Math.abs(joy.x) < 0.75 && G.joyUpArmed) {
    edge.jumpUp = true;
    G.joyUpArmed = false;
  }
  if (joy.y > -0.35) G.joyUpArmed = true;
});
const joyEnd = e => {
  if (e.pointerId !== G.joyId) return;
  G.joyId = null;
  joy.x = joy.y = 0;
  G.joyUpArmed = true;
  joyHome();
};
game.addEventListener('pointerup', joyEnd);
game.addEventListener('pointercancel', joyEnd);
// Aiming buttons (as in mobile shooters): with the bow chosen the "Schießen" button, and the
// "Haken" button for the grappling hook, are their own aiming sticks. A tap uses the default
// (the arrow flies the way you walk, the hook goes to the next ledge or up and forward),
// dragging aims (a dotted line, render.js), letting go shoots or throws. The walking stick
// stays free, so you can run and aim at the same time.
const AIM_R = 34; // px of drag for a full aim
const ready = c => !!c && !c.dead && c.ride == null;
const AIMERS = {
  // (the same button aims the catapult while you sit in one)
  // (and with something in hand it aims the throw: farther the longer the drag, see 'toss')
  throw: {
    kind: c => (vehicleOf(c)?.kind === 'catapult' ? 'catapult' : c.wield === 'bow' ? 'bow' : 'toss'),
    ready: c =>
      (!!c && !c.dead && vehicleOf(c)?.kind === 'catapult') ||
      (ready(c) && c.wield === 'bow') ||
      canToss(c),
    fire: (a, kind) => {
      // a plain tap throws as before (the walking stick still picks high or low)
      if (kind === 'toss' && !a) edge.throw = true;
      else if (kind === 'toss') send('toss', { dx: a.ax, dy: a.ay, p: a.p });
      else send(kind === 'catapult' ? 'catapult' : 'shoot', a ? { dx: a.ax, dy: a.ay } : {});
    },
  },
  hook: {
    kind: 'hook',
    ready: c => ready(c) && hasGear(c, 'hook') && !c.hook,
    fire: a => send('hook', a || {}),
  },
};
let aimFrom = null,
  aimDot = null;
function aimMove(b, e) {
  if (!aimFrom) return;
  const dx = e.clientX - aimFrom.x,
    dy = e.clientY - aimFrom.y,
    d = Math.hypot(dx, dy);
  // (a little wobble of the thumb is still a tap)
  G.aimDrag = d > 10 ? { ax: dx / d, ay: dy / d, p: Math.min(d, AIM_R * 1.6) / (AIM_R * 1.6) } : null;
  const k = Math.min(d, AIM_R) / (d || 1);
  if (!aimDot) {
    aimDot = document.createElement('i');
    aimDot.className = 'aimdot';
    b.appendChild(aimDot);
  }
  aimDot.style.transform = `translate(${dx * k}px,${dy * k}px)`;
  b.classList.toggle('aiming', !!G.aimDrag);
}
function aimEnd(b, fire) {
  if (!aimFrom) return;
  const a = G.aimDrag,
    A = AIMERS[b.dataset.b],
    kind = G.aimKind;
  aimFrom = null;
  G.aimDrag = G.aimKind = null;
  aimDot?.remove();
  aimDot = null;
  b.classList.remove('aiming', 'on');
  if (fire) A.fire(a, kind);
}
for (const b of document.querySelectorAll('.pad')) {
  const name = b.dataset.b;
  let t0 = 0;
  const A = AIMERS[name];
  if (A) {
    b.addEventListener('pointermove', e => aimMove(b, e));
    b.addEventListener('pointerup', () => aimEnd(b, true));
    b.addEventListener('pointercancel', () => aimEnd(b, false));
  }
  b.addEventListener('pointerdown', e => {
    t0 = performance.now();
    if (A && A.ready(sel_())) {
      aimFrom = { x: e.clientX, y: e.clientY };
      G.aimDrag = null;
      G.aimKind = typeof A.kind === 'function' ? A.kind(sel_()) : A.kind;
      b.classList.add('on');
      buzz(8);
      try {
        b.setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
      return;
    }
    // the grappling hook: one shot per tap, run on the host like stairs and bridges (climb.js)
    if (name === 'hook') {
      send('hook', aim());
      b.classList.add('on');
    } else if (name === 'heal') {
      send('quickheal', {});
      buzz(10);
    } else if (name === 'dig') {
      if (G.digLatch) {
        G.digLatch = false;
        held.dig = false;
        b.classList.remove('on');
        b.dataset.skip = '1';
      } else {
        held.dig = true;
        b.classList.add('on');
      }
    } else {
      edge[name] = true;
      b.classList.add('on');
    }
    buzz(8);
    try {
      b.setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault();
  });
  const up = () => {
    if (name === 'dig') {
      if (b.dataset.skip) {
        delete b.dataset.skip;
        return;
      }
      if (!held.dig) return;
      if (performance.now() - t0 < 230) {
        G.digLatch = true;
        toast('Gräbt weiter – nochmal tippen stoppt');
      } else {
        held.dig = false;
        b.classList.remove('on');
      }
      return;
    }
    b.classList.remove('on');
  };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
// where the grappling hook is thrown: the stick or the arrow keys held right now
// (or a gamepad's left stick)
const aim = () => ({ ax: keys.r - keys.l || joy.x || padStick.ax, ay: keys.d - keys.u || joy.y || padStick.ay });
// The hook with the mouse (desktop): holding G aims at the mouse pointer (the same dotted rope
// as dragging the "Haken" button), letting go throws. With the pointer on the Wühler it goes
// for the next ledge; an arrow key held when G goes down or up still aims as before.
const mouse = { x: 0, y: 0, in: false };
game.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.in = true;
});
game.addEventListener('pointerleave', e => {
  if (e.pointerType === 'mouse') mouse.in = false;
});
const MOUSE_NEAR = 8; // world px around the Wühler's middle where the pointer means "no direction"
let hookHeld = false;
// the direction from the Wühler to the mouse pointer, or null when it is on him (or not there)
function mouseAim(c) {
  if (!mouse.in || !c) return null;
  const r = cv.getBoundingClientRect(),
    k = r.width / G.VW,
    dx = (mouse.x - r.left) / k + Math.round(cam.x) - (c.x + 3),
    dy = (mouse.y - r.top) / k + Math.round(cam.y) - (c.y + 4),
    d = Math.hypot(dx, dy);
  return d > MOUSE_NEAR ? { ax: dx / d, ay: dy / d } : null;
}
const keyAimed = () => !!(keys.l || keys.r || keys.u || keys.d || padStick.ax || padStick.ay);
function hookKeyDown() {
  const c = sel_();
  // no mouse on the field (or no hook to throw): thrown at once, as with the arrow keys
  if (!mouse.in || keyAimed() || !AIMERS.hook.ready(c)) return send('hook', aim());
  hookHeld = true;
  G.aimKind = 'hook';
  G.aimDrag = mouseAim(c);
}
function hookKeyUp(fire) {
  if (!hookHeld) return;
  hookHeld = false;
  const a = keyAimed() ? aim() : mouseAim(sel_());
  if (G.aimKind === 'hook') G.aimDrag = G.aimKind = null;
  if (fire && panelEl.hidden && G.state === 'play') send('hook', a || {});
}
// the first gamepad (gamepad.js): in the game it steers like the keys, in menus it moves the focus
// (a second pad steers the second player of a shared screen, local.js)
// The right stick aims like dragging the throw button (the dotted line, render.js): Y then shoots,
// throws or fires the catapult that way, LB throws the hook that way. Back in the middle: no aim.
let padStick = { ax: 0, ay: 0, dig: false };
let padAim = null; // the right stick's aim while it is pushed, else null
function padAimTick(P) {
  const r = Math.hypot(P.rx, P.ry),
    c = sel_(),
    A = AIMERS.throw;
  // (a finger on an aiming button or the hook held with the mouse have the line)
  if (aimFrom || hookHeld) return (padAim = null);
  if (r > 0.45 && A.ready(c)) {
    padAim = { ax: P.rx / r, ay: P.ry / r, p: Math.min(1, (r - 0.3) / 0.7) };
    G.aimKind = A.kind(c);
    G.aimDrag = padAim;
  } else if (padAim) {
    padAim = null;
    G.aimDrag = G.aimKind = null;
  }
  // (the hook takes the stick's way even when the throw button has nothing to aim)
  return r > 0.45 ? { ax: P.rx / r, ay: P.ry / r } : null;
}
function readPad() {
  padStick = { ax: 0, ay: 0, dig: false };
  // (two at one device with one pad: that pad is the second player's, local.js; menus still use it,
  // and a panel the second player opened is moved through with his pad)
  const menu = G.state !== 'play' || !panelEl.hidden;
  const P = menu && G.local && G.panelPid === 1 ? pad(p2Pad()) : p1HasPad() || menu ? pad(0) : null;
  if (!P) return;
  if (P.any) {
    G.inputKind = 'keys';
    G.padUsed = true;
  }
  if (menu) {
    if (padAim) padAim = G.aimDrag = G.aimKind = null;
    if (P.dir) navMove(P.dir);
    if (P.ok) navOk();
    if (P.back) navBack();
    if (P.menu && G.state === 'play') closePanel();
    return;
  }
  // watching a shared round: left and right switch whom the camera follows, A steps in
  if (G.watching && G.net) {
    if (P.dir === 'Left') G.watchCycle?.(-1);
    if (P.dir === 'Right') G.watchCycle?.(1);
    if (P.ok) G.watchPlay?.();
    return;
  }
  padStick = { ax: P.ax, ay: P.ay, dig: P.dig };
  const rs = padAimTick(P);
  if (P.jumpP) edge.jump = true;
  if (P.throwP) {
    if (padAim) AIMERS.throw.fire(padAim, G.aimKind);
    else edge.throw = true;
  }
  if (P.actP) edge.act = true;
  if (P.next && sel_()) pickSlot(sel_(), 'next');
  if (P.build) openBuild();
  if (P.hookDown && rs) send('hook', rs);
  else if (P.hookDown) hookKeyDown();
  if (P.hookUp) hookKeyUp(true);
  if (P.menu) G.openMenu?.();
  if (P.map) toggleMap();
  if (P.heal) send('quickheal', {});
}
function readInput() {
  readPad();
  // (the rope follows the pointer, and the Wühler, while G is held)
  if (hookHeld) G.aimDrag = keyAimed() ? null : mouseAim(sel_());
  const kx = keys.r - keys.l,
    ky = keys.d - keys.u;
  inp.ax = kx || joy.x || padStick.ax;
  inp.ay = ky || joy.y || padStick.ay;
  inp.dig = !!(keys.dig || held.dig || G.digLatch || padStick.dig);
  inp.auto = !!G.autoDig;
  inp.jumpP = edge.jump || edge.jumpUp;
  inp.jumpUp = edge.jumpUp && !edge.jump;
  inp.throwP = edge.throw;
  inp.actP = edge.act;
  edge.jump = edge.jumpUp = edge.throw = edge.act = false;
}
// you always play your own Wühler now; kept so old key bindings do nothing harmful
function cycleCrew() {}
function selectCrew() {}

export {
  KEYMAP,
  buzz,
  cycleCrew,
  edge,
  game,
  held,
  inp,
  joy,
  joyEl,
  joyEnd,
  joyHome,
  keys,
  knob,
  readInput,
  selectCrew,
};
