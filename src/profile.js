// Player profile across games: level, crystals, trophies, hats and daily quests (stored locally).
import { sfx } from './sound.js';
import { G } from './state.js';
import { toast } from './ui.js';

const KEY = 'flintworks-profile';
const HATS = {
  none: { name: 'Keiner', price: 0 },
  flower: { name: 'Blume', price: 0, road: true },
  helm: { name: 'Grubenhelm', price: 30, sub: 'Leuchtet nachts weiter' },
  cowboy: { name: 'Cowboyhut', price: 40 },
  viking: { name: 'Wikingerhelm', price: 50 },
  wizard: { name: 'Zauberhut', price: 60 },
  crown: { name: 'Krone', price: 120 },
};
const CAPS = ['#c8402c', '#2f7fd0', '#3f9e4a', '#9a4fc4', '#e08a1f', '#d04f8a', '#3fb3a8', '#f2f2f2'];
const QUESTS = {
  sell: { text: 'Verkaufe Waren für {n} Taler', n: [120, 200, 300], cr: 15 },
  build: { text: 'Baue {n} Gebäude', n: [2, 3, 4], cr: 15 },
  chop: { text: 'Fälle {n} Bäume', n: [4, 6, 8], cr: 10 },
  monster: { text: 'Besiege {n} Monster', n: [1, 2], cr: 20 },
  gem: { text: 'Finde {n} Edelsteine', n: [1, 2, 3], cr: 20 },
  gold: { text: 'Verkaufe {n} Goldnuggets', n: [4, 6, 10], cr: 15 },
};
// trophy road: reward at each trophy count
const ROAD = [
  { t: 10, cr: 10 },
  { t: 25, hat: 'flower' },
  { t: 50, cr: 20 },
  { t: 80, cr: 25 },
  { t: 120, hat: 'viking' },
  { t: 170, cr: 40 },
  { t: 240, hat: 'crown' },
  { t: 320, cr: 60 },
];
const XP = { sell: 0.2, build: 25, chop: 8, monster: 40, gem: 20, gold: 0, tutorial: 60 };

const today = () => new Date().toISOString().slice(0, 10);
const P = {
  xp: 0,
  level: 1,
  crystals: 20,
  trophies: 0,
  hats: ['none'],
  hat: 'none',
  cap: CAPS[0],
  questDay: '',
  quests: [],
  chestDay: '',
  road: [],
  tutorialDone: false,
  mode: 'random',
  games: 0,
  wins: 0,
};
try {
  Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch {}
function saveProfile() {
  try {
    localStorage.setItem(KEY, JSON.stringify(P));
  } catch {}
}
const xpNeed = () => 80 + P.level * 40;
function rollQuests() {
  if (P.questDay === today()) return;
  P.questDay = today();
  const ids = Object.keys(QUESTS).sort(() => Math.random() - 0.5);
  P.quests = ids.slice(0, 3).map(id => {
    const q = QUESTS[id];
    return { id, goal: q.n[Math.floor(Math.random() * q.n.length)], have: 0, done: false };
  });
  saveProfile();
}
function addXp(n) {
  P.xp += n;
  let up = false;
  while (P.xp >= xpNeed()) {
    P.xp -= xpNeed();
    P.level++;
    P.crystals += 10;
    up = true;
  }
  if (up) {
    sfx('done');
    toast('Level {n} erreicht! +10 Kristalle', { n: P.level });
  }
}
// Progress event from the game: XP plus daily quest progress
let saveT = 0;
function track(id, amount = 1) {
  rollQuests();
  addXp(Math.round((XP[id] ?? 0) * amount));
  for (const q of P.quests)
    if (q.id === id && q.have < q.goal) {
      q.have = Math.min(q.goal, q.have + amount);
      if (q.have >= q.goal) toast('Aufgabe erfüllt! Hol dir die Belohnung in der Lobby');
    }
  if (performance.now() - saveT > 2000) {
    saveT = performance.now();
    saveProfile();
  }
}
function claimQuest(q) {
  if (q.done || q.have < q.goal) return false;
  q.done = true;
  P.crystals += QUESTS[q.id].cr;
  addXp(30);
  saveProfile();
  return true;
}
function chestReady() {
  return P.chestDay !== today();
}
function openChest() {
  if (!chestReady()) return 0;
  P.chestDay = today();
  const n = 5 + Math.floor(Math.random() * 4) * 5;
  P.crystals += n;
  saveProfile();
  return n;
}
function claimRoad(k) {
  const r = ROAD[k];
  if (!r || P.trophies < r.t || P.road.includes(k)) return false;
  P.road.push(k);
  if (r.cr) P.crystals += r.cr;
  if (r.hat && !P.hats.includes(r.hat)) P.hats.push(r.hat);
  saveProfile();
  return true;
}
function buyHat(id) {
  const h = HATS[id];
  if (P.hats.includes(id) || P.crystals < h.price) return false;
  P.crystals -= h.price;
  P.hats.push(id);
  P.hat = id;
  saveProfile();
  return true;
}
// Sale at the base or by lorry
function sold(list, v) {
  G.earned = (G.earned || 0) + v;
  track('sell', v);
  const gems = list.filter(t => t === 'gem').length;
  if (gems) {
    P.crystals += gems * 3;
    toast('Edelstein verkauft: +{n} Kristalle', { n: gems * 3 });
    saveProfile();
  }
  const n = list.filter(t => t === 'nug').length;
  if (n) track('gold', n);
}
// End of a run: trophies for wins, a few for every 50 Taler earned
function finishGame(won, earned) {
  P.games++;
  let t = Math.floor(earned / 50);
  if (won) {
    P.wins++;
    t += 30;
    addXp(150);
  } else t -= 3;
  P.trophies = Math.max(0, P.trophies + t);
  saveProfile();
  return t;
}
const claimable = () =>
  P.quests.some(q => !q.done && q.have >= q.goal) ||
  ROAD.some((r, k) => P.trophies >= r.t && !P.road.includes(k)) ||
  chestReady();

rollQuests();
export {
  CAPS,
  HATS,
  P,
  QUESTS,
  ROAD,
  addXp,
  buyHat,
  chestReady,
  claimQuest,
  claimRoad,
  claimable,
  finishGame,
  openChest,
  rollQuests,
  saveProfile,
  sold,
  track,
  xpNeed,
};
