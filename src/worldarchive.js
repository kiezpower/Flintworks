// Bridge between the running world and durable named archives.
import { G } from './state.js';
import { putWorld } from './worldstore.js';
import { toast } from './ui.js';
let warned = false;
export function archiveWorld(save) {
  if (G.mode !== 'settlement' && !G.worldId) return Promise.resolve();
  if (!G.worldId) G.worldId = crypto.randomUUID();
  if (!G.worldName) G.worldName = 'Flintworks';
  save.data.worldId = G.worldId;
  save.data.worldName = G.worldName;
  // Queue writes so an earlier autosave cannot overwrite a newer explicit save.
  const world = { id: G.worldId, name: G.worldName, save: structuredClone(save) };
  const pending = (G.worldSavePending || Promise.resolve()).catch(() => {}).then(() => putWorld(world));
  G.worldSavePending = pending;
  pending.catch(() => {
    if (!warned) { warned = true; toast('Welt konnte nicht gespeichert werden – bitte Speicherplatz prüfen'); }
  });
  return G.worldSavePending;
}
