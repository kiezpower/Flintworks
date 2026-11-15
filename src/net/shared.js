// Shared worlds: a settlement world that friends build on in turn. Its owner shares it; the
// relay keeps the latest state (server/relay.js, one world per owner), and everybody in the
// owner's friend list may open it – also while the owner is away. Only one room plays a world at
// a time: who opens it while friends are in it joins their room, otherwise the state comes from
// the relay, is played as host of a room of one's own and goes back to the relay with every save.
// What friends built in the meantime is told in the lobby ("Bert hat an … weitergebaut").
import { P, saveProfile } from '../profile.js';
import { G } from '../state.js';
import { toast } from '../ui.js';
import { readWorld } from '../worldstore.js';
import { FR, joinFriend, watchFriends } from './friends.js';
import { NET, createRoom, inRoom, leaveRoom } from './room.js';
import { on, send, transport } from './transport.js';

const MAX_STATE = 2 * 1024 * 1024; // (the relay's limit)
const SH = {
  worlds: [], // from the relay: [{id, name, owner, ownerName, mine, updated, by, room, n}]
  open: null, // the id of the shared world this room plays (I am its host)
};
const sharedWorlds = () => SH.worlds;
const sharedInfo = id => SH.worlds.find(w => w.id === id) || null;
const ERR = {
  nope: 'Diese Welt ist nicht mehr geteilt',
  big: 'Diese Welt ist zu groß zum Teilen',
  full: 'Der Server hat gerade keinen Platz für weitere Welten',
  one: 'Du teilst schon eine andere Welt – beende das zuerst',
  held: 'Diese Welt wird gerade woanders gespielt – versuch es gleich nochmal',
  bad: 'Das hat nicht geklappt',
};

// ---- answers from the relay: one request at a time waits for its answer ----
let waiting = null; // {id, want, done}
function ask(msg, want, ms = 15000) {
  return new Promise(resolve => {
    if (waiting) waiting.done(null);
    const t = setTimeout(() => waiting?.done(null), ms);
    waiting = {
      id: msg.id,
      want,
      done: r => {
        clearTimeout(t);
        waiting = null;
        resolve(r);
      },
    };
    if (!send(msg)) waiting.done(null);
  });
}
on('world', m => waiting && waiting.id === m.id && waiting.want === 'world' && waiting.done(m));
on('wsaved', m => {
  if (waiting && waiting.id === m.id && waiting.want === 'wsaved') waiting.done(m);
  // (my own save is no news to me)
  seen(m.id, m.updated);
});
on('werr', m => {
  if (waiting && waiting.id === m.id) return waiting.done(m);
  // a save of the running world was refused: it is played elsewhere now, or not shared any more
  if (SH.open === m.id) {
    SH.open = null;
    toast(m.e === 'held' ? 'Diese Welt wird inzwischen woanders gespielt – dein Stand bleibt nur auf diesem Gerät' : ERR[m.e] || ERR.bad);
  }
});
// the line to the relay knows who I am (friends.js says hello on it)
async function line() {
  watchFriends(true);
  const until = Date.now() + 10000;
  while ((!FR.known || transport.status !== 'open') && Date.now() < until) await new Promise(r => setTimeout(r, 100));
  return FR.known && transport.status === 'open';
}

// ---- sharing ----
// 'ok' or the text of what went wrong
async function shareWorld(id) {
  const w = await readWorld(id);
  if (!w) return ERR.bad;
  const save = JSON.stringify(w.save);
  if (save.length > MAX_STATE) return ERR.big;
  if (!(await line())) return 'Keine Verbindung zum Server';
  const r = await ask({ t: 'wshare', id, name: w.name, save }, 'wsaved');
  if (!r) return 'Keine Verbindung zum Server';
  if (r.t === 'werr') return ERR[r.e] || ERR.bad;
  if (G.worldId === id && G.netHost && inRoom()) SH.open = id;
  return 'ok';
}
function unshareWorld(id) {
  if (SH.open === id) SH.open = null;
  SH.worlds = SH.worlds.filter(w => w.id !== id);
  return send({ t: 'wunshare', id });
}

