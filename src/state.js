export const G = {};
// what modules keep for a world of their own, cleared when a new world is made (gen.js): so
// nothing of one round reaches into the next (and a recorded run plays back alike, replay.js)
export const onNewWorld = [];

// ---- State ----
const meteors = [],
  items = [],
  parts = [],
  // particles made while drawing (not by the game's tick): kept apart, so how often a device
  // draws never changes the game (replay.js)
  vparts = [],
  flashes = [],
  builds = [],
  trees = [],
  crew = [],
  animals = [],
  lorries = [],
  vehicles = [],
  birds = [],
  clouds = [];
G.money = 0;
G.state = 'menu';
G.startT = 0;
G.shake = 0;
G.lightFx = true; // mood lighting, glow and vignette (option in the menu)
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
// a cap colour from another device goes into style attributes and canvas: only a plain #rgb(a)
// hex colour is let through, anything else becomes the first cap colour
const safeCap = c => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : CAPS[0]);
// text from another device that ends up in HTML
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
G.base = null;
// a Wühler carries up to INV_MAX things; the HUD shows the first INV_SHOWN of them (keys 1–5),
// the whole bag opens from the bag button (or key I)
const INV_MAX = 16,
  INV_SHOWN = 5;

export {
  INV_MAX,
  INV_SHOWN,
  CAPS,
  esc,
  safeCap,
  NAMES,
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
  vparts,
  vehicles,
};
