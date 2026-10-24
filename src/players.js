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
// a remote player's latest input; button presses stay set until a tick has used them
function setInput(pid, I) {
  const old = inputs.get(pid);
  if (old) for (const k of EDGES) I[k] = I[k] || old[k];
  inputs.set(pid, I);
}
const EDGES = ['jumpP', 'jumpUp', 'throwP', 'actP'];
function consumeEdges() {
  for (const I of inputs.values()) for (const k of EDGES) I[k] = false;
}
function clearInputs() {
  inputs.clear();
}

export { clearInputs, clonkOf, consumeEdges, helpers, inputOf, isPlayer, setInput };
