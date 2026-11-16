// Shared, deterministic role rules. Identity stays in the existing skin tag.
import { G, onNewWorld } from './state.js';
import { missionDone, missionEvent } from './heromissions.js';
import { projectEvent } from './heroprojects.js';
import { parseSkin } from './skins.js';

const ROLES = {
  anna: { role: 'Stollenbau', skill: 'Durchbruch', passive: 'Gräbt weichen Boden 10 % schneller.', active: 'Gräbt kurz 40 % schneller. Werkzeuggrenzen bleiben bestehen.', event: 'dig', task: 'Grabe {n} Bodenfelder', goals: [300, 2500, 10000] },
  bruno: { role: 'Transport', skill: 'Kraftakt', passive: 'Trägt 20 statt 16 Gegenstände.', active: 'Läuft mit mindestens vier Gegenständen 25 % schneller.', event: 'deliver', task: 'Bringe {n} Gegenstände zur Basis', goals: [12, 80, 300] },
  mika: { role: 'Erkundung', skill: 'Echolot', passive: 'Nahe Rohstoffe funkeln durch den Boden.', active: 'Spürt Rohstoffe in größerer Entfernung auf.', event: 'find', task: 'Sammle {n} Goldnuggets oder Edelsteine', goals: [4, 25, 100] },
  juna: { role: 'Bewegung', skill: 'Seilschwung', passive: 'Nimmt 20 % weniger Fallschaden.', active: 'Der gekaufte Enterhaken zieht 40 % schneller.', event: 'hook', task: 'Erreiche {n} Kanten mit dem Enterhaken', goals: [2, 12, 40] },
  toni: { role: 'Bau und Produktion', skill: 'Wartung', passive: 'Hilft auf Baustellen 15 % schneller.', active: 'Beschleunigt eine nahe laufende Produktion um 50 %.', event: 'build', task: 'Hilf bei {n} fertiggestellten Gebäuden', goals: [1, 5, 15] },
  nora: { role: 'Gefahren und Kampf', skill: 'Standhalten', passive: 'Gift und Brand klingen 25 % schneller ab.', active: 'Nimmt kurz 30 % weniger Schaden.', event: 'guard', task: 'Überstehe {n} Schadenspunkte mit Standhalten', goals: [5, 30, 100] },
};
onNewWorld.push(() => { G.heroProject = null; });
const CHAPTERS = ['Kennenlernen', 'Anwenden', 'Meistern'];
const identities = new Map();
const heroId = c => {
  const skin = c?.skin || '';
  if (!identities.has(skin)) {
    if (identities.size > 256) identities.clear();
    identities.set(skin, parseSkin(skin).hero);
  }
  return identities.get(skin);
};
// Explicit allowlist: custom maps, campaign, daily, tutorial, replay and Versus stay unchanged.
const competitive = () => !!(G.daily || G.mode === 'daily' || G.teams || G.mp?.vs);
const skillsAllowed = () => !G.tut && (competitive() || ['gold', 'build', 'treasure', 'settlement', 'fort'].includes(G.mode));
const ROLE_IDS = Object.keys(ROLES);
const roleOf = c => c?.pid != null && skillsAllowed() ? (G.mode === 'daily' || G.daily ? ROLE_IDS[((G.daily?.n || 0) % 6 + 6) % 6] : competitive() ? (ROLES[c.matchRole] ? c.matchRole : 'anna') : !c.bot ? heroId(c) : null) : null;
const activeSkill = c => !!roleOf(c) && (c.heroActive || 0) > 0 && !c.dead;
const capacity = c => roleOf(c) === 'bruno' ? 20 : 16;
const digFactor = (c, soft) => roleOf(c) === 'anna' ? (soft ? 1.1 : 1) * (activeSkill(c) ? c.heroQuick ? (soft ? 1 : 1.8) : 1.4 : 1) : 1;
const hookFactor = c => roleOf(c) === 'juna' && activeSkill(c) && !c.heroQuick ? 1.4 : 1;
const buildFactor = c => roleOf(c) === 'toni' ? activeSkill(c) && c.heroQuick ? 1.6 : 1.15 : 1;
const progressOf = (profile, id) => profile.heroMastery?.[id] || {};
const chapterDone = (p, id, chapter) => chapter < (p.rewarded || 0) || (p.work || 0) >= ROLES[id].goals[chapter] && (p.feats || 0) >= [0, 2, 8][chapter] && missionDone(p, id, chapter);
const chapterCount = (p, id) => { let n = 0; while (ROLES[id] && n < 3 && chapterDone(p, id, n)) n++; return n; };
const unlockMask = profile => Object.keys(ROLES).reduce((mask, id, i) => mask | (chapterCount(progressOf(profile, id), id) >= 2 ? 1 << i : 0), 0);
const variantUnlocked = c => competitive() || !!((c.heroUnlocks || 0) & (1 << ROLE_IDS.indexOf(roleOf(c))));
// Counters belong to the host's figure; snapshots relay them to the owning device.
// No client can award progress to another player; prediction never increments counters.
function heroEvent(c, event, n = 1, meta = {}) {
  const id = roleOf(c);
  if (!skillsAllowed() || G.replaying || c.pid == null || c.bot || G.netClient || c.dead || !Number.isFinite(n) || n <= 0) return;
  const usefulEvent = !!id && (event === ROLES[id].event || id === 'toni' && ['production','construction'].includes(event) ||
    id === 'bruno' && c.heroQuick && event === 'gather' || id === 'nora' && event === 'recover');
  let productive = false;
  if (usefulEvent && activeSkill(c) && !c.heroUseful) {
    c.heroUseful = true; productive = true; c.heroUses ||= {};
    c.heroUses[id] = Math.min(1e6, (c.heroUses[id] || 0) + 1);
  }
  if (competitive()) return;
  if (event === 'build' || event === 'find') {
    c.heroCareer ||= {}; c.heroCareer[event] = Math.min(1e6, (c.heroCareer[event] || 0) + n);
  }
  if (!id) return;
  const p = (c.heroCounters ||= {})[id] ||= { work: 0, feats: 0 };
  missionEvent(c, p, id, event, n, meta, activeSkill(c));
  if (productive) { p.feats++; contribute(id); }
  if (event === ROLES[id].event) p.work = Math.min(1e6, p.work + n);
}
function contribute(id) {
  if (G.mode !== 'settlement') return;
  G.heroProject ||= { roles: [] };
  if (!G.heroProject.roles.includes(id)) G.heroProject.roles.push(id);
}
export { ROLES, CHAPTERS, heroId, skillsAllowed, roleOf, activeSkill, capacity, digFactor, hookFactor, buildFactor,
  progressOf, chapterDone, chapterCount, heroEvent, competitive, unlockMask, variantUnlocked };
