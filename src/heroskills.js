// Shared, deterministic role rules. Identity stays in the existing skin tag.
import { G, onNewWorld } from './state.js';
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
const skillsAllowed = () => !G.tut && !G.daily && !G.teams && !G.mp?.vs && !G.replayHook?.playing() &&
  ['gold', 'build', 'treasure', 'settlement', 'fort'].includes(G.mode);
const roleOf = c => c?.pid != null && !c.bot && skillsAllowed() ? heroId(c) : null;
const activeSkill = c => !!roleOf(c) && (c.heroActive || 0) > 0 && !c.dead;
const capacity = c => roleOf(c) === 'bruno' ? 20 : 16;
const digFactor = (c, soft) => roleOf(c) === 'anna' ? (soft ? 1.1 : 1) * (activeSkill(c) ? 1.4 : 1) : 1;
const hookFactor = c => roleOf(c) === 'juna' && activeSkill(c) ? 1.4 : 1;
const buildFactor = c => roleOf(c) === 'toni' ? 1.15 : 1;
const progressOf = (profile, id) => profile.heroMastery?.[id] || {};
const chapterDone = (p, id, chapter) => (p.work || 0) >= ROLES[id].goals[chapter] && (p.feats || 0) >= [0, 2, 8][chapter];
const chapterCount = (p, id) => !ROLES[id] ? 0 : CHAPTERS.filter((_, i) => chapterDone(p, id, i)).length;
// Counters belong to the host's figure; snapshots relay them to the owning device.
// No client can award progress to another player; prediction never increments counters.
function heroEvent(c, event, n = 1) {
  const id = roleOf(c);
  if (!skillsAllowed() || c.pid == null || c.bot || G.netClient || c.dead || !Number.isFinite(n) || n <= 0) return;
  if (event === 'build' || event === 'find') {
    c.heroCareer ||= {};
    c.heroCareer[event] = Math.min(1e6, (c.heroCareer[event] || 0) + n);
  }
  if (!id) return;
  const p = (c.heroCounters ||= {})[id] ||= { work: 0, feats: 0 };
  if (event === 'production' && id === 'toni') {
    if (activeSkill(c) && !c.heroUseful) { p.feats++; c.heroUseful = true; contribute(id); }
    return;
  }
  if (event === ROLES[id].event) p.work = Math.min(1e6, p.work + n);
  else return;
  // One productive use per activation. Empty activations never count.
  if (activeSkill(c) && !c.heroUseful) { p.feats++; c.heroUseful = true; contribute(id); }
}
function contribute(id) {
  if (G.mode !== 'settlement') return;
  G.heroProject ||= { roles: [] };
  if (!G.heroProject.roles.includes(id)) G.heroProject.roles.push(id);
}
export { ROLES, CHAPTERS, heroId, skillsAllowed, roleOf, activeSkill, capacity, digFactor, hookFactor, buildFactor,
  progressOf, chapterDone, chapterCount, heroEvent };
