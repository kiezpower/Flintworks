// Game modes chosen in the lobby: each has its own win condition and star times.
import { G, builds } from './state.js';

const GAME_MODES = {
  gold: {
    name: 'Goldrausch',
    desc: 'Verdiene {goal} Taler',
    goal: 800,
    prog: () => G.money,
    stars: [8, 14],
  },
  build: {
    name: 'Siedler',
    desc: 'Errichte {goal} verschiedene Gebäude',
    goal: 6,
    prog: () =>
      new Set(builds.filter(b => b.done && b.type !== 'base' && (b.team || 0) === (G.curTeam || 0)).map(b => b.type))
        .size,
    stars: [10, 16],
  },
  treasure: {
    name: 'Schatzsucher',
    desc: 'Finde {goal} Schatztruhen',
    goal: 4,
    prog: () => G.chestsFound || 0,
    stars: [9, 15],
  },
};
const MODE_IDS = Object.keys(GAME_MODES);
// right after a new world is made: campaign levels set up their start (scenarios.js)
function applyModeSetup() {
  G.evRate = 1;
  G.evKinds = null;
  G.introDone = false;
  const M = mode();
  if (!M.campaign) return;
  if (M.evRate != null) G.evRate = M.evRate;
  if (M.evKinds) G.evKinds = M.evKinds;
  if (M.money != null) G.money = M.money;
  for (const id of M.research || []) G.tools['r_' + id] = true;
  Object.assign(G.store, M.store || {});
  M.setup?.();
}
const mode = () => GAME_MODES[G.mode] || GAME_MODES.gold;
const goalReached = () => mode().prog() >= mode().goal;
// 3 stars under the first time limit (minutes), 2 under the second, otherwise 1
function starsFor(sec) {
  const [a, b] = mode().stars;
  return sec <= a * 60 ? 3 : sec <= b * 60 ? 2 : 1;
}

export { GAME_MODES, MODE_IDS, applyModeSetup, goalReached, mode, starsFor };
