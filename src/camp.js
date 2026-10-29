// Heimatbergwerk: crystals, the one currency that stays between rounds. The home crew mines them
// while the game is closed (up to what the vault holds), every round adds some, and they buy
// upgrades for the home mine, small boosts for free play alone and skins (skins.js).
import { P, saveProfile } from './profile.js';
import { BSTYLES, OUTFITS } from './skins.js';
import { mode } from './modes.js';
import { G } from './state.js';

const HOUR = 3600 * 1000;
const VAULT_H = [4, 8, 12, 24];
// base price, growing by 1.6 with every level
const UPGRADES = {
  crew: { name: 'Heim-Crew', sub: '+6 Kristalle pro Stunde', base: 30, max: 10, home: true },
  vault: { name: 'Tresor', sub: 'Sammelt länger: 4, 8, 12, 24 Stunden', base: 60, max: 3, home: true },
  cash: { name: 'Startkasse', sub: '+20 Taler zu Beginn', base: 25, max: 5 },
  pick: { name: 'Scharfe Hacken', sub: '+4 % Grabtempo', base: 35, max: 5 },
  wood: { name: 'Holzvorrat', sub: '+2 Holz im Startlager', base: 20, max: 5 },
};

function camp() {
  const c = (P.camp ||= {});
  c.k ??= 0;
  c.lv ||= {};
  c.t ??= Date.now();
  P.owned ||= [];
  return c;
}
const level = id => camp().lv[id] || 0;
const rate = () => 6 * (1 + level('crew')); // crystals per hour
const vaultHours = () => VAULT_H[level('vault')];
const price = id => (level(id) >= UPGRADES[id].max ? null : Math.round(UPGRADES[id].base * 1.6 ** level(id)));

// what the home crew has mined since the last collect (whole crystals, capped by the vault)
function pending(now = Date.now()) {
  const c = camp();
  // a clock set back: start counting again from now
  if (now < c.t) {
    c.t = now;
    saveProfile();
  }
  const h = Math.min(vaultHours(), (now - c.t) / HOUR);
  return Math.floor(h * rate());
}
const vaultFull = (now = Date.now()) => (now - camp().t) / HOUR >= vaultHours();
function collect(now = Date.now()) {
  const n = pending(now),
    c = camp();
  if (!n) return 0;
  c.k += n;
  // the rest of a started crystal is kept, unless the vault was full
  c.t = vaultFull(now) ? now : c.t + (n / rate()) * HOUR;
  saveProfile();
  return n;
}
function addCrystals(n) {
  if (!(n > 0)) return 0;
  camp().k += Math.floor(n);
  saveProfile();
  return Math.floor(n);
}
function spend(n) {
  const c = camp();
  if (c.k < n) return false;
  c.k -= n;
  saveProfile();
  return true;
}
function buyUpgrade(id) {
  const p = price(id);
  if (p == null || !spend(p)) return false;
  // collect first, so a new crew level or a bigger vault does not pay for time already past
  if (UPGRADES[id].home) collect();
  camp().lv[id] = level(id) + 1;
  saveProfile();
  return true;
}
// skins: 'o:green' (outfit) or 'b:stone' (building style)
function skinOf(id) {
  const [kind, s] = id.split(':');
  return kind === 'o' ? OUTFITS[s] : BSTYLES[s];
}
function owns(id) {
  const S = skinOf(id);
  camp();
  return !!S && (S.k === 0 || P.owned.includes(id));
}
function buySkin(id) {
  const S = skinOf(id);
  if (!S || owns(id) || !spend(S.k)) return false;
  P.owned.push(id);
  saveProfile();
  return true;
}
// the boosts only count in free play alone: never in multiplayer, the Tagesschacht (the same world
// for everybody), the campaign or the tutorial
const soloBoosts = () => !G.net && !G.teams && !mode().campaign && !mode().daily && !G.tut;
// right after a new free world is made (start money and wood); returns the start money added
function applyStartBoosts() {
  if (!soloBoosts()) return 0;
  const cash = 20 * level('cash');
  G.money += cash;
  if (level('wood')) G.store.wood = (G.store.wood || 0) + 2 * level('wood');
  return cash;
}
// on every start and resume: how much faster the pick swings
function setDigBoost() {
  G.digBoost = soloBoosts() ? 1 + 0.04 * level('pick') : 1;
}
// crystals for a finished round: one per 40 Taler earned, 10 more for a win, medals of the Tagesschacht
const roundCrystals = (earned, won, medal = 0) => Math.floor((earned || 0) / 40) + (won ? 10 : 0) + [0, 5, 10, 20][medal];

export {
  UPGRADES,
  addCrystals,
  applyStartBoosts,
  setDigBoost,
  soloBoosts,
  buySkin,
  buyUpgrade,
  camp,
  collect,
  level,
  owns,
  pending,
  price,
  rate,
  roundCrystals,
  vaultFull,
  vaultHours,
};
