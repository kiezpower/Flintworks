// Lobby: the name others see in a shared game. Typed in, or rolled with the dice.
import { tr } from './i18n.js';
import { P, cleanName, randomName, saveProfile } from './profile.js';
import { updateMe } from './net/room.js';
import { G } from './state.js';
import { $, closePanel, openPanel } from './ui.js';

// back: the panel to return to afterwards (none: close)
function openName(back) {
  const p = openPanel('Dein Name');
  p.insertAdjacentHTML(
    'beforeend',
    `<div class="lb-namebox">
      <div class="lb-namerow">
        <input id="lbNameIn" maxlength="12" autocomplete="off" spellcheck="false" placeholder="${tr('Name')}">
        <button class="lb-dice" id="lbDice" title="${tr('Zufälliger Name')}" aria-label="${tr('Zufälliger Name')}">🎲</button>
      </div>
      <p class="hint">${tr('So sehen dich deine Mitspieler')}</p>
      <button class="lb-create" id="lbNameOk">${tr('Speichern')}</button>
    </div>`,
  );
  const inp = $('lbNameIn');
  inp.value = P.name;
  const fresh = () => performance.now() - G.panelT >= 450;
  $('lbDice').addEventListener('click', () => {
    if (!fresh()) return;
    inp.value = randomName();
  });
  const save = () => {
    if (!fresh()) return;
    const n = cleanName(inp.value) || randomName();
    if (n !== P.name) {
      P.name = n;
      saveProfile();
      updateMe();
      G.onNameChange?.();
    }
    if (back) back();
    else closePanel();
  };
  $('lbNameOk').addEventListener('click', save);
  inp.addEventListener('keydown', e => e.key === 'Enter' && save());
}

export { openName };
