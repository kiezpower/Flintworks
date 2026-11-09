// Levels that do not come with the game: one from a link (?lvl=…, share.js) or the one the level
// editor (editor.html) left in localStorage to try it out (?draft=1). Both are checked by
// cleanLevel() before the game touches them, and both play under the id "geteilt" (not saved,
// save.js; no campaign stars).
import { tr } from '../i18n.js';
import { registerLevel } from './index.js';
import { cleanLevel, unpackLevel } from './share.js';
import { closePanel, openPanel, opt, sec, toast } from '../ui.js';

const KEY = 'flintworks-level-draft';

// a way back to the editor (after trying out a level made there)
function backLink() {
  const a = document.createElement('a');
  a.href = './editor.html?draft=1';
  a.textContent = '← ' + tr('Editor');
  a.id = 'edBack';
  a.style.cssText =
    'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:99;padding:4px 10px;' +
    'background:#2a1a10;color:#ffe066;font:12px monospace;border:1px solid #6b4a2a;border-radius:4px';
  document.body.appendChild(a);
}
// starts the level; a round in progress ends only when the player says so
function start(L, hooks, fromEditor) {
  registerLevel(L);
  const go = () => {
    closePanel();
    hooks.discard();
    hooks.play(false, L.id);
    if (fromEditor) backLink();
  };
  if (fromEditor || !hooks.hasRun()) return go();
  // (the texts of a shared level carry no markup characters, share.js cleanLevel)
  const p = openPanel('Geteiltes Level');
  const s = sec(p, L.name);
  opt(s, { title: tr('Jetzt spielen'), sub: (L.desc ? L.desc + ' · ' : '') + tr('Deine laufende Runde endet dafür'), onClick: go });
  opt(s, { title: tr('Später'), sub: tr('Zurück zur laufenden Runde'), onClick: closePanel });
}

// ?draft=1: the level the editor left here
function playDraft(hooks) {
  let L = null;
  try {
    L = cleanLevel(JSON.parse(localStorage.getItem(KEY)));
  } catch {}
  if (!L) return toast('Kein Entwurf aus dem Editor gefunden');
  start(L, hooks, true);
}
// ?lvl=…: a level somebody shared
async function playShared(code, hooks) {
  let L;
  try {
    L = await unpackLevel(code);
  } catch {
    return toast('Dieser Level-Link ist ungültig');
  }
  start(L, hooks, new URLSearchParams(location.search).has('ed'));
}

export { KEY, playDraft, playShared };
