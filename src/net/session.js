// A multiplayer round. Every device builds the same world from the host's seed. The host
// simulates it (with a Wühler for every player) and sends what happens; the others show it
// and send their input (see host.js and client.js). Players may drop out and come back, join
// late, and the host role moves to another player when the host is gone.
import { addClonk } from '../entities.js';
import { clearInputs, clonkOf } from '../players.js';
import { G } from '../state.js';
import { startClient, stopClient } from './client.js';
import { sendWorld, startHost, stopHost, welcome } from './host.js';
import { NET, onRoomChange } from './room.js';

let online = new Set(); // players that were online at the last room update

// the start message the host sends to everybody
function startMessage() {
  return {
    k: 'start',
    seed: (Math.random() * 4294967296) >>> 0,
    players: NET.players.filter(p => p.online).map(({ pid, name, cap, hat }) => ({ pid, name, cap, hat })),
  };
}
function addPlayerClonk(p) {
  if (p.pid === G.myId || clonkOf(p.pid)) return;
  const c = addClonk(G.base.x + 8 + (p.pid % 4) * 6, G.base.gy - 10);
  Object.assign(c, { pid: p.pid, name: p.name, cap: p.cap, hat: p.hat, inv: [] });
}
// after gen(): host adds a Wühler for every other player, a client waits for the host's
function beginNet(d) {
  G.net = true;
  G.netStart = { seed: d.seed, biome: d.biome, gmode: d.gmode, diff: d.diff };
  clearInputs();
  online = new Set(NET.players.filter(p => p.online).map(p => p.pid));
  if (NET.host) {
    for (const p of d.players) addPlayerClonk(p);
    startHost();
  } else startClient();
}
function endNet() {
  G.net = false;
  stopHost();
  stopClient();
}

onRoomChange(() => {
  if (!G.net || !NET.room) return;
  // the host role moved: the new host carries on with what it has seen, the old one watches
  if (NET.host && !G.netHost) {
    stopClient();
    startHost();
    sendWorld();
  } else if (!NET.host && G.netHost) {
    stopHost();
    startClient();
  }
  const now = new Set(NET.players.filter(p => p.online).map(p => p.pid));
  if (G.netHost)
    for (const p of NET.players)
      if (p.online && p.pid !== G.myId && !online.has(p.pid)) {
        addPlayerClonk(p);
        welcome(p.pid, { ...G.netStart, players: NET.players });
      }
  online = now;
});

export { beginNet, endNet, startMessage };
