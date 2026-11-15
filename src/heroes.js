// Cosmetic identities shared by the album, portraits and in-game miners.
// One digit fits inside the existing 20-character multiplayer skin tag.
const HEROES = [
  { id: 'anna', code: '1', name: 'Anna', cap: '#c8402c', desc: 'Mit Mut ins Bergwerk', pal: {} },
  { id: 'bruno', code: '2', name: 'Bruno', cap: '#2f7fd0', desc: 'Immer eine gute Geschichte dabei',
    pal: { r: '#36251f', s: '#d9a578', d: '#b77d54', n: '#efbf94', k: '#c88760', m: '#885137' } },
  { id: 'mika', code: '3', name: 'Mika', cap: '#e0ad28', desc: 'Neugierig auf jeden neuen Stollen',
    pal: { r: '#211b24', s: '#9f6545', d: '#79452e', n: '#c18b60', k: '#b47751', m: '#633729' } },
  { id: 'juna', code: '4', name: 'Juna', cap: '#3fb3a8', desc: 'Findet überall ein neues Abenteuer',
    pal: { r: '#d79a32', s: '#f5d2ab', d: '#d7aa7f', n: '#ffe4bf', k: '#eaaa8b', m: '#b57657' } },
  { id: 'toni', code: '5', name: 'Toni', cap: '#3f9e4a', level: 5, desc: 'Mit Erfahrung durch den Fels',
    pal: { r: '#bbb5a8', s: '#b6815d', d: '#8e5e42', n: '#d5a37c', k: '#c58b6c', m: '#714735' } },
  { id: 'nora', code: '6', name: 'Nora', cap: '#9a4fc4', wins: 10, desc: 'Die nächste Entdeckung wartet schon',
    pal: { r: '#612c22', s: '#c78f70', d: '#a16a50', n: '#e3af8c', k: '#d3977c', m: '#844c3b' } },
];
const heroOf = id => HEROES.find(hero => hero.id === id);
const heroPal = id => heroOf(id)?.pal || {};
const heroAvailable = (hero, profile) => !!hero &&
  (!hero.level || profile.level >= hero.level) && (!hero.wins || profile.wins >= hero.wins);
// Selecting a hero changes identity and cap, never gameplay, name or owned cosmetics.
function selectHero(profile, id) {
  const hero = heroOf(id);
  if (!heroAvailable(hero, profile)) return false;
  if (profile.hero !== id) profile.cap = hero.cap;
  profile.hero = id;
  return true;
}
export { HEROES, heroAvailable, heroOf, heroPal, selectHero };
