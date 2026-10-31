// First launch: instead of the lobby, the tutorial world is already there behind a light start
// screen – the logo, one big start button and the language. Any key or a tap anywhere starts
// (and unlocks the sound); the language button only switches the language. A tutorial left in
// the middle comes back here too ("Weiter"), not through the lobby.
import { ev } from './analytics.js';
import { applyStatic, getLang, setLang, tr } from './i18n.js';
import { audioInit } from './sound.js';
import { G } from './state.js';
import { drawLogo } from './uiart.js';

const el = document.getElementById('veil'),
  goBtn = document.getElementById('veilGo'),
  langBtn = document.getElementById('veilLang'),
  logo = document.getElementById('veilLogo');
let onGo = null,
  resume = false;

function label() {
  goBtn.querySelector('b').textContent = tr(resume ? 'Weiterspielen' : 'Spielen');
  goBtn.querySelector('small').textContent = tr(G.inputKind === 'touch' ? 'Tippe zum Starten' : 'Drück eine Taste');
  langBtn.textContent = getLang() === 'de' ? 'English' : 'Deutsch';
  langBtn.setAttribute('aria-label', tr('Sprache') + ': ' + langBtn.textContent);
}
// go: what starts the game; again: a saved tutorial goes on
function openVeil(go, again = false) {
  onGo = go;
  resume = again;
  G.state = 'veil';
  label();
  el.hidden = false;
  el.classList.remove('out');
  if (document.fonts && !logo.firstChild)
    document.fonts.load('700 24px "Pixelify Sans"').then(() => {
      if (logo.firstChild) return;
      const cv = drawLogo('Flintworks');
      cv.setAttribute('aria-hidden', 'true');
      logo.appendChild(cv);
    });
  goBtn.focus({ preventScroll: true });
}
function start(kind) {
  if (!onGo || G.state !== 'veil') return;
  const go = onGo;
  onGo = null;
  ev('onb_first_input', { ms: performance.now(), kind });
  audioInit();
  if (G.AC && G.AC.state === 'suspended') G.AC.resume();
  // a short fade (none with reduced motion), the world runs at once
  if (G.reduceMotion) el.hidden = true;
  else {
    el.classList.add('out');
    setTimeout(() => (el.hidden = true), 250);
  }
  go();
}
const veilOpen = () => G.state === 'veil' && !el.hidden;
function closeVeil() {
  onGo = null;
  el.hidden = true;
}

// a tap anywhere on the start screen (not on the language button), or any key
el.addEventListener('pointerdown', e => e.stopPropagation()); // not the stick underneath
el.addEventListener('click', e => {
  if (e.target.closest('#veilLang')) return;
  start(G.inputKind === 'touch' ? 'touch' : 'pointer');
});
langBtn.addEventListener('click', () => {
  setLang(getLang() === 'de' ? 'en' : 'de');
  applyStatic();
  label();
});
addEventListener('keydown', e => {
  if (!veilOpen() || e.repeat) return;
  // Tab and Shift move between the two buttons; Enter or Space on the language button switches
  if (e.code === 'Tab' || e.key === 'Shift') return;
  if (document.activeElement === langBtn && (e.code === 'Enter' || e.code === 'Space')) return;
  e.preventDefault();
  start('keys');
});

export { closeVeil, openVeil, veilOpen };
