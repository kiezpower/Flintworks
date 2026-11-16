// Three optional construction projects, shared by the whole settlement and saved with it.
import { G } from './state.js';
const PROJECTS = [
  { id: 'supply', title: 'Stollenlager', tasks: [['wood', 12, 'Liefert 12 Holz'], ['rock', 12, 'Liefert 12 Stein'], ['saw', 1, 'Baut ein Sägewerk']], pay: 80 },
  { id: 'works', title: 'Werkverbund', tasks: [['plank', 18, 'Produziert 18 Bretter'], ['metal', 6, 'Produziert 6 Metall'], ['buildKinds', 3, 'Baut drei verschiedene Gebäudearten']], pay: 120 },
  { id: 'expedition', title: 'Tiefenexpedition', tasks: [['nug', 24, 'Liefert 24 Goldnuggets'], ['gem', 4, 'Liefert vier Edelsteine'], ['depth', 25, 'Erschließt 25 m Tiefe'], ['hooks', 3, 'Erreicht drei Kanten mit dem Enterhaken']], pay: 180 },
];
function projectState() {
  const p = G.heroProject ||= { roles: [] };
  p.values ||= {}; p.done ||= []; p.builds ||= [];
  return p;
}
function projectStatus() {
  if (G.mode !== 'settlement') return null;
  const p = projectState(), next = PROJECTS.find(q => !p.done.includes(q.id));
  return next ? { ...next, values: p.values, done: false } : { title: 'Alle Crew-Projekte geschafft', done: true, tasks: [], values: p.values };
}
function projectEvent(event, n = 1, meta = {}) {
  if (G.mode !== 'settlement' || G.netClient || G.replaying) return;
  const p = projectState(), v = p.values;
  const add = (k, value) => { if (Number.isFinite(value) && value > 0) v[k] = Math.min(1e6, (v[k] || 0) + value); };
  if (event === 'deliver') for (const item of meta.items || []) if (['wood', 'rock', 'nug', 'gem'].includes(item)) add(item, 1);
  if (event === 'made' && ['plank', 'metal'].includes(meta.item)) add(meta.item, n);
  if (event === 'build' && meta.type) {
    if (!p.builds.includes(meta.type) && p.builds.length < 64) p.builds.push(meta.type);
    v.buildKinds = p.builds.length;
    if (meta.type === 'saw') v.saw = 1;
  }
  if (event === 'hook') add('hooks', 1);
  if (event === 'depth') v.depth = Math.max(v.depth || 0, Math.min(1e6, n));
  for (const q of PROJECTS) {
    if (p.done.includes(q.id)) continue;
    if (!q.tasks.every(([key, goal]) => (v[key] || 0) >= goal)) break;
    p.done.push(q.id); G.money += q.pay;
  }
}
export { PROJECTS, projectStatus, projectEvent };
