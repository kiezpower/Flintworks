// Personal objectives use real game actions. Completed legacy chapters stay completed.
const TITLES = { anna: 'Stollenmeisterin', bruno: 'Lastenmeister', mika: 'Aderfinder', juna: 'Gipfelstürmerin', toni: 'Werkmeister', nora: 'Tiefenwächterin' };
const OUTFIT_REWARDS = { anna: 'amber', bruno: 'slate', mika: 'copper', juna: 'teal', toni: 'smith', nora: 'violet' };
const OBJECTIVES = {
  anna: [[], [{ key: 'depth', goal: 15, text: 'Erschließe 15 m Tiefe' }], [{ key: 'deepDig', goal: 1200, text: 'Grabe in einer Welt 1200 Felder unterhalb von 25 m' }]],
  bruno: [[], [{ key: 'fullLoad', goal: 20, text: 'Bringe eine volle Tasche mit 20 Gegenständen zur Basis' }], [{ key: 'deepDelivery', goal: 1, text: 'Bringe mindestens 16 Gegenstände aus 20 m Tiefe sicher heim' }]],
  mika: [[], [{ key: 'findTypes', goal: 2, text: 'Finde Gold und Edelsteine' }], [{ key: 'survey', goal: 4, text: 'Sammle in einer Welt bei aktivem Echolot Funde aus vier Stollenabschnitten' }]],
  juna: [[], [{ key: 'ledges', goal: 3, text: 'Erreiche drei unterschiedliche Kanten in einer Welt' }], [{ key: 'ascent', goal: 12, text: 'Überwinde mit einem Hakenwurf 12 m Höhe' }]],
  toni: [[], [{ key: 'buildTypes', goal: 3, text: 'Hilf bei drei verschiedenen Gebäudearten' }], [{ key: 'workshops', goal: 2, text: 'Warte in einer Welt zwei verschiedene Produktionsarten' }]],
  nora: [[], [{ key: 'recover', goal: 1, text: 'Überstehe Gift oder Brand lebend' }], [{ key: 'safeReturn', goal: 1, text: 'Kehre nach 10 abgefangenen Schadenspunkten mit mindestens 50 Energie zur Basis zurück' }]],
};
const challenges = (id, chapter) => OBJECTIVES[id]?.[chapter] || [];
const missionDone = (p, id, chapter) => challenges(id, chapter).every(o => (p[o.key] || 0) >= o.goal);
const maxRecord = (p, key, n) => { if (Number.isFinite(n)) p[key] = Math.max(p[key] || 0, Math.min(1e6, n)); };
function missionEvent(c, p, id, event, n, meta = {}, active = false) {
  const run = (c.heroMission ||= {})[id] ||= {};
  maxRecord(p, 'depth', c.heroDepth || 0);
  if (id === 'anna' && event === 'dig' && c.heroDepth >= 25) {
    run.deepDig = Math.min(1e6, (run.deepDig || 0) + n); maxRecord(p, 'deepDig', run.deepDig);
  }
  if (id === 'bruno' && event === 'deliver') {
    maxRecord(p, 'fullLoad', meta.load || n);
    if (n >= 16 && (c.heroTripDepth || 0) >= 20) p.deepDelivery = 1;
  }
  if (id === 'mika' && event === 'find') {
    if (['nug', 'gem'].includes(meta.item)) {
      p.findMask = (p.findMask || 0) | (meta.item === 'nug' ? 1 : 2);
      p.findTypes = (p.findMask & 1 ? 1 : 0) + (p.findMask & 2 ? 1 : 0);
    }
    if (active) {
      const key = `${Math.floor(c.x / 32)},${Math.floor(c.y / 32)}`;
      run.sectors ||= []; if (!run.sectors.includes(key) && run.sectors.length < 64) run.sectors.push(key);
      maxRecord(p, 'survey', run.sectors.length);
    }
  }
  if (id === 'juna' && event === 'hook') {
    const key = `${Math.round(c.x / 4)},${Math.round(c.y / 4)}`;
    run.ledges ||= []; if (!run.ledges.includes(key) && run.ledges.length < 64) run.ledges.push(key);
    maxRecord(p, 'ledges', run.ledges.length);
    maxRecord(p, 'ascent', Math.max(0, ((c.heroHookStart ?? c.y) - c.y) / 4));
  }
  if (id === 'toni' && event === 'build' && meta.type) {
    run.buildTypes ||= []; if (!run.buildTypes.includes(meta.type)) run.buildTypes.push(meta.type);
    maxRecord(p, 'buildTypes', run.buildTypes.length);
  }
  if (id === 'toni' && event === 'production' && meta.type) {
    run.workshops ||= []; if (!run.workshops.includes(meta.type)) run.workshops.push(meta.type);
    maxRecord(p, 'workshops', run.workshops.length);
  }
  if (id === 'nora') {
    if (event === 'recover') p.recover = 1;
    if (event === 'guard') c.heroGuardRun = Math.min(1e6, (c.heroGuardRun || 0) + n);
    if (event === 'return' && c.heroGuardRun >= 10 && c.energy >= 50) p.safeReturn = 1;
  }
}
function grantMasterOutfits(profile) {
  let changed = false; profile.owned ||= [];
  for (const [id, outfit] of Object.entries(OUTFIT_REWARDS)) if ((profile.heroMastery?.[id]?.rewarded || 0) >= 3 && !profile.owned.includes('o:' + outfit)) { profile.owned.push('o:' + outfit); changed = true; }
  return changed;
}
export { grantMasterOutfits, TITLES, OUTFIT_REWARDS, challenges, missionDone, missionEvent };
