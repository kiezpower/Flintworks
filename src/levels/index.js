// Hand-built levels, one folder each (level.json + map.txt). Every level becomes a game mode
// in GAME_MODES (campaign: true, pkg: the package), so start, goal, stars and the end screen
// work like for the other campaign levels. Chapter 2 of the campaign.
import { GAME_MODES } from '../modes.js';
import { levelTick, progress, status, total } from './goals.js';
import ORDER from './order.json';

// (the order of chapter 2 is in order.json; the level editor adds new levels at the end)
const PACKS = import.meta.glob('./*/level.json', { eager: true, import: 'default' });
const MAPS = import.meta.glob('./*/map.txt', { eager: true, query: '?raw', import: 'default' });

const CHAPTER2 = [];
// a level package becomes a game mode (also a draft from the level editor, see editor.html)
function registerLevel(L, n = 0) {
  const st = L.start || {},
    ru = L.rules || {};
  GAME_MODES[L.id] = {
    pkg: L,
    campaign: true,
    chapter: 2,
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
    goal: total(L),
    prog: () => progress(L),
    status: () => status(L),
    tick: () => levelTick(L),
  };
}
for (const id of ORDER) {
  const L = { ...PACKS[`./${id}/level.json`], map: MAPS[`./${id}/map.txt`] };
  if (L.id !== id) throw new Error(`level folder ${id} has the id ${L.id}`);
  registerLevel(L, CHAPTER2.length + 1);
  CHAPTER2.push(id);
}

export { CHAPTER2, ORDER, registerLevel };
