// The Wühler button opens a collection book. Browsing never changes the profile;
// only the explicit selection commits an unlocked identity and its role.
import './heroalbum.css';
import { challenges, TITLES, OUTFIT_REWARDS } from './heromissions.js';
import { VARIANTS } from './herovariants.js';
import { insightsPanel } from './heroinsights.js';
import { ROLES, CHAPTERS, chapterCount, progressOf } from './heroskills.js';
import { ev } from './analytics.js';
import { minerArtReady } from './minerart.js';
import { HEROES, heroAvailable, heroOf, selectHero } from './heroes.js';
import { tr } from './i18n.js';
import { P, dayNumber, saveProfile } from './profile.js';
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
  canvas.width = 192;
  canvas.height = 256;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d'); ctx.scale(8, 8);
  drawPortrait(ctx, 4, 10, 1, current ? P.cap : hero.cap, P.hat, false, P.outfit, hero.id);
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
  const insights = element('button', '', tr('Spielverlauf'));
  insights.onclick = () => insightsPanel(openPanel('Spielverlauf')); tabs.append(insights);
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
  const skills = element('section', 'ha-skills');
  skills.id = 'heroSkills';
  preview.append(name, stage, desc, status, select, appearance, skills);
  const note = element('p', 'ha-note', tr('Freies Spiel und Koop: deine Rolle. Tagesschicht: feste Tagesrolle. Wettkampf: alle Rollen und Varianten für alle. Kampagne und Tutorial bleiben unverändert.'));
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
    if (chapterCount(progressOf(P, hero.id), hero.id) === 3) card.appendChild(element('small', '', '★ ' + tr(TITLES[hero.id])));
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
    desc.textContent = available ? tr(ROLES[hero.id].role) + ' · ' + tr(ROLES[hero.id].passive) : tr('Spiele weiter, um diesen Helden zu entdecken.');
    status.textContent = selected ? tr('Ausgewählt') : available ? tr('Freigeschaltet') :
      hero.level ? tr('Level {have}/{need}', { have: P.level, need: hero.level }) :
        tr('Siege {have}/{need}', { have: P.wins || 0, need: hero.wins });
    select.textContent = selected ? tr('Ausgewählt') : available ? tr('Auswählen') : condition(hero);
    select.disabled = !available || selected;
    const role = ROLES[hero.id], p = progressOf(P, hero.id), chapters = chapterCount(p, hero.id);
    skills.replaceChildren();
    skills.append(element('b', '', tr(role.role)), element('p', '', tr(role.passive)),
      element('p', '', tr(role.skill) + ': ' + tr(role.active)));
    if (!available && hero.id === 'toni') skills.append(element('p', '', tr('Oder hilf bei 12 Gebäuden: {n}/12', { n: Math.min(12, P.heroCareer?.build || 0) })));
    if (!available && hero.id === 'nora') skills.append(element('p', '', tr('Oder sammle 60 Goldnuggets oder Edelsteine: {n}/60', { n: Math.min(60, P.heroCareer?.find || 0) })));
    skills.append(element('b', '', tr('Meisterschaft') + ` · ${chapters}/3`));
    if (chapters < 3) {
      skills.append(element('p', '', tr(CHAPTERS[chapters]) + ': ' + tr(role.task, { n: role.goals[chapters] }) +
        ` (${Math.min(role.goals[chapters], Math.floor(p.work || 0))}/${role.goals[chapters]})`));
      const bar = element('progress', 'ha-progress'); bar.max = role.goals[chapters]; bar.value = p.work || 0;
      bar.setAttribute('aria-label', tr(role.task, { n: role.goals[chapters] })); skills.append(bar);
      if (chapters) skills.append(element('p', '', tr('Nutze deine Fähigkeit {n}-mal mit Wirkung: {have}/{n}',
        { n: [0, 2, 8][chapters], have: Math.min([0, 2, 8][chapters], p.feats || 0) })));
      for (const o of challenges(hero.id, chapters)) skills.append(element('p', '', tr(o.text) + ` · ${Math.min(o.goal, Math.floor(p[o.key] || 0))}/${o.goal}`));
    } else skills.append(element('p', '', '★ ' + tr(TITLES[hero.id]) + ' · ' + tr('Persönliches Meisteroutfit und Podest-Pose freigeschaltet')));
    skills.append(element('p', '', tr('Kapitelbelohnungen: 60 XP · 120 XP und Rollenvariante · 200 XP, persönliches Outfit, Titel und Podest-Pose')));
    const variants = element('div', 'ha-variants');
    for (const [id, label] of [['steady', 'Ausdauer: 8 s Wirkung · 40 s Abklingzeit'], ['quick', VARIANTS[hero.id].name]]) {
      const button = element('button', '', tr(label));
      button.disabled = !available || (id === 'quick' && chapters < 2);
      button.setAttribute('aria-pressed', String((P.heroVariants?.[hero.id] || 'steady') === id));
      button.addEventListener('click', () => {
        P.heroVariants ||= {}; P.heroVariants[hero.id] = id; saveProfile(); update();
      });
      variants.append(button);
    }
    skills.append(variants, element('p', '', tr(VARIANTS[hero.id].desc)));
    const match = element('button', 'ha-match-role', tr('Wettkampfrolle wählen: {name}', { name: hero.name }));
    match.setAttribute('aria-pressed', String((P.matchRole || 'anna') === hero.id));
    match.onclick = () => { P.matchRole = hero.id; saveProfile(); updateMe(); update(); }; skills.append(match);
    const matchVariant = element('button', 'ha-match-role', tr('Wettkampfvariante') + ': ' + tr(P.matchVariant === 'quick' ? VARIANTS[hero.id].name : 'Ausdauer'));
    matchVariant.onclick = () => { P.matchVariant = P.matchVariant === 'quick' ? 'steady' : 'quick'; saveProfile(); update(); }; skills.append(matchVariant);
    if (available) skills.append(element('p', '', tr(P.heroDaily === dayNumber() ? 'Heute erledigt · +30 XP' : 'Optional heute: eine Fähigkeit mit Wirkung einsetzen')));
  }
  select.addEventListener('click', () => {
    // Recheck unlocks at commit time; previews of locked cards never grant access.
    if (!selectHero(P, previewId)) return;
    saveProfile();
    ev('hero_select', { hero: previewId });
    updateMe();
    onSelected?.();
    closePanel();
    document.getElementById('lbWho')?.focus({ preventScroll: true });
  });
  update();
  minerArtReady.then(ready => {
    if (!album.isConnected) return;
    for (const hero of HEROES) cards.get(hero.id).querySelector('canvas').replaceWith(portrait(hero, P.hero === hero.id));
    update();
  });
  requestAnimationFrame(() => {
    if (album.isConnected) cards.get(previewId)?.focus({ preventScroll: true });
  });
}
export { openHeroAlbum };
