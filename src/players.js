// Players: the Wühler that people steer. A player's Wühler carries its id in c.pid; every other
// Wühler is a helper. In a single game there is one player (id 0, this device). In multiplayer
// each device has its own id (G.myId) and the host keeps everybody's latest input here.
import { NOIN } from './clonk.js';
import { inp } from './input.js';
import { G, crew } from './state.js';

G.myId = 0;
const inputs = new Map(); // pid → latest input of a remote player

const isPlayer = c => !!c && c.pid != null;
const clonkOf = pid => crew.find(c => c.pid === pid) || null;
const helpers = () => crew.filter(c => !isPlayer(c) && !c.dead);
// the input that drives a player's Wühler this tick
const inputOf = pid => (pid === G.myId ? inp : inputs.get(pid) || NOIN);
function setInput(pid, I) {
  inputs.set(pid, I);
}

export { clonkOf, helpers, inputOf, isPlayer, setInput };
