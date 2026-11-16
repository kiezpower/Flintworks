// The first hero is chosen on the existing tutorial completion card, never before the tutorial.
import { HEROES, selectHero } from './heroes.js';
import { ROLES } from './heroskills.js';
import { P, saveProfile } from './profile.js';
import { tr } from './i18n.js';
import { openPanel, closePanel } from './ui.js';
import { ev } from './analytics.js';
function renderHeroChoice(card) {
  if (P.hero) return;
  const section = document.createElement('section'); section.id = 'firstHeroChoice';
  const title = document.createElement('h2'); title.textContent = tr('Wähle deinen ersten Wühler'); section.append(title);
  const note = document.createElement('p'); note.textContent = tr('Anna ist vorausgewählt. Du kannst später jederzeit wechseln.'); section.append(note);
  let selected = 'anna';
  for (const hero of HEROES.filter(h => !h.level && !h.wins)) {
    const b = document.createElement('button'); b.className = 'hero-intro-choice'; b.dataset.hero = hero.id;
    b.textContent = hero.name + ' · ' + tr(ROLES[hero.id].role); b.setAttribute('aria-pressed', String(hero.id === selected));
    b.onclick = () => { selected = hero.id; section.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed', String(el === b))); };
    section.append(b);
  }
  card.insertBefore(section, card.querySelector('.btnrow'));
  GChoice = () => { if (selectHero(P, selected)) { P.heroChoicePending = false; saveProfile(); ev('hero_select', { hero: selected }); } };
}
let GChoice = null;
const commitHeroChoice = () => { GChoice?.(); GChoice = null; };
function chooseFirstHero(done) {
  const body = openPanel('Wähle deinen ersten Wühler'), card = document.createElement('div');
  const actions = document.createElement('div'); actions.className = 'btnrow';
  const confirm = document.createElement('button'); confirm.id = 'confirmHeroChoice'; confirm.className = 'go'; confirm.textContent = tr('Weiter graben');
  confirm.onclick = () => { commitHeroChoice(); closePanel(); done(); }; actions.append(confirm); card.append(actions); body.append(card); renderHeroChoice(card);
}
export { renderHeroChoice, commitHeroChoice, chooseFirstHero };
