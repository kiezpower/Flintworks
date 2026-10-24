// A multiplayer round. Every device builds the same world from the host's seed. The host
// simulates it (with a Wühler for every player) and sends what happens; the others show it
// and send their input (see host.js and client.js).
import { addClonk } from '../entities.js';
import { clearInputs, clonkOf } from '../players.js';
import { G } from '../state.js';
import { startClient, stopClient } from './client.js';
import { startHost, stopHost } from './host.js';
import { NET } from './room.js';

// the start message the host sends to everybody
function startMessage() {
  return {
    k: 'start',
    seed: (Math.random() * 4294967296) >>> 0,
    players: NET.players.filter(p => p.online).map(({ pid, name, cap, hat }) => ({ pid, name, cap, hat })),
  };
}
// after gen(): host adds a Wühler for every other player, a client waits for the host's
function beginNet(d) {
  G.net = true;
  clearInputs();
  if (NET.host) {
    for (const p of d.players) {
      if (p.pid === G.myId || clonkOf(p.pid)) continue;
      const c = addClonk(G.base.x + 8 + (p.pid % 4) * 6, G.base.gy - 10);
      Object.assign(c, { pid: p.pid, name: p.name, cap: p.cap, hat: p.hat, inv: [] });
    }
    startHost();
  } else startClient();
}
function endNet() {
  G.net = false;
  stopHost();
  stopClient();
}

export { beginNet, endNet, startMessage };
