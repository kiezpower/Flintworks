import { P, saveProfile, track } from './profile.js';
// Guided first game ("Die erste Schicht") in its own small world: three beats of the core loop
// (walk, dig to gold, sell it) with an arrow to the goal, a pulsing button, hints that fit the
// situation, rescues when the player is stuck and a closing card. Under two minutes for a
// newcomer; players who already know what to do never see a prompt.
// The steps are in tutsteps.js, the world in tutlevel.js, the funnel events in analytics.js.
import { ev, newRun } from './analytics.js';
import { sel_ } from './entities.js';
import { addFloat } from './floats.js';
import { tr } from './i18n.js';
import { mode } from './modes.js';
import { sfx } from './sound.js';
import { SPR, itemIcon, padIcon } from './sprites.js';
import { G, parts } from './state.js';
import { STEPS } from './tutsteps.js';
import { closePanel, mapView, toast, toastEl } from './ui.js';

const box = document.getElementById('quest');
const stepTxt = document.getElementById('questStep');
const goalTxt = document.getElementById('questText');
const skipBtn = document.getElementById('questSkip');
const game = document.getElementById('game');
const overlay = document.getElementById('overlay'),
  card = document.getElementById('card');
// ghost hand on touch screens: shows the gesture of the step (slide the stick, tap a button)
const hand = document.createElement('div');
hand.id = 'tutHand';
game.appendChild(hand);
const REWARD = 50; // start money for the first real round
// a prompt waits this long while the player is not getting on (except the very first one)
const PROMPT_WAIT = 72;
// reduced motion: no bobbing arrow, a few sparks instead of confetti
const rm = matchMedia('(prefers-reduced-motion: reduce)');
G.reduceMotion = rm.matches;
rm.addEventListener?.('change', () => (G.reduceMotion = rm.matches));
// play, menu, discard and save come from main.js (set once at start, avoids an import cycle)
let hooks = {};
const setTutHooks = h => (hooks = h);
const stepOf = () => G.tut && STEPS[G.tut.i];
const secs = () => Math.round((G.playTicks || 0) / 6) / 10;

// a text can be plain, per input ({ touch, keys }) or worked out right now
function say(v, c, s) {
  if (typeof v === 'function') v = v(c, s);
  if (v && typeof v === 'object') v = v[G.inputKind] || v.touch;
  return v || null;
}

