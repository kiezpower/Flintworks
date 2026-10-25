// Messages and screen shakes that every player (or one team) should get, also on multiplayer
// clients: the host shows them and sends them along as small net events.
import { G } from './state.js';
import { toast } from './ui.js';
import { tr } from './i18n.js';
import { banner } from './reward.js';

// team: only that team hears it (Versus); null: everybody
function announce(key, params, team = null) {
  if (G.netHost) G.netEvent(['t', key, params || null, team]);
  if (team == null || !G.teams || team === G.myTeam) toast(key, params);
}
// the same as a banner across the screen (research done and the like): title and a line below
function announceBanner(title, key, params, team = null) {
  if (G.netHost) G.netEvent(['b', title, key, params || null, team]);
  if (team == null || !G.teams || team === G.myTeam) banner(tr(title), tr(key, params));
}
function quake(strength) {
  if (G.netHost && G.frame % 20 === 0) G.netEvent(['q', strength]);
  G.shake = Math.max(G.shake || 0, strength);
}
// on a client: play an event from above (true if it was one of ours)
function playAnnounce(e) {
  if (e[0] === 't') {
    if (e[3] == null || !G.teams || e[3] === G.myTeam) toast(e[1], e[2] || undefined);
    return true;
  }
  if (e[0] === 'b') {
    if (e[4] == null || !G.teams || e[4] === G.myTeam) banner(tr(e[1]), tr(e[2], e[3] || undefined));
    return true;
  }
  if (e[0] === 'q') {
    G.shake = Math.max(G.shake || 0, e[1]);
    return true;
  }
  return false;
}

export { announce, announceBanner, playAnnounce, quake };
