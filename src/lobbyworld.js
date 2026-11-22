// Only metadata is retained in the lobby. Read the full archive again when the player resumes,
// so renaming, deleting or saving a world in another panel cannot leave a stale launch action.
import { G } from './state.js';
import { savedData } from './save.js';
import { GAME_MODES } from './modes.js';
import { inRoom } from './net/room.js';
import { listWorlds, readWorld } from './worldstore.js';
import { toast } from './ui.js';

let saved = null, latest = null, explicitChoice = false, request = 0, loading = false, reading = false;
const info = d => d && ({ name: d.worldName, mode: d.mode, biome: d.biome });
export function activeWorldInfo() { return G.inRun ? info(G) : saved; }
export const lastWorld = () => !explicitChoice && !inRoom() ? latest : null;
export const resumingWorld = () => loading || reading;
export function chooseNewGame() { explicitChoice = true; latest = null; reading = false; request++; }
export function enterLobbyWorlds(refresh) {
  explicitChoice = false;
  saved = null;
  // (the slot may only point to a named world: read what it points to, with the world's name)
  try { saved = info(savedData()); } catch {}
  refreshLastWorld(refresh);
}
export async function refreshLastWorld(refresh) {
  const stamp = ++request;
  if (G.inRun || saved || inRoom() || explicitChoice) { latest = null; reading = false; return; }
  reading = true;
  try {
    await G.worldSavePending;
    const worlds = await listWorlds();
    if (stamp !== request || G.inRun || inRoom() || explicitChoice) return;
    const w = worlds.find(w => GAME_MODES[w.save?.data?.mode] && !w.save.data.tut && !w.save.data.daily);
    latest = w ? { id: w.id, name: w.name, mode: w.save.data.mode, biome: w.save.data.biome } : null;
  } catch { if (stamp === request) latest = null; }
  finally { if (stamp === request) { reading = false; refresh(); } }
}
export async function resumeLastWorld(refresh) {
  const candidate = lastWorld();
  if (!candidate || loading) return;
  loading = true; refresh();
  try {
    const w = await readWorld(candidate.id);
    if (lastWorld()?.id !== candidate.id || G.inRun || inRoom()) return;
    if (!await G.loadWorld(w)) toast('Welt konnte nicht geöffnet werden – die bisherige Welt bleibt gespeichert');
  } catch { toast('Welt konnte nicht geöffnet werden – die bisherige Welt bleibt gespeichert'); }
  finally { loading = false; refreshLastWorld(refresh); refresh(); }
}
