// Achievements ("Erfolge"): long goals over all games, kept in the profile on this device (P.ach:
// when each was reached, P.life: what was counted so far). The game reports progress with track()
// (profile.js), the same events as the daily quests; a few come from their own places (the worm,
// a night of "Festung", three stars, a shared round). Each gives experience once. The list is shown
// on the quest board (questui.js) with how far you are.
import { banner } from './reward.js';
import { tr } from './i18n.js';

// id, the counter it reads (or a function of the profile), how many, emoji, name, what to do, XP
const ACH = [
  ['nug1', 'gold', 1, '🪙', 'Erster Klumpen', 'Verkaufe einen Goldklumpen', 50],
  ['nug100', 'gold', 100, '💰', 'Goldgräber', 'Verkaufe {n} Goldklumpen', 150],
  ['nug1000', 'gold', 1000, '👑', 'Goldbaron', 'Verkaufe {n} Goldklumpen', 400],
  ['sell', 'sell', 10000, '🏦', 'Händler', 'Verdiene {n} Taler', 300],
  ['chop', 'chop', 50, '🪓', 'Holzfäller', 'Fälle {n} Bäume', 150],
  ['build', 'build', 25, '🏗️', 'Baumeister', 'Errichte {n} Gebäude', 150],
  ['gem', 'gem', 25, '💎', 'Edelsteinjäger', 'Finde {n} Edelsteine', 150],
  ['monster', 'monster', 50, '⚔️', 'Monsterjäger', 'Besiege {n} Monster', 200],
  ['hoard', 'hoard', 1, '🗺️', 'Kartenleser', 'Finde ein großes Versteck mit einer Schatzkarte', 200],
  ['chest', 'chest', 10, '🗝️', 'Schatzsucher', 'Öffne {n} Schatztruhen', 150],
  ['deep', 'deep', 100, '⛏️', 'Tiefgräber', 'Grabe {n} m tief', 150],
  ['fish', 'fish', 20, '🎣', 'Angler', 'Fange {n} Fische', 150],
  ['harvest', 'harvest', 10, '🌾', 'Bauer', 'Ernte {n}-mal ein Feld', 150],
  ['village', 'villagers', 5, '🏘️', 'Dorfgründer', 'Habe {n} Siedler im Dorf', 200],
  ['fire', 'fire', 500, '🔥', 'Feuerteufel', 'Setze Öl in Brand ({n} Felder)', 150],
  ['worm', 'worm', 1, '🐛', 'Wurmtöter', 'Besiege den Riesenwurm', 400],
  ['night', 'night', 3, '🏰', 'Festungsherr', 'Halte die Burg {n} Nächte', 300],
  ['wins', P => P.wins || 0, 10, '🏆', 'Seriensieger', 'Gewinne {n} Runden', 200],
  ['stars3', 'stars3', 1, '⭐', 'Glanzleistung', 'Schaffe ein Level mit 3 Sternen', 150],
  ['mp', 'mp', 1, '🤝', 'Gemeinsam', 'Spiele eine Runde mit anderen', 100],
  ['local', 'local', 1, '🎮', 'Zu zweit', 'Spiele zu zweit an einem Gerät', 100],
  ['pet', 'pet', 1, '🐾', 'Tierfreund', 'Zähme einen Fluffel mit Brot oder Fisch', 100],
  ['daily', 'daily', 7, '📅', 'Stammgast', 'Spiele {n} Tagesschächte', 200],
].map(([id, key, n, ico, name, text, xp]) => ({ id, key, n, ico, name, text, xp }));

const have = (P, a) => Math.min(a.n, typeof a.key === 'function' ? a.key(P) : (P.life && P.life[a.key]) || 0);
// count progress (add, or keep the highest for "max" counters like the depth); reached ones are
// announced and pay their XP once (addXp from profile.js)
function achTrack(P, id, amount, addXp, max = false) {
  P.life ||= {};
  P.ach ||= {};
  if (max) P.life[id] = Math.max(P.life[id] || 0, amount);
  else P.life[id] = (P.life[id] || 0) + amount;
  return achCheck(P, addXp);
}
// returns how many were reached just now (the profile is saved at once then)
function achCheck(P, addXp) {
  P.ach ||= {};
  let n = 0;
  for (const a of ACH) {
    if (P.ach[a.id] || have(P, a) < a.n) continue;
    P.ach[a.id] = Date.now();
    addXp(a.xp);
    // (only here: an achievement is this player's own, not news for the room)
    later(`${a.ico} ${tr('Erfolg')}: ${tr(a.name)}`, tr(a.text, { n: a.n }) + ` · +${a.xp} XP`);
    n++;
  }
  return n;
}
// an achievement's banner waits for the one on the screen (the worm's "beaten!" comes with
// "Wurmtöter"), several come one after the other
let queueT = 0;
function later(title, sub) {
  const now = performance.now(),
    busy = typeof document !== 'undefined' && document.querySelector('.banner'),
    at = Math.max(now + (busy ? 3100 : 0), queueT);
  queueT = at + 3100;
  if (at <= now) banner(title, sub);
  else setTimeout(() => banner(title, sub), at - now);
}
// the list for the board: what each is, how far, done or not
const achList = P => ACH.map(a => ({ ...a, have: have(P, a), done: !!(P.ach && P.ach[a.id]) }));

export { ACH, achCheck, achList, achTrack };
