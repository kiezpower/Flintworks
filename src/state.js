export const G = {};

// ---- State ----
const meteors = [],
  items = [],
  parts = [],
  flashes = [],
  builds = [],
  trees = [],
  crew = [],
  animals = [],
  lorries = [],
  birds = [],
  clouds = [];
G.money = 0;
G.sel = 0;
G.state = 'menu';
G.startT = 0;
G.shake = 0;
G.goldDust = 0;
G.earthDug = 0;
G.loamDug = 0;
G.oreDug = 0;
G.coalDug = 0;
G.meteorNext = 9000;
G.dayT = 0.08;
G.rainT = 0;
G.rainNext = 3600;
G.muted = false;
G.follow = false;
G.bolt = null;
const NAMES = ['Kurt', 'Hilde', 'Bodo', 'Gerda', 'Udo', 'Frieda', 'Paul'];
const CAPS = ['#c8402c', '#2f7fd0', '#3f9e4a', '#9a4fc4', '#e08a1f', '#d04f8a', '#3fb3a8'];
G.base = null;

export { CAPS, NAMES, animals, birds, builds, clouds, crew, flashes, items, lorries, meteors, parts, trees };
