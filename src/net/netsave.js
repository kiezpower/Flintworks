// Saving a shared round: the host keeps the whole game (like a single-player save) together
// with who played. In the room the host can carry on with it later; players are matched by name.
import { serialize } from '../save.js';
import { archiveWorld, resumeSlot } from '../worldarchive.js';
import { NET } from './room.js';
import { isPlayer } from '../players.js';
import { G, crew } from '../state.js';

const slot = resumeSlot('flintworks-netsave', save => save?.start ? save : null);
const initNetSave = () => slot.init();
let lastSaveFrame = null;

function saveNet() {
  if (!G.net || !G.netHost || G.state !== 'play') return;
  try {
    const players = crew.filter(isPlayer).map(c => ({ pid: c.pid, name: c.name, fid: c.owner || NET.players.find(p => p.pid === c.pid)?.fid }));
    const save = { t: Date.now(), start: G.netStart, players, data: serialize() };
    const archive = G.mode === 'settlement' || G.worldId ? archiveWorld(save) : null;
    slot.write(save, archive);
    lastSaveFrame = G.frame;
  } catch {}
}
const loadNetSave = () => slot.load();
const netSaveInfo = () => {
  const s = loadNetSave();
  return s && { t: s.t, names: s.players.map(p => p.name), versus: !!(s.start && s.start.versus) };
};
function clearNetSave() {
  lastSaveFrame = null;
  slot.clear();
}
const forgetNetWorld = id => slot.forget(id);
function saveOnExit() {
  if (lastSaveFrame !== G.frame) saveNet();
}
addEventListener('visibilitychange', () => document.hidden && saveOnExit());
addEventListener('pagehide', saveOnExit);

export { clearNetSave, forgetNetWorld, initNetSave, loadNetSave, netSaveInfo, saveNet };
