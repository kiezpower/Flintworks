// Player actions as commands. The UI never changes the game directly: it calls send(), and the
// game runs the command for the player who sent it. In a single game that happens right away;
// in multiplayer a client hands the command to the network and the host runs it.
import { G, crew } from './state.js';

const CMD = {};
// fn(c, args, pid): c is the sending player's Wühler
function register(name, fn) {
  CMD[name] = fn;
}
function exec(pid, name, args = {}) {
  const fn = CMD[name];
  const c = crew.find(o => o.pid === pid);
  if (!fn || !c) return;
  G.cmdPid = pid; // whose order this is (messages go to that player)
  try {
    fn(c, args, pid);
  } finally {
    G.cmdPid = null;
  }
}
// the network replaces this while you are a client (net/client.js)
G.sendCmd = null;
function send(name, args = {}) {
  if (G.netClient) G.sendCmd(name, args);
  else exec(G.myId, name, args);
}

export { exec, register, send };
