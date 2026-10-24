// Saving a shared round: the host keeps the whole game (like a single-player save) together
// with who played. In the room the host can carry on with it later; players are matched by name.
import { serialize } from '../save.js';
import { isPlayer } from '../players.js';
import { G, crew } from '../state.js';

const KEY = 'flintworks-netsave';

function saveNet() {
  if (!G.net || !G.netHost || G.state !== 'play') return;
  try {
    const players = crew.filter(isPlayer).map(c => ({ pid: c.pid, name: c.name }));
    localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), start: G.netStart, players, data: serialize() }));
  } catch {}
}
function loadNetSave() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}
const netSaveInfo = () => {
  const s = loadNetSave();
  return s && { t: s.t, names: s.players.map(p => p.name), versus: !!(s.start && s.start.versus) };
};
function clearNetSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
addEventListener('visibilitychange', () => document.hidden && saveNet());

export { clearNetSave, loadNetSave, netSaveInfo, saveNet };
