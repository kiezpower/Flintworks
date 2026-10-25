// Dev server only: plays the level the editor (editor.html) left in localStorage, at /?draft=1.
import { clearSave } from '../save.js';
import { registerLevel } from './index.js';

const KEY = 'flintworks-level-draft';

function playDraft(play) {
  let L;
  try {
    L = JSON.parse(localStorage.getItem(KEY));
  } catch {}
  if (!L) return;
  registerLevel(L);
  clearSave();
  play(false, L.id);
  // a way back to the editor
  const a = document.createElement('a');
  a.href = './editor.html?level=' + encodeURIComponent(L.id);
  a.textContent = '← Editor';
  a.style.cssText =
    'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:99;padding:4px 10px;' +
    'background:#2a1a10;color:#ffe066;font:12px monospace;border:1px solid #6b4a2a;border-radius:4px';
  document.body.appendChild(a);
}

export { KEY, playDraft };
