// Named world archives use IndexedDB: large terrain saves do not compete with the profile's
// localStorage quota. Every update is a transaction; an unsuccessful write keeps the old world.
const DB = 'flintworks-worlds';
export const MAX_IMPORT = 24 * 1024 * 1024;
const cleanName = s => String(s || '').trim().slice(0, 48) || 'Flintworks';
let opening;
function database() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore('worlds', { keyPath: 'id' });
    q.onsuccess = () => { q.result.onversionchange = () => { q.result.close(); opening = null; }; resolve(q.result); };
    q.onerror = () => { opening = null; reject(q.error); };
  });
  return opening;
}
async function transaction(mode, fn) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('worlds', mode);
    const q = fn(tx.objectStore('worlds'));
    tx.oncomplete = () => resolve(q.result);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('world transaction failed'));
  });
}
export const readWorld = id => transaction('readonly', s => s.get(id));
export async function listWorlds() {
  return (await transaction('readonly', s => s.getAll())).sort((a, b) => b.updated - a.updated);
}
export async function putWorld({ id = crypto.randomUUID(), name, save }) {
  const old = await readWorld(id);
  const now = Date.now();
  const world = { id, name: cleanName(name || old?.name), created: old?.created || now, updated: now, save };
  await transaction('readwrite', s => s.put(world));
  return world;
}
export async function renameWorld(id, name) {
  const w = await readWorld(id);
  if (!w) throw new Error('missing world');
  w.name = cleanName(name);
  await transaction('readwrite', s => s.put(w));
}
export const deleteWorld = id => transaction('readwrite', s => s.delete(id));
export const exportWorld = w => JSON.stringify({ format: 'flintworks-world', version: 1, name: w.name, save: w.save });
// Validate before mutating any live game state. In particular a corrupt terrain run must never
// partially overwrite the current world, and dimensions must not allow unbounded allocations.
export function validWorldSave(s) {
  const d = s?.data;
  if (!d || d.v !== 1 || typeof d.world !== 'string' || d.world.length > MAX_IMPORT) return false;
  const w = d.w || 1400, h = d.h || 400;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 300 || w > 2800 || h < 150 || h > 700) return false;
  if (!Array.isArray(d.surf) || d.surf.length !== w || d.surf.some(v => !Number.isFinite(v) || v < 0 || v >= h)) return false;
  for (const k of ['crew', 'items', 'builds', 'trees', 'animals', 'lorries'])
    if (!Array.isArray(d[k]) || d[k].length > 100000 || d[k].some(e => !e || typeof e !== 'object')) return false;
  if (!d.builds.some(b => b.type === 'base') || !d.crew.length) return false;
  try {
    const raw = atob(d.world);
    if (!raw.length || raw.length % 4) return false;
    const runs = new Uint16Array(Uint8Array.from(raw, c => c.charCodeAt(0)).buffer);
    let n = 0;
    for (let i = 0; i < runs.length; i += 2) {
      if (runs[i] > 63 || !runs[i + 1]) return false;
      n += runs[i + 1];
    }
    if (n !== w * h) return false;
    const safe = (v, depth = 0) => {
      if (depth > 30) return false;
      if (typeof v === 'number') return Number.isFinite(v);
      if (!v || typeof v !== 'object') return true;
      return Object.entries(v).every(([k, x]) => !['__proto__', 'prototype', 'constructor'].includes(k) && safe(x, depth + 1));
    };
    return safe(s);
  } catch { return false; }
}
export async function importWorld(text, allowedModes) {
  if (typeof text !== 'string' || text.length > MAX_IMPORT) throw new Error('invalid world');
  const w = JSON.parse(text);
  if (w.format !== 'flintworks-world' || w.version !== 1 || !await validWorldObjects(w.save) ||
      !allowedModes.includes(w.save.data.mode) || w.save.data.tut || w.save.data.daily) throw new Error('invalid world');
  // Imports are copies; they never overwrite an existing archive or reuse its identity.
  const id = crypto.randomUUID();
  w.save.data.worldId = id;
  w.save.data.worldName = cleanName(w.name);
  return putWorld({ id, name: w.name, save: w.save });
}

