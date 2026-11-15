// The Wühler button opens a collection book. Browsing never changes the profile;
// only the explicit selection commits an unlocked cosmetic identity.
import './heroalbum.css';
import { HEROES, heroAvailable, heroOf, selectHero } from './heroes.js';
import { tr } from './i18n.js';
import { P, saveProfile } from './profile.js';
import { drawPortrait } from './portrait.js';
import { updateMe } from './net/room.js';
import { closePanel, openPanel } from './ui.js';

function element(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function condition(hero) {
  return hero.level ? tr('Ab Level {n}', { n: hero.level })
    : hero.wins ? tr('{n} Siege', { n: hero.wins }) : tr('Freigeschaltet');
}
function portrait(hero, current = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 32;
  canvas.setAttribute('aria-hidden', 'true');
  drawPortrait(canvas.getContext('2d'), 4, 10, 1, current ? P.cap : hero.cap, P.hat, false, P.outfit, hero.id);
  return canvas;
}
function openHeroAlbum({ onAppearance, onOutfits, onAchievements, onSelected } = {}) {
  const body = openPanel('Heldenalbum');
  const album = element('section', 'hero-album');
  album.id = 'heroAlbum';
  const book = element('div', 'ha-book');
  const tabs = element('nav', 'ha-tabs');
  tabs.setAttribute('aria-label', tr('Sammlung'));
  const title = element('b', 'ha-tab-current', tr('Helden'));
  tabs.appendChild(title);
  if (onAchievements) {
    const achievements = element('button', '', tr('Erfolge'));
    achievements.addEventListener('click', onAchievements);
    tabs.appendChild(achievements);
  }
  book.appendChild(tabs);
  book.appendChild(element('h3', '', tr('Deine Sammlung')));
  const grid = element('div', 'ha-grid');
  grid.setAttribute('aria-label', tr('Helden'));
  book.appendChild(grid);
  const count = HEROES.filter(hero => heroAvailable(hero, P)).length;
  const progressLabel = element('p', 'ha-progress-label', tr('{n} von {m} entdeckt', { n: count, m: HEROES.length }));
  progressLabel.id = 'heroProgressText';
  const progress = element('progress', 'ha-progress');
  progress.max = HEROES.length;
  progress.value = count;
  progress.setAttribute('aria-labelledby', progressLabel.id);
  book.append(progressLabel, progress);

  const preview = element('aside', 'ha-preview');
  preview.setAttribute('aria-label', tr('Heldenvorschau'));
  const name = element('h3', 'ha-name');
  name.id = 'heroPreviewName';
  const stage = element('div', 'ha-stage');
  const art = element('div', 'ha-art');
  stage.appendChild(art);
  stage.appendChild(element('div', 'ha-podium'));
  const desc = element('p', 'ha-description');
  const status = element('p', 'ha-status');
  status.id = 'heroStatus';
  status.setAttribute('aria-live', 'polite');
  const select = element('button', 'ha-select');
  select.id = 'heroSelect';
  const appearance = element('div', 'ha-appearance');
  for (const [label, action] of [[tr('Hüte & Farben'), onAppearance], [tr('Outfits'), onOutfits]]) {
    if (!action) continue;
    const button = element('button', '', label);
    button.addEventListener('click', action);
    appearance.appendChild(button);
  }
  preview.append(name, stage, desc, status, select, appearance);
  const note = element('p', 'ha-note', tr('Alle Helden haben dieselben Fähigkeiten. Hüte und Outfits bleiben erhalten.'));
  album.append(book, preview, note);
  body.appendChild(album);

  let previewId = heroAvailable(heroOf(P.hero), P) ? P.hero : HEROES[0].id;
  const cards = new Map();
  for (const hero of HEROES) {
    const available = heroAvailable(hero, P);
    const card = element('button', 'ha-card' + (available ? '' : ' locked'));
    card.dataset.hero = hero.id;
    card.setAttribute('aria-label', `${hero.name} · ${available ? tr('Freigeschaltet') : condition(hero)}`);
    card.setAttribute('aria-controls', 'heroPreviewName heroStatus');
    card.appendChild(portrait(hero, P.hero === hero.id));
    card.appendChild(element('b', 'ha-card-name', hero.name));
    const badge = element('span', 'ha-stamp', available ? '✓' : '🔒');
    badge.setAttribute('aria-hidden', 'true');
    card.appendChild(badge);
    if (!available) card.appendChild(element('small', '', condition(hero)));
    card.addEventListener('click', () => {
      previewId = hero.id;
      update();
    });
    cards.set(hero.id, card);
    grid.appendChild(card);
  }
  // Standard buttons work with keyboard and the game's directional gamepad navigation.
  function update() {
    const hero = heroOf(previewId), available = heroAvailable(hero, P), selected = P.hero === hero.id;
    for (const [id, card] of cards) {
      card.classList.toggle('previewing', id === hero.id);
      card.classList.toggle('selected', id === P.hero);
      card.setAttribute('aria-pressed', String(id === hero.id));
    }
    name.textContent = hero.name;
    art.replaceChildren(portrait(hero, selected));
    stage.classList.toggle('locked', !available);
    desc.textContent = available ? tr(hero.desc) : tr('Spiele weiter, um diesen Helden zu entdecken.');
    status.textContent = selected ? tr('Ausgewählt') : available ? tr('Freigeschaltet') :
      hero.level ? tr('Level {have}/{need}', { have: P.level, need: hero.level }) :
        tr('Siege {have}/{need}', { have: P.wins || 0, need: hero.wins });
    select.textContent = selected ? tr('Ausgewählt') : available ? tr('Auswählen') : condition(hero);
    select.disabled = !available || selected;
  }
  select.addEventListener('click', () => {
    // Recheck unlocks at commit time; previews of locked cards never grant access.
    if (!selectHero(P, previewId)) return;
    saveProfile();
    updateMe();
    onSelected?.();
    closePanel();
    document.getElementById('lbWho')?.focus({ preventScroll: true });
  });
  update();
  requestAnimationFrame(() => {
    if (album.isConnected) cards.get(previewId)?.focus({ preventScroll: true });
  });
}
export { openHeroAlbum };