function enterStep(i) {
  const c = sel_();
  const run = G.tut?.run || { hints: 0, quiet: 0, show: {} };
  G.tut = { i, run, s: { t: 0, idle: 0, x0: c ? c.x : 0, money0: G.money, help: 0, shown: i === 0 } };
  stepAt = performance.now();
  STEPS[i].enter?.(c, G.tut.s);
  ev('onb_step_start', { step: STEPS[i].id, i });
  showStep();
  hooks.save?.();
}
let stepAt = 0; // when the current step began (real time, also runs while a panel is open)
function showStep() {
  stepTxt.textContent = `${G.tut.i + 1}/${STEPS.length}`;
  goalTxt.textContent = G.tut.s.shown ? tr(say(stepOf().text, sel_(), G.tut.s) || '') : '';
  skipBtn.textContent = tr('Überspringen');
  box.hidden = false;
  tutHud();
}
// entry: 'first_launch' (straight from the start screen) or 'replay' (asked for in the lobby)
function startTutorial(entry = 'first_launch') {
  newRun();
  G.tut = null;
  ev('onb_start', { entry });
  enterStep(0);
}
// after loading a saved tutorial game, or back from the lobby
function resumeTutorial() {
  if (!G.tut || !STEPS[G.tut.i]) return (G.tut = null);
  G.tut.run ||= { hints: 0, quiet: 0, show: {} };
  stepAt = performance.now();
  ev('onb_resume', { step: stepOf().id });
  showStep();
}
// result: 'done', 'skip' or nothing (a game without the tutorial); via: how it was skipped
function endTutorial(result, via = 'button') {
  const step = stepOf(),
    run = G.tut?.run;
  G.tut = null;
  box.hidden = true;
  tutHud();
  if (!result) return;
  P.tutorialDone = true;
  if (result === 'skip') ev('onb_skip', { step: step ? step.id : '', sec: secs(), via });
  else {
    ev('onb_complete', { sec: secs(), hints: run ? run.hints : 0, skilled: skilled(run) });
    sfx('fanfare');
    track('tutorial');
    // the reward: the miner's helmet (put on if you wear none) and start money for the next round
    if (!P.hats.includes('helm')) P.hats.push('helm');
    if (P.hat === 'none') P.hat = 'helm';
    P.tutBonus = REWARD;
  }
  saveProfile();
  if (!mode().tutorial) return;
  if (result === 'skip' || skilled(run)) return finishCard(result);
  // a moment of confetti over the castle before the card
  closePanel();
  mapView.hidden = true;
  confetti();
  setTimeout(() => G.state === 'play' && finishCard(result), 1500);
}
// two beats done before their prompt was needed: this player knows the game
const skilled = run => !!run && run.quiet >= 2;
function confetti() {
  const COLS = ['#f2c230', '#e0572f', '#3f9e4a', '#2f7fd0', '#f2f2f2', '#d04f8a'];
  const c = sel_(),
    spots = [{ x: G.base.x + G.base.w / 2, y: G.base.gy - G.base.h }];
  if (c) spots.push({ x: c.x + 3, y: c.y });
  const n = G.reduceMotion ? 10 : 70;
  for (const o of spots)
    for (let q = 0; q < n; q++)
      parts.push({
        x: o.x + (Math.random() - 0.5) * 8,
        y: o.y,
        vx: (Math.random() - 0.5) * (G.reduceMotion ? 0.6 : 2.6),
        vy: -1.2 - Math.random() * (G.reduceMotion ? 0.6 : 2.4),
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
    [SPR.clonkIcon.toDataURL(), 'Laufen'],
    [padIcon('dig'), 'Graben'],
    [itemIcon('nug').toDataURL(), 'Verkaufen'],
  ]
    .map(([src, t]) => `<span><img src="${src}" alt="">${tr(t)}</span>`)
    .join('');
  card.innerHTML =
    result === 'done'
      ? `<h1>${tr('Erste Schicht geschafft!')}</h1>
         <div class="learned">${learned}</div>
         <p>${tr('Belohnung: Grubenhelm und {n} Taler Startgeld für deine erste Runde', { n: REWARD })}</p>
         <p class="hint">${tr('Zeit {time}', { time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })} · ${tr('Den Rest zeigen dir Tipps im Spiel')}</p>`
      : `<h1>${tr('Tutorial übersprungen')}</h1>
         <p class="hint">${tr('Du findest es jederzeit in den Optionen')}</p>`;
  card.innerHTML += `<div class="btnrow"><button class="go" id="goBtn">${tr('Weiter graben')}</button>
    <button class="ghost" id="tutLobby">${tr('Zur Lobby')}</button></div>`;
  let left = false;
  const leave = choice => {
    if (left) return false; // a double tap starts only one round
    left = true;
    ev('onb_card', { choice, result });
    overlay.hidden = true;
    hooks.discard();
    return true;
  };
  document.getElementById('goBtn').onclick = () => leave('play') && ((G.afterOnb = true), hooks.play(false));
  document.getElementById('tutLobby').onclick = () => leave('lobby') && hooks.menu();
  overlay.hidden = false;
  // keyboard: Enter or Space on the focused main button
  document.getElementById('goBtn').focus({ preventScroll: true });
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

// what the player did first after the start screen
function firstAction(c, run) {
  if (run.acted) return;
  const kind = c.digging ? 'dig' : c.vy < -1 ? 'jump' : Math.abs(c.vx) > 0.2 ? 'move' : null;
  if (!kind) return;
  run.acted = true;
  ev('onb_first_action', { kind, sec: secs() });
}

// every frame of play; paused: a panel is open (the menu) – no clock, no rescues
function updTutorial(paused = false) {
  if (!G.tut) return;
  const c = sel_();
  if (!c || c.dead) return;
  const step = stepOf(),
    s = G.tut.s,
    run = G.tut.run;
  if (!paused) {
    s.t++;
    step.tick?.(c, s);
    firstAction(c, run);
    // the prompt shows when the player does not get on for a moment (the first one at once)
    s.idle = progress(c, s) ? 0 : s.idle + 1;
    if (!s.shown && s.idle > PROMPT_WAIT) s.shown = true;
    // stuck for a while: the next rescue changes the text or lends a hand
    // (each one once; one whose situation does not fit is passed over, not waited for)
    s.used ||= [];
    const r = step.rescue?.find((r, k) => !s.used.includes(k) && s.t > r.after * 60 && (!r.when || r.when(c, s)));
    if (r) {
      s.used.push(step.rescue.indexOf(r));
      s.help++;
      s.shown = true;
      r.run?.(c, s);
      if (r.show) run.show[r.show] = true;
      if (r.text) s.rescue = r;
      run.hints++;
      ev('onb_rescue', { step: step.id, kind: r.id });
      if (r.id === 'home') ev('onb_recover', { kind: 'home' });
    }
    // out of the pit by yourself
    if (step.id === 'sell') {
      if ((s.deepT || 0) > 60) s.inPit = true;
      if (s.inPit && !(s.deepT > 0)) {
        s.inPit = false;
        ev('onb_recover', { kind: G.autoDig ? 'ramp' : 'climb' });
      }
    }
    if (c.inv.includes('nug')) run.show.inv = true;
    if (s.near) run.show.money = true;
  }
  // one line at a time: a rescue, else a hint that fits right now, else the task
  const h = s.shown && !s.rescue && step.hint?.(c, s);
  if (h && h.id !== s.hintId) {
    s.hintId = h.id;
    run.hints++;
    ev('onb_hint', { step: step.id, level: h.id });
  }
  if (!h) s.hintId = null;
  s.hl = (s.rescue || h || {}).hl || null;
  s.hand = (s.rescue || h || {}).hand || null;
  const text = s.shown ? tr(say((s.rescue || h || {}).text, c, s) || say(step.text, c, s) || '') : '';
  if (goalTxt.textContent !== text) goalTxt.textContent = text;
  if (!step.done(c, s)) return;
  completeStep(c, step, s, run);
}
// is the player getting on with the step (walking the right way, digging)
function progress(c, s) {
  if (G.tut.i === 0) return true; // the first prompt is shown at once anyway
  const id = stepOf().id;
  if (id === 'dig') return c.digging || Math.abs(c.vx) > 0.2;
  if (id === 'sell') return c.vx < -0.2 || c.digging || c.vy < -0.5;
  return Math.abs(c.vx) > 0.2;
}
function completeStep(c, step, s, run) {
  const prompted = s.shown && G.tut.i > 0;
  if (!s.shown) run.quiet++;
  ev('onb_step_done', { step: step.id, i: G.tut.i, sec: s.t / 60, prompted: !!s.shown, hints: s.help });
  step.leave?.(c, s);
  sfx('pick');
  addFloat(c.x + 3, c.y - 6, '✓', '#7ed957');
  if (step.praise && (prompted || !skilled(run))) toast(step.praise);
  if (step.id === 'sell') {
    run.show.money = true;
    ev('onb_first_success', { sec: secs(), money: G.money });
  }
  if (G.tut.i + 1 < STEPS.length) enterStep(G.tut.i + 1);
  else endTutorial('done');
}

// ---- what the HUD shows: only what is useful yet; the pulsing frame of the current step ----
let lit = [];
function reveal() {
  const on = G.state === 'veil' || (!!G.tut && G.state === 'play'),
    show = (on && G.tut?.run?.show) || {};
  game.classList.toggle('onb', on);
  game.classList.toggle('onb-veil', G.state === 'veil');
  game.classList.toggle('onb-inv', on && !!show.inv);
  game.classList.toggle('onb-money', on && !!show.money);
  game.classList.toggle('onb-act', on && !!show.act);
}
function tutHud() {
  reveal();
  const c = G.tut && G.state === 'play' && sel_();
  const step = c && stepOf();
  const sel = c ? say(G.tut.s.hl || (G.tut.s.shown ? step.hl : null), c, G.tut.s) : null;
  const els = sel ? [...document.querySelectorAll(sel)] : [];
  for (const e of lit) if (!els.includes(e)) e.classList.remove('tut-hl');
  for (const e of els) if (!e.classList.contains('tut-hl')) e.classList.add('tut-hl');
  lit = els;
  showHand(c, els[0]);
}
// the hand waits a moment, so players who already know what to do never see it
function showHand(c, el) {
  const step = c && G.inputKind === 'touch' && G.tut.s.shown && !skilled(G.tut.run) && stepOf();
  const g = step && say(G.tut.s.hand || step.hand, c, G.tut.s);
  const wait = G.tut?.i === 0 ? 1500 : 3500;
  let at = null;
  if (g && performance.now() - stepAt > wait && G.joyId == null && G.tut.s.idle > 30) {
    if (g === 'tap') at = el;
    else if (overlay.hidden) at = document.getElementById('joy');
  }
  const r = at && at.offsetParent && at.getBoundingClientRect(),
    gr = r && game.getBoundingClientRect();
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
  const c = G.tut && G.state === 'play' && sel_();
  const t = c && stepOf().target?.(c, G.tut.s);
  if (!t) return;
  const sx = t.x - cx,
    sy = t.y - cy - 6 + (G.reduceMotion ? 0 : Math.sin(G.frame * 0.15) * 2);
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
// leaving the page in the middle of the tutorial: where players drop off
addEventListener('pagehide', () => {
  if (G.tut && G.state === 'play') ev('onb_exit', { step: stepOf()?.id || '', sec: secs() });
});

export { STEPS, drawTutorial, say, endTutorial, resumeTutorial, setTutHooks, startTutorial, tutHud, updTutorial };
