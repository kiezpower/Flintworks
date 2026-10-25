// Small missions during a round: one at a time, shown under the money. Each teaches a part of
// the game (giving helpers jobs, mining areas, beams, buildings) and pays a bonus.
import { addFloat } from './floats.js';
import { tr } from './i18n.js';
import { mode } from './modes.js';
import { sfx } from './sound.js';
import { sel_ } from './entities.js';
import { isPlayer } from './players.js';
import { G, builds, crew } from './state.js';
import { stock } from './store.js';
import { toast } from './ui.js';
import { W, surf } from './world.js';

const helpers = () => crew.filter(c => !isPlayer(c) && !c.dead);
const deepest = () => {
  const c = sel_();
  return c ? Math.round((c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))]) / 4) : 0;
};
// prog() → current value; goal; reward in Taler. "base" values are taken when the mission starts.
const MISSIONS = [
  {
    id: 'focus',
    text: 'Gib einem Helfer eine Aufgabe',
    goal: 1,
    pay: 20,
    prog: () => (helpers().some(c => c.focus && c.focus !== 'all') ? 1 : 0),
  },
  { id: 'wood', text: 'Sammle {goal} Holz im Lager', goal: 15, pay: 30, prog: () => stock('wood') },
  { id: 'deep', text: 'Grabe {goal} m tief', goal: 20, pay: 30, prog: () => Math.max(0, deepest()) },
  { id: 'beams', text: 'Lass {goal} Stützbalken aufstellen', goal: 3, pay: 40, count: () => (G.beams || []).length },
  { id: 'mark', text: 'Markiere ein Abbaugebiet', goal: 1, pay: 20, prog: () => (G.mineMark ? 1 : 0) },
  {
    id: 'saw',
    text: 'Baue ein Sägewerk',
    goal: 1,
    pay: 50,
    prog: () => (builds.some(b => b.type === 'saw' && b.done) ? 1 : 0),
  },
  { id: 'gold', text: 'Verkaufe {goal} Goldklumpen', goal: 6, pay: 60, count: () => G.goldSold || 0 },
  { id: 'hire', text: 'Heuere einen Helfer an', goal: 1, pay: 40, count: () => crew.length },
  {
    id: 'furnace',
    text: 'Baue einen Hochofen',
    goal: 1,
    pay: 60,
    prog: () => (builds.some(b => b.type === 'furnace' && b.done) ? 1 : 0),
  },
  { id: 'deep2', text: 'Grabe {goal} m tief', goal: 45, pay: 60, prog: () => Math.max(0, deepest()) },
];
const cur = () => (G.mis && MISSIONS[G.mis.i]) || null;
function value(m) {
  if (m.count) return Math.max(0, m.count() - G.mis.base);
  return m.prog();
}
function startMission(i) {
  const m = MISSIONS[i];
  G.mis = { i, base: m && m.count ? m.count() : 0 };
}
function updMissions() {
  if (G.frame % 30 || G.teams || mode().campaign || G.tut) return; // no tasks in Versus, campaign, tutorial
  if (!G.mis) startMission(0);
  const m = cur();
  if (!m) return;
  if (value(m) >= m.goal) {
    G.money += m.pay;
    G.earned = (G.earned || 0) + m.pay;
    const c = sel_();
    if (c) addFloat(c.x + 3, c.y - 6, '+' + m.pay, '#f2c230');
    sfx('fanfare');
    toast('Auftrag erfüllt: +{pay} Taler', { pay: m.pay });
    startMission(G.mis.i + 1);
  }
}
// text for the HUD (empty when all are done)
function missionText() {
  // Versus: how far the other team is instead of a task
  if (G.vs)
    return G.vs
      .map((v, t) => (t === G.myTeam ? null : tr('Gegner {v}/{g}', { v, g: mode().goal })))
      .filter(Boolean)
      .join(' · ');
  const M = mode();
  if (M.campaign) return ''; // the goal bar shows the level's goal
  const m = cur();
  if (!m) return '';
  const v = Math.min(m.goal, value(m));
  return `${tr(m.text, { goal: m.goal })}${m.goal > 1 ? ` ${v}/${m.goal}` : ''} · +${m.pay}`;
}

export { missionText, updMissions };
