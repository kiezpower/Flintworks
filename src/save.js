import { fireCells, setFireCells, saveFire, restoreFire } from './fire.js';
import { fogPack, fogUnpack } from './fog.js';
import { archiveWorld, resumeSlot } from './worldarchive.js';
import { glowList, scatterDecor } from './decor.js';
import { setBiome } from './biomes.js';
import { arrows } from './buildings.js';
import { applyDeepGate, mkCloud } from './gen.js';
import { calcTerr } from './render.js';
import { treeSprite } from './sprites.js';
import { useTeam } from './teams.js';
import {
  G,
  onNewWorld,
  animals,
  birds,
  builds,
  clouds,
  crew,
  flashes,
  items,
  lorries,
  meteors,
  parts,
  trees,
  vehicles,
} from './state.js';
import {
  H,
  getSeed,
  setSeed,
  H0,
  W,
  W0,
  activateAll,
  bg,
  clearFresh,
  mat,
  paintAll,
  resizeWorld,
  ri,
  rnd,
  shade,
  surf,
} from './world.js';

// ---- Save / load (per browser) ----
const SAVEKEY = 'wuehlwelt-save-v1';
function b64(u8) {
  if (typeof u8.toBase64 === 'function') return u8.toBase64();
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(str);
  const s = atob(str),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
// the whole game as plain data (also used as a network snapshot for joining players)
function serialize() {
  // Versus: write with team 0 in place, the other teams in "teams"
  const cur = G.curTeam || 0;
  useTeam(0);
  try {
    const runs = [];
    let prev = -1,
      run = 0;
    for (let i = 0; i < W * H; i++) {
      const v = mat[i] | (bg[i] << 4) | ((shade[i] & 4) << 3);
      if (v === prev && run < 65535) run++;
      else {
        if (prev >= 0) runs.push(prev, run);
        prev = v;
        run = 1;
      }
    }
    runs.push(prev, run);
    const u16 = new Uint16Array(runs);
    const fog = fogPack();
    const strip = o => {
      const r = {};
      for (const k in o) {
        const v = o[k];
        if (
          v instanceof HTMLCanvasElement ||
          k === 'chop' ||
          k === 'job' ||
          k === 'path' ||
          k === 'plan' ||
          k === 'layTrack' ||
          k === 'thrower' ||
          k === 'spr' ||
          k === 'char'
        )
          continue;
        r[k] = v;
      }
      return r;
    };
    const data = {
      v: 1,
      worldId: G.worldId || null,
      worldName: G.worldName || null,
      w: W,
      h: H,
      world: b64(new Uint8Array(u16.buffer)),
      surf: [...surf],
      money: G.money,
      earned: G.earned || 0,
      biome: G.biome,
      mode: G.mode,
      settlement: G.settlement || null,
      heroProject: G.heroProject || null,
      fire: fireCells(),
      fireState: saveFire(),
      tombs: G.tombs || [],
      tombN: G.tombN || 0,
      merchant: G.merchant || null,
      merchNext: G.merchNext || null,
      rng: getSeed(),
      tut: (!G.net && G.tut) || null,
      relaxed: !!G.relaxed,
      store: G.store || {},
      tools: G.tools || {},
      chests: G.chests,
      shrines: G.shrines || [],
      hoards: G.hoards || [],
      picked: G.picked || [],
      torches: G.torches || [],
      zones: G.zones || [],
      fog: fog && b64(fog), // (what the map knows, fog.js)
      beams: G.beams || [],
      mis: G.mis || null,
      goldSold: G.goldSold || 0,
      sold: G.sold || {},
      lvl: G.lvl || null,
      fort: G.fort || null,
      daily: G.daily || null,
      ev: { kills: G.kills, rescued: G.rescued, rate: G.evRate, kinds: G.evKinds, next: G.evNext, worm: !!G.wormDone, queen: !!G.queenDone, king: !!G.kingDone, nights: G.nights || null, village: G.villagers || [] },
      mineMark: G.mineMark || null,
      chestsFound: G.chestsFound,
      gas: G.gas,
      gasClouds: G.gasClouds,
      dayT: G.dayT,
      dayN: G.dayN || 0,
      frame: G.frame,
      hints: [...G.hintsSeen],
      t: Date.now(),
      crew: crew.map(strip),
      items: items.map(strip),
      builds: builds.map(strip),
      trees: trees.map(strip),
      animals: animals.map(strip),
      lorries: lorries.map(strip),
      vehicles: vehicles.map(strip),
      rails: G.rails || [],
      glow: glowList(),
      play: performance.now() - G.startT,
      playTicks: G.playTicks || 0,
      nextId: G.nextId || 0,
      seed: G.seed,
      teams: G.teams && G.teams.map(t => ({ ...t, base: t.base && t.base.id })),
      mp: G.mp || null,
    };
    return data;
  } finally {
    useTeam(cur);
  }
}
const soloSlot = resumeSlot(SAVEKEY, save => save && !save.start ? save.data : null);
const initSavedWorld = () => soloSlot.init();
let cancelAutosave = null;
let lastSaveFrame = null;

function saveLater(saveGameNow = saveGame) {
  if (cancelAutosave) return;
  const save = () => {
    cancelAutosave = null;
    saveGameNow();
  };
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(save, { timeout: 250 });
    cancelAutosave = () => cancelIdleCallback(id);
  } else {
    const id = setTimeout(save, 0);
    cancelAutosave = () => clearTimeout(id);
  }
}
function saveGame() {
  cancelAutosave?.();
  cancelAutosave = null;
  if (G.state !== 'play' || G.net || G.mode === 'geteilt' || G.replaying || (G.mode === 'tut' && !G.tut)) return;
  try {
    const data = serialize();
    const archive = G.mode === 'settlement' || G.worldId ? archiveWorld({ data, start: null, players: [] }) : null;
    soloSlot.write(data, archive);
    lastSaveFrame = G.frame;
  } catch {}
}
function hasSave() {
  try {
    return !!localStorage.getItem(SAVEKEY);
  } catch {
    return false;
  }
}
function savedTut() {
  return soloSlot.read()?.tut || null;
}
function clearSave() {
  lastSaveFrame = null;
  cancelAutosave?.();
  cancelAutosave = null;
  soloSlot.clear();
}
function forgetSavedWorld(id) {
  soloSlot.forget(id);
}
function loadGame() {
  return deserialize(soloSlot.load());
}
function deserialize(d) {
  if (!d || d.v !== 1) return false;
  try {
    for (const fn of onNewWorld) fn();
    setBiome(d.biome || 'meadow');
    // saves from before different world sizes are 1400 × 400
    resizeWorld(d.w || W0, d.h || H0);
    const u8 = unb64(d.world),
      u16 = new Uint16Array(u8.buffer);
    let i = 0;
    for (let k = 0; k < u16.length; k += 2) {
      const v = u16[k],
        n = u16[k + 1];
      for (let q = 0; q < n && i < W * H; q++, i++) {
        mat[i] = v & 15;
        bg[i] = (v >> 4) & 1;
        shade[i] = (rnd() * 4) | 0 | (v & 32 ? 4 : 0);
      }
    }
    for (let x = 0; x < W; x++) surf[x] = d.surf[x];
    for (const a of [meteors, items, parts, flashes, builds, trees, crew, animals, lorries, birds, clouds])
      a.length = 0;
    clearFresh();
    // (the gate in the depth of this round's mode, before the world is painted: gen.js)
    applyDeepGate(d.mode === 'wipfrettung' ? 'fluffelrettung' : d.mode || 'gold', !!d.teams);
    paintAll();
    activateAll();
    G.money = d.money;
    G.earned = d.earned || 0;
    G.dayT = d.dayT;
    G.dayN = d.dayN || 0;
    // (saves from before v1.69.0 use older names for the Fluffel and the Wühler)
    G.mode = d.mode === 'wipfrettung' ? 'fluffelrettung' : d.mode || 'gold';
    G.tut = d.tut || null;
    G.settlement = d.settlement || null;
    G.heroProject = d.heroProject || null;
    G.tombs = d.tombs || [];
    G.tombN = d.tombN || Math.max(0, ...G.tombs.map(t => t.id));
    G.merchant = d.merchant || null;
    G.merchNext = d.merchNext ?? null;
    G.worldId = d.worldId || null;
    G.worldName = d.worldName || null;
    G.relaxed = !!d.relaxed;
    G.store = d.store || {};
    G.tools = d.tools || {};
    G.chests = d.chests || [];
    G.shrines = d.shrines || [];
    G.hoards = d.hoards || [];
    G.picked = d.picked || [];
    G.torches = d.torches || [];
    G.zones = d.zones || [];
    G.beams = d.beams || [];
    G.mis = d.mis || null;
    G.goldSold = d.goldSold || 0;
    G.sold = d.sold || {};
    G.lvl = d.lvl || null;
    G.fort = d.fort || null;
    const ev = d.ev || {};
    Object.assign(G, {
      kills: ev.kills || 0,
      rescued: ev.rescued || 0,
      evRate: ev.rate ?? 1,
      evKinds: ev.kinds || null,
    });
    G.evNext = ev.next ?? null;
    G.wormDone = !!ev.worm;
    G.queenDone = !!ev.queen;
    G.kingDone = !!ev.king;
    G.nights = ev.nights || null;
    G.villagers = ev.village || [];
    G.mineMark = d.mineMark || null;
    G.chestsFound = d.chestsFound || 0;
    G.gas = d.gas || [];
    G.gasClouds = d.gasClouds || [];
    G.hintsSeen = new Set(d.hints || []);
    crew.push(
      ...d.crew.map(c => ({ ...c, kind: 'digger', chop: null, bridge: null, job: null, path: null, plan: null, laying: false })),
    );
    items.push(...d.items.map(it => ({ ...it, thrower: null })));
    builds.push(...d.builds);
    G.base = builds.find(b => b.type === 'base');
    G.base.lvl = G.base.lvl || 1;
    trees.push(
      ...d.trees.map(t => {
        const o = { ...t, spr: treeSprite(t.type, t.stage) };
        o.burn = 0;
        o.char = null;
        return o;
      }),
    );
    animals.push(...d.animals.map(a => (a.kind === 'wipf' ? { ...a, kind: 'fluffel' } : a)));
    lorries.push(...d.lorries);
    vehicles.length = 0;
    vehicles.push(...(d.vehicles || []));
    G.rails = d.rails || [];
    for (let f = 0; f < 3; f++) {
      const bx = ri(0, W),
        by = ri(25, 60),
        dir = rnd() < 0.5 ? -1 : 1;
      for (let k = 0; k < ri(3, 5); k++)
        birds.push({ x: bx + k * 6, y: by + (k % 2) * 4, vx: dir * (0.5 + rnd() * 0.15), ph: rnd() * 6 });
    }
    for (let k = 0; k < 9; k++) clouds.push(mkCloud(rnd() * W));
    // old saves without player ids: the first Wühler is yours
    if (!G.dedicated && !crew.some(c => c.pid != null) && crew[0]) crew[0].pid = G.myId;
    arrows.length = 0;
    // (older saves have no glow list: the caves are looked for again)
    scatterDecor(d.glow || null);
    G.fogOn = G.richDeep = !!d.fog;
    fogUnpack(d.fog ? unb64(d.fog) : null);
    calcTerr();
    G.startT = performance.now() - (d.play || 0);
    G.playTicks = d.playTicks || 0;
    G.nextId = d.nextId || 0;
    G.frame = d.frame || 0;
    G.seed = d.seed;
    G.daily = d.daily || null;
    G.teams = d.teams ? d.teams.map(t => ({ ...t, base: builds.find(b => b.id === t.base) })) : null;
    G.curTeam = 0;
    if (G.teams) G.teams[0].base = G.base = builds.find(b => b.type === 'base' && !b.team) || G.base;
    // the round (players, clock, hill …); older saves are a single game
    G.mp = d.mp || { np: 1, vs: !!G.teams, stats: {} };
    // old saves: give every entity an id
    for (const a of [crew, items, builds, trees, animals, lorries]) for (const e of a) e.id ??= G.nextId = G.nextId + 1;
    if (d.fireState) restoreFire(d.fireState);
    else setFireCells(d.fire || []);
    if (d.rng != null) setSeed(d.rng);
    return true;
  } catch {
    return false;
  }
}
function saveOnExit() {
  // A navigation can fire both events without advancing the world.
  if (lastSaveFrame !== G.frame) saveGame();
}
addEventListener('visibilitychange', () => {
  if (document.hidden) saveOnExit();
});
addEventListener('pagehide', saveOnExit);

export { SAVEKEY, b64, clearSave, deserialize, forgetSavedWorld, hasSave, initSavedWorld, loadGame, saveGame, saveLater, savedTut, serialize, unb64 };
