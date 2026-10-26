// A multiplayer round. Every device builds the same world from the host's seed. The host
// simulates it (with a Wühler for every player) and sends what happens; the others show it
// and send their input (see host.js and client.js). Players may drop out and come back, join
// late, and the host role moves to another player when the host is gone. A quick play room
// fills empty castles with bots (bots.js); a late joiner takes over a bot's castle.
import { addBot, takeOverBot } from '../bots.js';
import { addClonk } from '../entities.js';
import { clearInputs, clonkOf } from '../players.js';
import { deserialize } from '../save.js';
import { G, crew } from '../state.js';
import { useMine } from '../teams.js';
import { startClient, stopClient } from './client.js';
import { sendWorld, startHost, stopHost, welcome } from './host.js';
import { NET, onRoomChange } from './room.js';
import { GAME_MODES } from '../modes.js';
import { H, H0, W, W0, devSize } from '../world.js';

let online = new Set(); // players that were online at the last room update

// the start message the host sends to everybody (gmode: the game mode or map)
function startMessage(gmode) {
  const players = NET.players.filter(p => p.online).map(({ pid, name, cap, hat }) => ({ pid, name, cap, hat }));
  const n = players.length;
  // "Jeder gegen jeden": a castle for every player, from three on and in generated worlds (the
  // maps are built for two castles); with two it is plain Versus
  const free = NET.versus && NET.ffa && !GAME_MODES[gmode]?.pkg;
  // quick play: bots take the castles nobody plays (alone in Versus one, "Jeder gegen jeden" up
  // to three castles)
  const fill = !!NET.auto && !!NET.versus;
  const castles = free ? Math.max(n, fill ? 3 : 0) : fill && n < 2 ? 2 : 0;
  const bots = [];
  for (let t = n; t < castles; t++) bots.push(free ? t : 1);
  const versus = !!NET.versus && n + bots.length >= 2;
  const ffa = versus && free && n + bots.length >= 3 ? n + bots.length : 0;
  // Versus: players in turn to the red and the blue castle (1:1, 2:1, 2:2); each to its own
  const teams = {};
  players
    .map(p => p.pid)
    .sort((a, b) => a - b)
    .forEach((pid, k) => (teams[pid] = ffa ? k : versus ? k % 2 : 0));
  const np = n; // (Koop goals grow with the players)
  // more castles need a wider world: 1700 for three, 2000 for four
  const size = ffa ? [W0 + 300 * (ffa - 2), H0] : devSize;
  // quick play: shorter Versus rounds
  const vsMin = versus && NET.auto ? QUICK_MIN : null;
  return { k: 'start', seed: (Math.random() * 4294967296) >>> 0, size, players, versus, ffa, vsMin, teams, np, gmode, bots };
}
const QUICK_MIN = 4;
// a player's Wühler at the castle of its team
function addPlayerClonk(p, self = false) {
  if ((p.pid === G.myId && !self) || clonkOf(p.pid)) return;
  const team = (G.netStart.teams && G.netStart.teams[p.pid]) || 0;
  // (a castle a bot plays: the player takes over the bot's Wühler)
  if (takeOverBot(team, p)) return;
  const base = teamBase(team);
  const c = addClonk(base.x + 8 + (p.pid % 4) * 6, base.gy - 10);
  Object.assign(c, { pid: p.pid, name: p.name, cap: p.cap, hat: p.hat, inv: [], team });
}
const teamBase = t => (G.teams && G.teams[t] && t !== G.curTeam ? G.teams[t].base : G.base);
// a late joiner goes to the smallest team (in "Jeder gegen jeden" a castle nobody plays)
function teamFor(pid) {
  const T = G.netStart.teams || (G.netStart.teams = {});
  if (T[pid] == null) {
    const n = (G.teams || [0]).map(() => 0);
    for (const k in T) n[T[k]]++;
    T[pid] = G.netStart.versus ? n.indexOf(Math.min(...n)) : 0;
  }
  return T[pid];
}
// after gen(): host adds a Wühler for every other player, a client waits for the host's
function beginNet(d) {
  G.net = true;
  // (late joiners get the size of the world as it is now)
  G.netStart = {
    ...{ seed: d.seed, size: [W, H], biome: d.biome, gmode: d.gmode, diff: d.diff, versus: d.versus, np: d.np },
    ...{ ffa: d.ffa || 0, vsMin: d.vsMin || null },
    teams: { ...d.teams },
  };
  G.myTeam = (d.teams && d.teams[G.myId]) || 0;
  clearInputs();
  online = new Set(NET.players.filter(p => p.online).map(p => p.pid));
  // more goes on in a shared round: natural events come half again as often
  if (!G.relaxed && G.evRate) G.evRate *= 1.5;
  if (NET.host) {
    // your own Wühler (made by gen at the red castle) moves to its team's castle
    const me = clonkOf(G.myId);
    if (me && G.myTeam) {
      const b = teamBase(G.myTeam);
      Object.assign(me, { team: G.myTeam, x: b.x + 10, y: b.gy - 10 });
    }
    for (const p of d.players) addPlayerClonk(p);
    (d.bots || []).forEach((t, k) => addBot(t, k + (d.seed % 6)));
    useMine();
    startHost();
  } else startClient();
}
function endNet() {
  G.net = false;
  G.vs = null;
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
        teamFor(p.pid);
        addPlayerClonk(p);
        welcome(p.pid, { ...G.netStart, players: NET.players });
      }
  online = now;
});

// carry on with a saved round: the saved players' Wühler go to the players in the room with
// the same name, everybody else gets a new one; the others receive the world like late joiners
function resumeNet(s) {
  endNet();
  if (!s || !deserialize(s.data)) return false;
  const cur = NET.players.filter(p => p.online),
    used = new Set();
  for (const c of crew) {
    if (c.pid == null || c.bot) continue; // (bots play on)
    const p = cur.find(q => q.name === c.name && !used.has(q.pid));
    if (p) {
      used.add(p.pid);
      Object.assign(c, { pid: p.pid, cap: p.cap, hat: p.hat });
    } else delete c.pid; // that player is not here: the Wühler helps out
  }
  const teams = {};
  for (const c of crew) if (c.pid != null) teams[c.pid] = c.team || 0;
  G.net = true;
  G.netStart = { ...s.start, size: [W, H], teams };
  for (const p of cur) teamFor(p.pid);
  G.myTeam = G.netStart.teams[G.myId] || 0;
  clearInputs();
  online = new Set(cur.map(p => p.pid));
  for (const p of cur) addPlayerClonk(p, true);
  useMine();
  startHost();
  for (const p of cur) if (p.pid !== G.myId) welcome(p.pid, { ...G.netStart, players: NET.players });
  return true;
}

export { beginNet, endNet, resumeNet, startMessage };
