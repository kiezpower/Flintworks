// Game modes chosen in the lobby: each has its own win condition and star times.
import { G, builds } from './state.js';

// Multiplayer: Koop goals grow by half for every further player, Versus goals are smaller
// because the round has a clock (G.mp is made for every new world, see versus.js)
const goalScale = (np = G.mp?.np || 1, vs = !!G.mp?.vs) => (vs ? 0.65 : 1 + 0.5 * (np - 1));
const scaled = (n, step = 1, max = 1e9, np, vs) => Math.min(max, Math.round((n * goalScale(np, vs)) / step) * step);
// treasure hunt: chests to find, for the number of chests the world gets
const treasureGoal = (np, vs) => scaled(4, 1, 1e9, np, vs);

const GAME_MODES = {
  gold: {
    name: 'Goldrausch',
    desc: 'Verdiene {goal} Taler',
    get goal() {
      return scaled(800, 10);
    },
    prog: () => G.money,
    stars: [8, 14],
  },
  build: {
    name: 'Siedler',
    territory: true, // build only in your own area, flags widen it (buildings.js terrOK)
    desc: 'Errichte {goal} verschiedene Gebäude',
    get goal() {
      return scaled(6, 1, 12);
    },
    prog: () =>
      new Set(builds.filter(b => b.done && b.type !== 'base' && (b.team || 0) === (G.curTeam || 0)).map(b => b.type))
        .size,
    stars: [10, 16],
  },
  treasure: {
    name: 'Schatzsucher',
    desc: 'Finde {goal} Schatztruhen',
    get goal() {
      return treasureGoal();
    },
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
  G.daily = null;
  const M = mode();
  // (campaign levels and the Tagesschacht, daily.js)
  if (!M.campaign && !M.daily) return;
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

export { GAME_MODES, MODE_IDS, applyModeSetup, goalReached, goalScale, mode, starsFor, treasureGoal };
