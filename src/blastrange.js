import { G } from './state.js';
import { tr } from './i18n.js';
import { openPanel, panelEl } from './ui.js';
import { audioInit, sfx } from './sound.js';
import { WIDTH, aim, busy, finished, fire, newRange, tick } from './blastrange-model.js';
import { rangePainter } from './blastrange-art.js';
import './blastrange.css';

const RECORD = 'flintworks-blast-range-v1';
function readRecord() {
  try { return Math.max(0, Math.min(1000000, Math.floor(Number(localStorage.getItem(RECORD))) || 0)); }
  catch { return 0; }
}
export function openBlastRange() {
  const p = openPanel('Sprengplatz'), stamp = G.panelT;
  const root = document.createElement('section'); root.className = 'blast-range';
  const hint = document.createElement('p'); hint.className = 'blast-hint';
  hint.textContent = tr('Drei Ladungen. Lege Gold frei und triff die Pulverfässer für Kettenreaktionen.');
  const stats = document.createElement('div'); stats.className = 'blast-stats';
  const stat = (label, id) => {
    const box = document.createElement('div'), text = document.createElement('span'), value = document.createElement('b');
    text.textContent = tr(label); value.id = id; box.append(text, value); stats.append(box); return value;
  };
  const score = stat('Punkte', 'blastScore'), shots = stat('Ladungen', 'blastShots'), record = stat('Dein Rekord', 'blastRecord');
  const canvas = document.createElement('canvas'); canvas.id = 'blastCanvas'; canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', tr('Sprengplatz: mit Links und Rechts zielen, mit Leertaste werfen'));
  const controls = document.createElement('div'); controls.className = 'blast-aim';
  const slider = document.createElement('input'); slider.type = 'range'; slider.min = '45'; slider.max = '220'; slider.id = 'blastAim';
  slider.setAttribute('aria-label', tr('Wurfziel'));
  const button = (id, label, cls = 'small') => {
    const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = cls; b.textContent = tr(label); return b;
  };
  const left = button('blastLeft', '◀'), right = button('blastRight', '▶');
  left.setAttribute('aria-label', tr('Weiter links zielen')); right.setAttribute('aria-label', tr('Weiter rechts zielen'));
  controls.append(left, slider, right);
  const help = document.createElement('p'); help.className = 'blast-hint';
  help.textContent = tr('Tippe auf ein Ziel oder verschiebe die Markierung. Die Punkte der Sprengkette zählen mehrfach.');
  const status = document.createElement('p'); status.id = 'blastStatus'; status.setAttribute('role', 'status');
  const launch = button('blastThrow', 'Ladung werfen', 'go'), again = button('blastAgain', 'Nochmal versuchen');
  root.append(hint, stats, canvas, controls, help, status, launch, again); p.append(root);
  let state, paint, best = readRecord(), recorded = false, last = 0, acc = 0;
  const active = () => !panelEl.hidden && G.panelT === stamp && root.isConnected;
  const text = (el, s) => { if (el.textContent !== String(s)) el.textContent = s; };
  function refresh() {
    const done = finished(state), waiting = busy(state);
    if (done && !recorded) {
      recorded = true;
      if (state.score > best) { best = state.score; try { localStorage.setItem(RECORD, String(best)); } catch {} }
    }
    text(score, state.score); text(shots, state.shots); text(record, best);
    root.dataset.state = done ? 'finished' : waiting ? 'flying' : 'aiming';
    text(status, done ? tr('Schicht geschafft: {n} Punkte!', { n: state.score })
      : state.chain ? tr('Kettenreaktion ×{n}!', { n: state.chain + 1 })
      : waiting ? tr('Achtung, gleich knallt es!') : tr('Ziele auf die Fässer unter der Erde.'));
    launch.disabled = done || waiting;
    slider.disabled = left.disabled = right.disabled = done || waiting;
    slider.value = String(state.target);
    slider.setAttribute('aria-valuetext', tr('Ziel bei {n} Metern', { n: state.target }));
  }
  function reset() {
    state = newRange(); paint = rangePainter(canvas); recorded = false; last = 0; acc = 0;
    refresh(); paint(state, !!G.reduceMotion);
  }
  function target(x) { if (active() && !busy(state) && !finished(state)) { aim(state, x); refresh(); paint(state, !!G.reduceMotion); } }
  function launchCharge() {
    if (!active() || !fire(state)) return;
    audioInit(); sfx('throw'); refresh();
  }
  launch.onclick = launchCharge;
  again.onclick = () => { if (active()) { reset(); launch.focus(); } };
  slider.oninput = () => target(Number(slider.value));
  left.onclick = () => target(state.target - 5); right.onclick = () => target(state.target + 5);
  canvas.onpointerdown = e => {
    const r = canvas.getBoundingClientRect(); target((e.clientX - r.left) / r.width * WIDTH);
  };
  canvas.onkeydown = e => {
    if (['ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
    if (e.code === 'ArrowLeft') target(state.target - 5);
    if (e.code === 'ArrowRight') target(state.target + 5);
    if (!e.repeat && ['Space', 'Enter'].includes(e.code)) launchCharge();
  };
  function frame(now) {
    if (!active()) return;
    // Hidden tabs and a stalled browser never fast-forward a fuse on returning.
    if (document.hidden) { last = 0; acc = 0; }
    else {
      acc += last ? Math.min(100, now - last) : 0; last = now;
      const redraw = busy(state) || state.blasts.length > 0;
      while (acc >= 1000 / 60) {
        tick(state); acc -= 1000 / 60;
        if (state.events.length) sfx('boom', undefined, undefined, 0.3);
        // Repaint each simulation step: a later step must not discard an earlier blast event.
        if (state.events.length) paint(state, !!G.reduceMotion);
      }
      if (redraw) paint(state, !!G.reduceMotion);
      refresh();
    }
    requestAnimationFrame(frame);
  }
  reset(); requestAnimationFrame(frame);
}