// ---- opening ----
// 'ok' | 'joined' (friends are in it: their room) or the text of what went wrong
async function openShared(id) {
  const info = sharedInfo(id);
  if (!info) return ERR.nope;
  if (SH.open === id && G.inRun && G.worldId === id) return 'ok';
  if (info.room && info.room !== NET.room) {
    joinFriend(info.room);
    return 'joined';
  }
  if (inRoom() && (!NET.host || NET.auto)) return 'Der Host verwaltet die Welten. Verlasse den Raum für deine eigenen Welten.';
  if (!(await line())) return 'Keine Verbindung zum Server';
  const own = !inRoom();
  if (own) {
    P.playKind = 'coop';
    saveProfile();
    createRoom();
    const until = Date.now() + 15000;
    while (!inRoom() && Date.now() < until && NET.status !== 'error') await new Promise(r => setTimeout(r, 100));
    if (!inRoom()) return 'Keine Verbindung zum Server';
  }
  const back = text => {
    if (own) leaveRoom();
    return text;
  };
  const r = await ask({ t: 'wopen', id }, 'world');
  if (!r) return back('Keine Verbindung zum Server');
  if (r.t === 'werr') return back(ERR[r.e] || ERR.bad);
  if (r.room) {
    // somebody was quicker: play with them
    if (own) leaveRoom();
    joinFriend(r.room);
    return 'joined';
  }
  let save;
  try {
    save = JSON.parse(r.save);
  } catch {
    return back(ERR.bad);
  }
  const world = { id, name: String(r.name || info.name || 'Flintworks').slice(0, 48), save };
  if (save?.data) Object.assign(save.data, { worldId: id, worldName: world.name });
  // (loadWorld checks the state before anything of the running game is touched)
  if (!(await G.loadWorld(world))) {
    send({ t: 'wclose' });
    return back('Welt konnte nicht geöffnet werden – die bisherige Welt bleibt gespeichert');
  }
  SH.open = id;
  seen(id, info.updated);
  return 'ok';
}

// ---- saving: every save of the running world goes to the relay (worldarchive.js) ----
let lastPut = 0;
G.sharedUpload = (id, save) => {
  if (SH.open !== id || !G.netHost || !inRoom() || transport.status !== 'open') return;
  const now = Date.now();
  if (now - lastPut < 5000) return;
  let text;
  try {
    text = JSON.stringify(save);
  } catch {
    return;
  }
  if (text.length > MAX_STATE) return;
  lastPut = now;
  send({ t: 'wput', id, save: text });
};
// the room stopped playing the world (left, another world, the round ended), or took one over
// from its host who left: tell the relay
let tried = '', // room and world of the last try to get the world back from the relay
  warned = '';
setInterval(async () => {
  const shared = G.inRun && G.worldId && sharedInfo(G.worldId) ? G.worldId : null,
    mine = shared && G.netHost && inRoom() ? shared : null;
  if (SH.open && SH.open !== mine) {
    SH.open = null;
    send({ t: 'wclose' });
  }
  if (!SH.open && mine) {
    // host after the old one left: the room still holds the world, the saves go on from here
    if (sharedInfo(mine).room === NET.room) SH.open = mine;
    // a kept round of a shared world carried on: friends may have built on since, so the relay's
    // state is the one that counts (once per room; if that fails the round stays on this device)
    else if (tried !== NET.room + mine && G.state === 'play') {
      tried = NET.room + mine;
      const r = await openShared(mine);
      if (r !== 'ok' && r !== 'joined') toast('Diese Welt wird inzwischen woanders gespielt – dein Stand bleibt nur auf diesem Gerät');
    }
  }
  // alone, without a room: nothing reaches the friends
  if (shared && !G.net && !inRoom() && G.state === 'play' && warned !== shared) {
    warned = shared;
    toast('Geteilte Welt: Öffne sie unter „Meine Welten“, damit deine Freunde deinen Stand bekommen');
  }
}, 2000);

// ---- news: a friend built on while I was away ----
// P.sharedSeen: {id: updated} as I last saw it
function seen(id, updated) {
  if (!updated) return;
  P.sharedSeen = P.sharedSeen || {};
  if (P.sharedSeen[id] === updated) return;
  P.sharedSeen[id] = updated;
  saveProfile();
}
const isNews = w => !!w.by && w.by !== P.name && P.sharedSeen?.[w.id] !== w.updated && SH.open !== w.id && !(G.state === 'play' && G.net && G.worldId === w.id);
const sharedNews = () => SH.worlds.filter(isNews);
// the worlds panel was opened: all seen
function sharedSeenAll() {
  for (const w of SH.worlds) seen(w.id, w.updated);
}
const told = new Map(); // id → updated: said once per change
on('friends', m => {
  SH.worlds = Array.isArray(m.worlds) ? m.worlds.filter(w => w && typeof w.id === 'string') : [];
  for (const id of Object.keys(P.sharedSeen || {})) if (!sharedInfo(id)) delete P.sharedSeen[id];
  for (const w of SH.worlds) {
    // (a world I see for the first time is an invitation, a change in a known one is news)
    const first = P.sharedSeen?.[w.id] == null;
    if (!isNews(w) || told.get(w.id) === w.updated || w.room) continue;
    told.set(w.id, w.updated);
    if (G.state !== 'menu') continue;
    if (first) toast('{name} teilt die Welt „{world}“ mit dir', { name: w.ownerName || '?', world: w.name });
    else toast('{name} hat an „{world}“ weitergebaut', { name: w.by, world: w.name });
  }
  G.onSharedChange?.(); // (the open worlds panel, worldui.js)
});

export { SH, openShared, shareWorld, sharedInfo, sharedNews, sharedSeenAll, sharedWorlds, unshareWorld };
