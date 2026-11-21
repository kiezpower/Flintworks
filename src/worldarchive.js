// Bridge between the running world and durable named archives.
import { G } from './state.js';
import { putWorld, readWorld } from './worldstore.js';
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
  // a shared world: the friends get this state too (net/shared.js)
  G.sharedUpload?.(world.id, world.save);
  G.worldSavePending = pending;
  pending.catch(() => {
    if (!warned) { warned = true; toast('Welt konnte nicht gespeichert werden – bitte Speicherplatz prüfen'); }
  });
  return G.worldSavePending;
}

// A resume slot stores the legacy inline save or a reference to a named world.
// Writes from a closed round cannot put its reference back after clear().
export function resumeSlot(key, fromArchive) {
  let revision = 0, loaded = null;
  function read() {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  }
  function clear() {
    revision++;
    loaded = null;
    try { localStorage.removeItem(key); }
    catch {}
  }
  async function init() {
    const id = read()?.archive;
    if (!id) return;
    const pendingRevision = revision;
    try {
      const world = await readWorld(id);
      if (pendingRevision !== revision || read()?.archive !== id) return;
      const save = fromArchive(world?.save);
      if (save) loaded = { id, save };
      else clear();
    } catch {}
  }
  function write(inline, archived) {
    const writing = ++revision;
    const writeInline = () => {
      if (writing === revision) localStorage.setItem(key, JSON.stringify(inline));
    };
    if (!archived) return writeInline();
    archived.then(world => {
      if (writing !== revision) return;
      const save = fromArchive(world.save);
      localStorage.setItem(key, JSON.stringify({ archive: world.id }));
      loaded = { id: world.id, save };
    }, writeInline).catch(() => {});
  }
  return {
    init,
    read,
    clear,
    write,
    load() {
      const slot = read();
      return slot?.archive ? loaded?.id === slot.archive ? loaded.save : null : slot;
    },
    forget(id) {
      if (read()?.archive === id) clear();
    },
  };
}
