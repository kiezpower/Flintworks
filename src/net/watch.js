// Watching a shared round instead of playing (the lobby's "Zuschauen", net/room.js setWatch): no
// Wühler of your own; the camera follows one of the players. A bar at the bottom names whom,
// ◀ ▶ (arrow keys, d-pad) switch to the next one, "Mitspielen" steps in with a Wühler of your own.
import { tr } from '../i18n.js';
import { isPlayer } from '../players.js';
import { G, crew } from '../state.js';
import { NET, setWatch } from './room.js';

G.watching = false;
G.watchPid = null;
const bar = document.getElementById('watchBar');
const players = () => crew.filter(c => isPlayer(c) && !c.dead && c.pid !== G.myId);
// the Wühler the camera follows (render.js): the chosen player, else the first one there is
function watched() {
  if (!G.net || !G.watching) return null;
  const list = players();
  return list.find(c => c.pid === G.watchPid) || list[0] || null;
}
function cycle(d) {
  const list = players();
  if (!list.length) return;
  const k = Math.max(0, list.findIndex(c => c.pid === G.watchPid));
  G.watchPid = list[(k + d + list.length) % list.length].pid;
  upd();
}
function play() {
  setWatch(false);
}
G.watchCycle = cycle;
G.watchPlay = play;
addEventListener('keydown', e => {
  if (!G.net || !G.watching || G.state !== 'play') return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') cycle(-1);
  if (e.code === 'ArrowRight' || e.code === 'KeyD') cycle(1);
});
bar.querySelector('.wprev').addEventListener('click', () => cycle(-1));
bar.querySelector('.wnext').addEventListener('click', () => cycle(1));
bar.querySelector('.wplay').addEventListener('click', play);
// the bar: shown while watching a running round, with the name of the one followed
function upd() {
  const on = !!(G.net && G.watching && G.state === 'play' && NET.room);
  if (bar.hidden === on) bar.hidden = !on;
  // (nothing to build or carry without a Wühler: those controls step aside, style.css)
  document.body.classList.toggle('watching', on);
  if (!on) return;
  const c = watched(),
    t = c ? `👁 ${tr('Du schaust zu')}: ${c.name}` : `👁 ${tr('Du schaust zu')}`;
  const nm = bar.querySelector('.wname');
  if (nm.textContent !== t) nm.textContent = t;
}

export { cycle, upd as updWatch, watched };
