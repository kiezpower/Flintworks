// Own keys (like Terraria's key bindings): every action can get a key of one's own in the settings.
// The game's input (input.js) knows the actions by their standard key; a key chosen here stands
// in for that standard key (the standard keys keep working unless another action took them).
// Kept in the profile (P.keys: action → key code).
import { P, saveProfile } from './profile.js';

// action → its standard key (what input.js listens for) and its name
const ACTIONS = [
  ['left', 'ArrowLeft', 'Links'],
  ['right', 'ArrowRight', 'Rechts'],
  ['up', 'ArrowUp', 'Hoch / Klettern'],
  ['down', 'ArrowDown', 'Runter'],
  ['jump', 'Space', 'Springen'],
  ['dig', 'ShiftLeft', 'Graben'],
  ['act', 'KeyF', 'Aktion'],
  ['throw', 'KeyC', 'Werfen'],
  ['hook', 'KeyG', 'Enterhaken'],
  ['build', 'KeyB', 'Baumenü'],
  ['map', 'KeyM', 'Karte öffnen'],
  ['bag', 'KeyI', 'Tasche öffnen'],
];
let remap = {};
// the chosen keys as a table: pressed code → the standard key it stands for
function buildRemap() {
  remap = {};
  const own = P.keys || {};
  for (const [id, std] of ACTIONS) if (own[id]) remap[own[id]] = std;
}
buildRemap();
// what input.js should treat a pressed key as
const mapKey = code => remap[code] || code;

// a key's name as printed on it
function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return (
    {
      Space: 'Leertaste',
      ArrowLeft: '←',
      ArrowRight: '→',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ShiftLeft: 'Shift',
      ShiftRight: 'Shift rechts',
      ControlLeft: 'Strg',
      AltLeft: 'Alt',
      Enter: 'Enter',
    }[code] || code
  );
}
const keyOf = id => (P.keys && P.keys[id]) || ACTIONS.find(a => a[0] === id)[1];

// waits for the next key and gives it to the action (Esc cancels); done() afterwards
function listenFor(id, done) {
  const on = e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    removeEventListener('keydown', on, true);
    if (e.code !== 'Escape') {
      P.keys = { ...(P.keys || {}) };
      // (a key belongs to one action: taken from any other that had it)
      for (const k in P.keys) if (P.keys[k] === e.code) delete P.keys[k];
      const std = ACTIONS.find(a => a[0] === id)[1];
      if (e.code === std) delete P.keys[id];
      else P.keys[id] = e.code;
      saveProfile();
      buildRemap();
    }
    done();
  };
  addEventListener('keydown', on, true);
}
function resetKeys() {
  P.keys = {};
  saveProfile();
  buildRemap();
}

export { ACTIONS, keyName, keyOf, listenFor, mapKey, resetKeys };
