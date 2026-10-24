import { scatterDecor } from './decor.js';
import { setBiome } from './biomes.js';
import { arrows } from './buildings.js';
import { mkCloud } from './gen.js';
import { calcTerr } from './render.js';
import { treeSprite } from './sprites.js';
import { G, animals, birds, builds, clouds, crew, flashes, items, lorries, meteors, parts, trees } from './state.js';
import { H, W, activateAll, bg, mat, paintAll, ri, rnd, shade, surf } from './world.js';

// ---- Save / load (per browser) ----
const SAVEKEY = 'wuehlwelt-save-v1';
function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str) {
  const s = atob(str),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
// the whole game as plain data (also used as a network snapshot for joining players)
function serialize() {
  {
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
      world: b64(new Uint8Array(u16.buffer)),
      surf: [...surf],
      money: G.money,
      earned: G.earned || 0,
      biome: G.biome,
      mode: G.mode,
      relaxed: !!G.relaxed,
      store: G.store || {},
      tools: G.tools || {},
      chests: G.chests,
      beams: G.beams || [],
      mis: G.mis || null,
      goldSold: G.goldSold || 0,
      mineMark: G.mineMark || null,
      chestsFound: G.chestsFound,
      gas: G.gas,
      gasClouds: G.gasClouds,
      dayT: G.dayT,
      frame: G.frame,
      hints: [...G.hintsSeen],
      t: Date.now(),
      crew: crew.map(strip),
      items: items.map(strip),
      builds: builds.map(strip),
      trees: trees.map(strip),
      animals: animals.map(strip),
      lorries: lorries.map(strip),
      play: performance.now() - G.startT,
      playTicks: G.playTicks || 0,
      nextId: G.nextId || 0,
      seed: G.seed,
    };
    return data;
  }
}
function saveGame() {
  if (G.state !== 'play' || G.net) return; // network rounds are not saved (yet)
  try {
    localStorage.setItem(SAVEKEY, JSON.stringify(serialize()));
  } catch {}
}
function hasSave() {
  try {
    return !!localStorage.getItem(SAVEKEY);
  } catch {
    return false;
  }
}
function clearSave() {
  try {
    localStorage.removeItem(SAVEKEY);
  } catch {}
}
function loadGame() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(SAVEKEY));
  } catch {
    return false;
  }
  return deserialize(d);
}
function deserialize(d) {
  if (!d || d.v !== 1) return false;
  try {
    setBiome(d.biome || 'meadow');
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
    paintAll();
    activateAll();
    G.money = d.money;
    G.earned = d.earned || 0;
    G.dayT = d.dayT;
    G.mode = d.mode || 'gold';
    G.relaxed = !!d.relaxed;
    G.store = d.store || {};
    G.tools = d.tools || {};
    G.chests = d.chests || [];
    G.beams = d.beams || [];
    G.mis = d.mis || null;
    G.goldSold = d.goldSold || 0;
    G.mineMark = d.mineMark || null;
    G.chestsFound = d.chestsFound || 0;
    G.gas = d.gas || [];
    G.gasClouds = d.gasClouds || [];
    G.hintsSeen = new Set(d.hints || []);
    crew.push(...d.crew.map(c => ({ ...c, chop: null, bridge: null, job: null, path: null, plan: null })));
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
    animals.push(...d.animals);
    lorries.push(...d.lorries);
    for (let f = 0; f < 3; f++) {
      const bx = ri(0, W),
        by = ri(25, 60),
        dir = rnd() < 0.5 ? -1 : 1;
      for (let k = 0; k < ri(3, 5); k++)
        birds.push({ x: bx + k * 6, y: by + (k % 2) * 4, vx: dir * (0.5 + rnd() * 0.15), ph: rnd() * 6 });
    }
    for (let k = 0; k < 9; k++) clouds.push(mkCloud(rnd() * W));
    // old saves without player ids: the first Wühler is yours
    if (!crew.some(c => c.pid === G.myId) && crew[0]) crew[0].pid = G.myId;
    arrows.length = 0;
    scatterDecor();
    calcTerr();
    G.startT = performance.now() - (d.play || 0);
    G.playTicks = d.playTicks || 0;
    G.nextId = d.nextId || 0;
    G.seed = d.seed;
    // old saves: give every entity an id
    for (const a of [crew, items, builds, trees, animals, lorries]) for (const e of a) e.id ??= G.nextId = G.nextId + 1;
    return true;
  } catch {
    return false;
  }
}
addEventListener('visibilitychange', () => {
  if (document.hidden) saveGame();
});
addEventListener('pagehide', saveGame);

export { SAVEKEY, b64, clearSave, deserialize, hasSave, loadGame, saveGame, serialize, unb64 };
