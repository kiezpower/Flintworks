// Long-lived settlement goals. Completed milestones belong to the world, never the profile.
import { G, builds, vehicles } from './state.js';
import { tr } from './i18n.js';
import { announceBanner } from './announce.js';

const built = type => builds.some(b => b.type === type && b.done);
export const MILESTONES = [
  { id: 'lumber', text: 'Baue ein Sägewerk und lagere 6 Bretter', goal: 6,
    value: () => built('saw') ? G.store?.plank || 0 : 0 },
  { id: 'metal', text: 'Erforsche Metallurgie und lagere 4 Metall', goal: 4,
    value: () => G.tools?.r_metal && built('furnace') ? G.store?.metal || 0 : 0 },
  { id: 'shaft', text: 'Baue einen Fahrstuhl und erschließe einen 25 m tiefen Schacht', goal: 25,
    value: () => Math.max(0, ...builds.filter(b => b.type === 'lift' && b.done && b.cs).map(b => Math.floor((b.cs.y - b.cs.home) / 4))) },
  { id: 'transport', text: 'Erforsche Schienenbau und baue eine Grubenbahn oder einen Bohrwagen', goal: 1,
    value: () => G.tools?.r_rails && vehicles.some(v => ['train', 'drill'].includes(v.type || v.kind)) ? 1 : 0 },
  { id: 'village', text: 'Versorge 3 Siedler und lagere 6 Brot', goal: 6,
    value: () => (G.villagers || []).length >= 3 ? G.store?.bread || 0 : 0 },
  { id: 'deep', text: 'Stelle eine Diamanthacke her und lagere 4 Edelsteine', goal: 4,
    value: () => G.tools?.dpick ? G.store?.gem || 0 : 0 },
];
export function settlementStatus() {
  const done = G.settlement?.done || [];
  const m = MILESTONES.find(m => !done.includes(m.id));
  return m ? { text: tr(m.text), p: Math.min(m.goal, m.value()), of: m.goal, id: m.id }
    : { text: tr('Eure Siedlung wächst weiter – alle Meilensteine erreicht'), p: 1, of: 1 };
}
export function settlementTick() {
  if (G.mode !== 'settlement' || G.netClient || G.frame % 30) return;
  G.settlement ||= { done: [] };
  const s = settlementStatus();
  if (s.id && s.p >= s.of) {
    G.settlement.done.push(s.id);
    announceBanner('Meilenstein erreicht', MILESTONES.find(m => m.id === s.id).text);
  }
}
