// Small missions during a round: one at a time, shown under the money. Each practises a part of
// the game (giving helpers jobs, mining areas, beams, buildings) and pays a bonus. The list is
// part of the lessons (lessons.js), whose tip explains a mission when it starts.
import { celebrate } from './effects.js';
import { addFloat } from './floats.js';
import { tr } from './i18n.js';
import { MISSIONS } from './lessons.js';
import { mode } from './modes.js';
import { sfx } from './sound.js';
import { sel_ } from './entities.js';
import { G } from './state.js';
import { banner, flyCoins } from './reward.js';

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
    if (c) celebrate(c.x + 3, c.y - 2);
    if (c) flyCoins(c.x + 3, c.y - 6, m.pay);
    sfx('fanfare');
    banner(tr('Auftrag erfüllt'), tr('+{pay} Taler', { pay: m.pay }));
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
