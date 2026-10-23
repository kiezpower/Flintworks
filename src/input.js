import { NOIN } from './clonk.js';
import { midMat, sel_ } from './entities.js';
import { startGame } from './main.js';
import { cam, cv } from './render.js';
import { audioInit } from './sound.js';
import { G, crew } from './state.js';
import { closePanel, openBuild, panelEl, toast, toggleMap } from './ui.js';
import { LIQ } from './world.js';

// ---- Input ----
const inp = { ax: 0, ay: 0, dig: false, jumpP: false, jumpUp: false, throwP: false, actP: false };
const keys = { l: 0, r: 0, u: 0, d: 0, dig: 0 };
const held = { dig: false };
G.digLatch = false;
G.joyUpArmed = true;
function buzz(ms) {
  try {
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
  if (e.code === 'Escape') {
    closePanel();
    return;
  }
  if (!panelEl.hidden) return;
  if (e.code in KEYMAP) {
    keys[KEYMAP[e.code]] = 1;
    e.preventDefault();
  }
  if (e.repeat) return;
  if (e.code === 'Space') {
    edge.jump = true;
    e.preventDefault();
  }
  if (e.code === 'ArrowUp' || e.code === 'KeyW') edge.jumpUp = true;
  if (e.code === 'KeyC' || e.code === 'KeyE' || e.code === 'KeyK') edge.throw = true;
  if (e.code === 'KeyF') edge.act = true;
  if (e.code === 'KeyB') openBuild();
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'Tab') {
    e.preventDefault();
    cycleCrew();
  }
  const c = sel_();
  if (e.code === 'KeyQ' && c && c.inv.length) c.isel = (c.isel + 1) % c.inv.length;
  if (/^Digit[1-5]$/.test(e.code) && c) {
    const n = +e.code.slice(5) - 1;
    if (n < c.inv.length) c.isel = n;
  }
  if (e.code === 'Enter' && G.state !== 'play') startGame();
});
addEventListener('keyup', e => {
  if (e.code in KEYMAP) keys[KEYMAP[e.code]] = 0;
});
addEventListener('blur', () => {
  for (const k in keys) keys[k] = 0;
  held.dig = false;
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
  audioInit();
  if (G.AC && G.AC.state === 'suspended') G.AC.resume();
  if (e.pointerType === 'mouse' && G.state === 'play' && panelEl.hidden && e.target === cv) {
    tapSelect(e.clientX, e.clientY);
    return;
  }
  if (e.pointerType === 'mouse' || G.state !== 'play' || !panelEl.hidden) return;
  if (e.target.closest('button,#hud,#panel,#overlay')) return;
  const r = game.getBoundingClientRect();
  if (e.clientX - r.left > r.width * 0.55) {
    tapSelect(e.clientX, e.clientY);
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
for (const b of document.querySelectorAll('.pad')) {
  const name = b.dataset.b;
  let t0 = 0;
  b.addEventListener('pointerdown', e => {
    t0 = performance.now();
    if (name === 'dig') {
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
function readInput() {
  const kx = keys.r - keys.l,
    ky = keys.d - keys.u;
  inp.ax = kx || joy.x;
  inp.ay = ky || joy.y;
  inp.dig = !!(keys.dig || held.dig || G.digLatch);
  inp.jumpP = edge.jump || edge.jumpUp;
  inp.jumpUp = edge.jumpUp && !edge.jump;
  inp.throwP = edge.throw;
  inp.actP = edge.act;
  edge.jump = edge.jumpUp = edge.throw = edge.act = false;
}
function followAI(c, n) {
  const s = sel_();
  if (!s || s.dead) return NOIN;
  const tx = s.x + (n < G.sel ? -8 : 8) * (1 + Math.abs(n - G.sel) * 0.5),
    dx = tx - c.x,
    dy = s.y - c.y;
  if (Math.abs(dx) < 6 && Math.abs(dy) < 12) return NOIN;
  const I = { ...NOIN };
  if (Math.abs(dx) > 4) I.ax = Math.sign(dx);
  if (dy < -12 && Math.abs(dx) < 20 && G.frame % 40 === (n * 7) % 40) I.jumpP = true;
  if (c.climb && dy < 0) I.ay = -1;
  if (LIQ[midMat(c, 0.1)]) I.ay = -1;
  if (Math.abs(dx) > 200 || Math.abs(dy) > 80) return NOIN;
  return I;
}
function tapSelect(clx, cly) {
  const r = cv.getBoundingClientRect(),
    k = r.width / G.VW;
  const wx = (clx - r.left) / k + Math.round(cam.x),
    wy = (cly - r.top) / k + Math.round(cam.y);
  let best = -1,
    bd = 10;
  crew.forEach((c, n) => {
    if (c.dead) return;
    const d = Math.hypot(c.x + 3 - wx, c.y + 5 - wy);
    if (d < bd) {
      bd = d;
      best = n;
    }
  });
  if (best >= 0 && best !== G.sel) {
    selectCrew(best);
    toast(crew[best].name);
  }
}
function cycleCrew() {
  if (!crew.length) return;
  for (let k = 1; k <= crew.length; k++) {
    const n = (G.sel + k) % crew.length;
    if (!crew[n].dead) {
      selectCrew(n);
      return;
    }
  }
}
function selectCrew(n) {
  if (crew[n] && !crew[n].dead) {
    const o = sel_();
    if (o) {
      o.chop = null;
    }
    G.sel = n;
  }
}

export {
  KEYMAP,
  buzz,
  cycleCrew,
  edge,
  followAI,
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
  tapSelect,
};
