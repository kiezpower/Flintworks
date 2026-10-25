import { P, saveProfile, track } from './profile.js';
// Guided first game ("Die erste Schicht") in its own small world: one task at a time with an
// arrow to the goal, a pulsing button, rescues when the player is stuck and a closing card.
// The steps are in tutsteps.js, the world in tutlevel.js.
import { sel_ } from './entities.js';
import { tr } from './i18n.js';
import { mode } from './modes.js';
import { sfx } from './sound.js';
import { G } from './state.js';
import { STEPS } from './tutsteps.js';
import { closePanel, mapView, toast } from './ui.js';

const box = document.getElementById('quest');
const stepTxt = document.getElementById('questStep');
const goalTxt = document.getElementById('questText');
const skipBtn = document.getElementById('questSkip');
const overlay = document.getElementById('overlay'),
  card = document.getElementById('card');
// play and menu come from main.js (set once at start, avoids an import cycle)
let hooks = {};
const setTutHooks = h => (hooks = h);
const stepOf = () => G.tut && STEPS[G.tut.i];

// a text can be plain, per input ({ touch, keys }) or worked out right now
function say(v, c, s) {
  if (typeof v === 'function') v = v(c, s);
  if (v && typeof v === 'object') v = v[G.inputKind] || v.touch;
  return v || null;
}

// ---- progress kept in the profile: where players get stuck, how long each step takes ----
function stats() {
  return (P.tutStats ||= { runs: 0, done: 0, skips: {}, steps: {}, rescues: {} });
}
function noteStep(id, ticks) {
  const st = (stats().steps[id] ||= { n: 0, ticks: 0 });
  st.n++;
  st.ticks += ticks;
}

function enterStep(i) {
  const c = sel_();
  G.tut = { i, s: { t: 0, x0: c ? c.x : 0, dig: 0, money0: G.money, help: 0 } };
  STEPS[i].enter?.(c, G.tut.s);
  showStep();
}
function showStep() {
  stepTxt.textContent = `${G.tut.i + 1}/${STEPS.length}`;
  goalTxt.textContent = tr(say(stepOf().text, sel_(), G.tut.s) || '');
  skipBtn.textContent = tr('Überspringen');
  box.hidden = false;
}
function startTutorial() {
  stats().runs++;
  saveProfile();
  enterStep(0);
}
// after loading a saved tutorial game, or back from the lobby
function resumeTutorial() {
  if (!G.tut || !STEPS[G.tut.i]) return (G.tut = null);
  showStep();
}
// result: 'done', 'skip' or nothing (a game without the tutorial)
function endTutorial(result) {
  const i = G.tut ? G.tut.i : 0;
  G.tut = null;
  box.hidden = true;
  tutHud();
  if (!result) return;
  P.tutorialDone = true;
  if (result === 'skip') stats().skips[STEPS[i].id] = (stats().skips[STEPS[i].id] || 0) + 1;
  else {
    stats().done++;
    sfx('fanfare');
    track('tutorial');
  }
  saveProfile();
  if (mode().tutorial) finishCard(result);
}

// the closing card: straight into a real round, or back to the lobby
function finishCard(result) {
  G.state = 'won'; // the world stops behind the card
  closePanel();
  mapView.hidden = true;
  const s = Math.round((G.playTicks || 0) / 60);
  card.innerHTML =
    result === 'done'
      ? `<h1>${tr('Erste Schicht geschafft!')}</h1>
         <p>${tr('Graben · Sprengen · Verkaufen · Bauen · Crew')}</p>
         <p class="hint">${tr('Zeit {time}', { time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })}</p>`
      : `<h1>${tr('Tutorial übersprungen')}</h1>
         <p class="hint">${tr('Du findest es jederzeit in den Optionen')}</p>`;
  card.innerHTML += `<button class="go" id="goBtn">${tr('Erste echte Runde')}</button>
    <button class="lb-new" id="tutLobby">${tr('Zur Lobby')}</button>`;
  const leave = () => {
    overlay.hidden = true;
    hooks.discard();
  };
  document.getElementById('goBtn').onclick = () => {
    leave();
    hooks.play(false);
  };
  document.getElementById('tutLobby').onclick = () => {
    leave();
    hooks.menu();
  };
  overlay.hidden = false;
}

// skipping needs a second tap, so a stray touch does not end it
let skipArmed = -Infinity;
skipBtn.addEventListener('click', () => {
  if (performance.now() - skipArmed > 3000) {
    skipArmed = performance.now();
    skipBtn.textContent = tr('Wirklich?');
    setTimeout(() => G.tut && (skipBtn.textContent = tr('Überspringen')), 3000);
    return;
  }
  skipArmed = -Infinity;
  endTutorial('skip');
});

// every frame of play; paused: a panel is open (the build menu, the crew) – no clock, no rescues
function updTutorial(paused = false) {
  if (!G.tut) return;
  const c = sel_();
  if (!c || c.dead) return;
  const step = stepOf(),
    s = G.tut.s;
  if (!paused) {
    s.t++;
    step.tick?.(c, s);
    // stuck for a while: the next rescue changes the text or lends a hand
    const r = step.rescue?.[s.help];
    if (r && s.t > r.after * 60) {
      s.help++;
      r.run?.(c, s);
      stats().rescues[step.id] = (stats().rescues[step.id] || 0) + 1;
      s.helpTxt = r.text || s.helpTxt;
    }
  }
  const text = tr(say(s.helpTxt, c, s) || say(step.text, c, s) || '');
  if (goalTxt.textContent !== text) goalTxt.textContent = text;
  if (!step.done(c, s)) return;
  noteStep(step.id, s.t);
  step.leave?.(c, s);
  sfx('pick');
  if (step.praise) toast(step.praise);
  if (G.tut.i + 1 < STEPS.length) enterStep(G.tut.i + 1);
  else endTutorial('done');
}

// ---- the pulsing frame around the button of the current step ----
let lit = [];
function tutHud() {
  const c = G.tut && G.state === 'play' && sel_();
  const sel = c ? say(stepOf().hl, c, G.tut.s) : null;
  const els = sel ? [...document.querySelectorAll(sel)] : [];
  for (const e of lit) if (!els.includes(e)) e.classList.remove('tut-hl');
  for (const e of els)
    if (!e.classList.contains('tut-hl')) {
      e.classList.add('tut-hl');
      if (e.closest('#panel')) e.scrollIntoView({ block: 'nearest' });
    }
  lit = els;
}

// yellow arrow above the goal, or at the screen edge pointing towards it
function drawTutorial(ctx, cx, cy) {
  const c = G.tut && sel_();
  const t = c && stepOf().target?.(c, G.tut.s);
  if (!t) return;
  const sx = t.x - cx,
    sy = t.y - cy - 6 + Math.sin(G.frame * 0.15) * 2;
  const m = 8,
    inside = sx > m && sx < G.VW - m && sy > m && sy < G.VH - m;
  const x = Math.min(G.VW - m, Math.max(m, sx)),
    y = Math.min(G.VH - m, Math.max(m, sy));
  const ang = inside ? Math.PI / 2 : Math.atan2(sy - y, sx - x);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(ang);
  ctx.fillStyle = '#1a120c';
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.fill();
  ctx.fillStyle = '#f2c230';
  ctx.beginPath();
  ctx.moveTo(3.5, 0);
  ctx.lineTo(-3, -3.5);
  ctx.lineTo(-3, 3.5);
  ctx.fill();
  ctx.restore();
}

export { STEPS, drawTutorial, endTutorial, resumeTutorial, setTutHooks, startTutorial, tutHud, updTutorial };
