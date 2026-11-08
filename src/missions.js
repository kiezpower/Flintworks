// Small missions during a round: one at a time, shown under the money. Each practises a part of
// the game (giving helpers jobs, mining areas, beams, buildings) and pays a bonus. The list is
// part of the lessons (lessons.js), whose tip explains a mission when it starts.
import { celebrate } from './effects.js';
import { addFloat } from './floats.js';
import { clockText } from './versus.js';
import { coopText } from './coop.js';
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
  // (tasks about helpers are skipped while they are switched off, settings.js)
  while (G.noHelpers && MISSIONS[i]?.crew) i++;
  const m = MISSIONS[i];
  G.mis = { i, base: m && m.count ? m.count() : 0 };
}
function updMissions() {
  if (G.frame % 30 || G.teams || mode().campaign || G.tut) return; // no tasks in Versus, campaign, tutorial
  if (!G.mis) startMission(0);
  // helpers switched off during a helper task: on to the next one
  if (G.noHelpers && cur()?.crew) startMission(G.mis.i + 1);
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
  // Versus: the clock and how far the other team is instead of a task (with more teams: the
  // one furthest ahead)
  if (G.vs) {
    const rivals = G.vs.filter((v, t) => t !== G.myTeam);
    const rival =
      rivals.length > 1
        ? tr('Bester Gegner {v}/{g}', { v: Math.max(...rivals), g: mode().goal })
        : rivals.map(v => tr('Gegner {v}/{g}', { v, g: mode().goal }));
    return [clockText(), rival].flat().filter(Boolean).join(' · ');
  }
  // Koop: a running team task comes first
  const ct = coopText();
  if (ct) return ct;
  // (the round's own task is in the task tracker under the money, questui.js)
  return '';
}
// the running task of this round for the tracker and the board (null: none, or all done)
function missionNow() {
  if (G.teams || mode().campaign || G.tut || !G.mis) return null;
  const m = cur();
  if (!m) return null;
  return { id: m.id, text: tr(m.text, { goal: m.goal }), v: Math.min(m.goal, value(m)), goal: m.goal, pay: m.pay };
}

export { missionNow, missionText, updMissions };
