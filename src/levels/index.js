// Hand-built levels, one folder each (level.json + map.txt). Every level becomes a game mode
// in GAME_MODES (campaign: true, pkg: the package), so start, goal, stars and the end screen
// work like for the other campaign levels. Chapter 2 of the campaign.
import { GAME_MODES } from '../modes.js';
import { levelTick, progress, status, total } from './goals.js';
import { unpackMap } from './palette.js';
import ORDER from './order.json';
import MAP_ORDER from './maps.json';

// (the order of chapter 2 is in order.json; the level editor adds new levels at the end)
const PACKS = import.meta.glob('./*/level.json', { eager: true, import: 'default' });
const MAPS = import.meta.glob('./*/map.txt', { eager: true, query: '?raw', import: 'default' });

const CHAPTER2 = [];
// a level package becomes a game mode (also a draft from the level editor, see editor.html);
// a map (maps.json) is no campaign level: it is chosen in the lobby, also for Koop and Versus
function registerLevel(L, n = 0, map = false) {
  const st = map ? {} : L.start || {},
    ru = L.rules || {};
  GAME_MODES[L.id] = {
    pkg: L,
    campaign: !map,
    map,
    chapter: map ? 0 : 2,
    n,
    name: L.name,
    icon: L.icon || 'castle',
    desc: L.desc,
    biome: L.biome || 'meadow',
    seed: L.seed || 1,
    diff: L.diff,
    size: L.size,
    stars: L.stars || [10, 15],
    intro: L.intro,
    money: st.money,
    research: st.research,
    store: st.store,
    evRate: ru.evRate ?? (ru.events ? 1 : 0),
    evKinds: ru.events,
    get goal() {
      return total(L);
    },
    prog: () => progress(L),
    status: () => status(L),
    tick: () => levelTick(L),
  };
}
const pack = id => {
  const L = { ...PACKS[`./${id}/level.json`], map: unpackMap(MAPS[`./${id}/map.txt`]) };
  if (L.id !== id) throw new Error(`level folder ${id} has the id ${L.id}`);
  return L;
};
for (const id of ORDER) {
  registerLevel(pack(id), CHAPTER2.length + 1);
  CHAPTER2.push(id);
}
// maps for free play, Koop and Versus
const MAP_IDS = [];
for (const id of MAP_ORDER) {
  registerLevel(pack(id), 0, true);
  MAP_IDS.push(id);
}

export { CHAPTER2, MAP_IDS, ORDER, registerLevel };