// Domain checks use the game's registries instead of a second list of building/vehicle ids.
export async function validWorldObjects(save) {
  if (!validWorldSave(save)) return false;
  const [{ BT }, { VK }, { ITEM }, { HEROES }, { PROJECTS }] = await Promise.all([
    import('./buildings.js'), import('./vehicles/core.js'), import('./sprites.js'), import('./heroes.js'), import('./heroprojects.js'),
  ]);
  const d = save.data;
  const point = e => Number.isFinite(e.x) && Number.isFinite(e.y);
  const heroIds = new Set(HEROES.map(h => h.id));
  const count = n => Number.isFinite(n) && n >= 0 && n <= 1e6;
  const record = v => v && typeof v === 'object' && !Array.isArray(v);
  const missionState = o => o == null || record(o) && Object.entries(o).every(([id, run]) => heroIds.has(id) && record(run) &&
    Object.entries(run).every(([key, value]) => key === 'deepDig' ? count(value) : ['sectors','ledges','buildTypes','workshops'].includes(key) &&
      Array.isArray(value) && value.length <= 64 && value.every(v => typeof v === 'string' && v.length <= 40)));
  const activityState = o => o == null || record(o) && Object.entries(o).every(([id, n]) => heroIds.has(id) && count(n));
  const heroState = c => ['heroDepth','heroTripDepth','heroGuardRun','heroActive','heroCooldown'].every(key => c[key] == null || count(c[key])) &&
    (c.heroHookStart == null || Number.isFinite(c.heroHookStart)) && activityState(c.heroCasts) && activityState(c.heroUses) &&
    (c.heroUseful == null || typeof c.heroUseful === 'boolean') &&
    (c.heroUnlocks == null || Number.isInteger(c.heroUnlocks) && c.heroUnlocks >= 0 && c.heroUnlocks <= 63) &&
    (c.matchRole == null || heroIds.has(c.matchRole)) && missionState(c.heroMission) &&
    (c.heroCounters == null || record(c.heroCounters) && Object.entries(c.heroCounters).every(([id, v]) =>
      heroIds.has(id) && record(v) && count(v.work) && count(v.feats))) &&
    (c.heroCareer == null || record(c.heroCareer) && Object.entries(c.heroCareer).every(([id, n]) =>
      ['build', 'find'].includes(id) && count(n))) &&
    (c.heroScan == null || Array.isArray(c.heroScan) && c.heroScan.length <= 24 && c.heroScan.every(p =>
      Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
      p[0] >= 0 && p[0] < (d.w || 1400) && p[1] >= 0 && p[1] < (d.h || 400)));
  const project = d.heroProject;
  if (project != null && (!record(project) || !Array.isArray(project.roles) || project.roles.length > HEROES.length ||
    !project.roles.every(id => heroIds.has(id)) || new Set(project.roles).size !== project.roles.length)) return false;
  if (project?.done != null && (!Array.isArray(project.done) || !project.done.every(id => PROJECTS.some(q => q.id === id)) || new Set(project.done).size !== project.done.length)) return false;
  if (project?.builds != null && (!Array.isArray(project.builds) || project.builds.length > 64 || !project.builds.every(id => Object.hasOwn(BT, id)))) return false;
  const projectKeys = new Set(PROJECTS.flatMap(q => q.tasks.map(t => t[0])));
  if (project?.values != null && (!record(project.values) || !Object.entries(project.values).every(([key, n]) => projectKeys.has(key) && count(n)))) return false;
  return ['meadow', 'desert', 'winter'].includes(d.biome) &&
    d.builds.every(b => (b.type === 'base' || Object.hasOwn(BT, b.type)) && Number.isFinite(b.x) && Number.isFinite(b.gy) &&
      Number.isFinite(b.w) && Number.isFinite(b.h) && (!b.cs || point(b.cs))) &&
    d.crew.every(c => point(c) && heroState(c) && Array.isArray(c.inv) && c.inv.length <= 20 && c.inv.every(t => Object.hasOwn(ITEM, t))) &&
    (d.vehicles || []).every(v => point(v) && Object.hasOwn(VK, v.kind));
}
