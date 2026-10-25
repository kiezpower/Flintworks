import { P, saveProfile, track } from './profile.js';
// Guided first game ("Die erste Schicht") in its own small world: one task at a time with an
// arrow to the goal, a pulsing button, rescues when the player is stuck and a closing card.
// The steps are in tutsteps.js, the world in tutlevel.js.
import { sel_ } from './entities.js';
import { addFloat } from './floats.js';
import { tr } from './i18n.js';
import { mode } from './modes.js';
import { sfx } from './sound.js';
import { SPR, itemIcon } from './sprites.js';
import { G, parts } from './state.js';
import { STEPS } from './tutsteps.js';
import { closePanel, mapView, toast, toastEl } from './ui.js';

const box = document.getElementById('quest');
const stepTxt = document.getElementById('questStep');
const goalTxt = document.getElementById('questText');
const skipBtn = document.getElementById('questSkip');
const overlay = document.getElementById('overlay'),
  card = document.getElementById('card');
// ghost hand on touch screens: shows the gesture of the step (slide the stick, tap a button)
const hand = document.createElement('div');
hand.id = 'tutHand';
document.getElementById('game').appendChild(hand);
const REWARD = 50; // start money for the first real round
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
  stepAt = performance.now();
  STEPS[i].enter?.(c, G.tut.s);
  showStep();
}
let stepAt = 0; // when the current step began (real time, also runs while a panel is open)
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
  stepAt = performance.now();
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
    // the reward: the miner's helmet (put on if you wear none) and start money for the next round
    if (!P.hats.includes('helm')) P.hats.push('helm');
    if (P.hat === 'none') P.hat = 'helm';
    P.tutBonus = REWARD;
  }
  saveProfile();
  if (!mode().tutorial) return;
  if (result === 'skip') return finishCard(result);
  // a moment of confetti over the castle before the card
  closePanel();
  mapView.hidden = true;
  confetti();
  setTimeout(() => G.state === 'play' && finishCard(result), 1500);
}
function confetti() {
  const COLS = ['#f2c230', '#e0572f', '#3f9e4a', '#2f7fd0', '#f2f2f2', '#d04f8a'];
  const c = sel_(),
    spots = [{ x: G.base.x + G.base.w / 2, y: G.base.gy - G.base.h }];
  if (c) spots.push({ x: c.x + 3, y: c.y });
  for (const o of spots)
    for (let q = 0; q < 70; q++)
      parts.push({
        x: o.x + (Math.random() - 0.5) * 8,
        y: o.y,
        vx: (Math.random() - 0.5) * 2.6,
        vy: -1.2 - Math.random() * 2.4,
        l: 90 + Math.random() * 60,
        c: COLS[q % COLS.length],
        g: 0.045,
      });
}

// the closing card: straight into a real round, or back to the lobby
function finishCard(result) {
  G.state = 'won'; // the world stops behind the card
  closePanel();
  toastEl.hidden = true;
  mapView.hidden = true;
  const s = Math.round((G.playTicks || 0) / 60);
  // what you learned, as the game's own icons
  const learned = [
    [itemIcon('wood'), 'Fällen'],
    [itemIcon('flint'), 'Sprengen'],
    [itemIcon('nug'), 'Verkaufen'],
    [SPR.hut, 'Bauen'],
    [SPR.clonkIcon, 'Crew'],
  ]
    .map(([ic, t]) => `<span><img src="${ic.toDataURL()}" alt="">${tr(t)}</span>`)
    .join('');
  card.innerHTML =
    result === 'done'
      ? `<h1>${tr('Erste Schicht geschafft!')}</h1>
         <div class="learned">${learned}</div>
         <p>${tr('Belohnung: Grubenhelm und {n} Taler Startgeld für deine erste Runde', { n: REWARD })}</p>
         <p class="hint">${tr('Zeit {time}', { time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })}</p>`
      : `<h1>${tr('Tutorial übersprungen')}</h1>
         <p class="hint">${tr('Du findest es jederzeit in den Optionen')}</p>`;
  card.innerHTML += `<div class="btnrow"><button class="go" id="goBtn">${tr('Erste echte Runde')}</button>
    <button class="ghost" id="tutLobby">${tr('Zur Lobby')}</button></div>`;
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
  addFloat(c.x + 3, c.y - 6, '✓', '#7ed957');
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
  showHand(c, els[0]);
}
// the hand waits a moment, so players who already know what to do never see it
function showHand(c, el) {
  const step = c && G.inputKind === 'touch' && stepOf();
  const g = step && say(step.hand, c, G.tut.s);
  const wait = G.tut?.i === 0 ? 1500 : 3500;
  let at = null;
  if (g && performance.now() - stepAt > wait && G.joyId == null) {
    if (g === 'tap') at = el;
    else if (overlay.hidden) at = document.getElementById('joy');
  }
  const r = at && at.offsetParent && at.getBoundingClientRect(),
    gr = r && document.getElementById('game').getBoundingClientRect();
  if (!r || !r.width) {
    hand.className = '';
    return;
  }
  hand.style.left = r.left - gr.left + r.width / 2 + 'px';
  hand.style.top = r.top - gr.top + r.height / 2 + 'px';
  if (hand.className !== 'on ' + g) hand.className = 'on ' + g;
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
