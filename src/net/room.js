// Rooms: create or join with a 6-letter code, see who is in, get ready, start together.
// The relay hands out the codes and player ids; the game messages go through sendTo().
import { P } from '../profile.js';
import { G } from '../state.js';
import { connect, disconnect, on, send, transport } from './transport.js';

const NET = {
  room: null, // room code
  pid: null, // own player id in the room
  hostPid: 0,
  host: false, // this device is the host
  players: [], // [{pid, name, cap, hat, ready, online}]
  status: 'offline', // offline | connecting | waiting (in a room) | error
  error: null,
};
const MAX_PLAYERS = 4;
const listeners = [];
const msgHandlers = new Map(); // game message kind → fn(d, from)
const changed = () => listeners.forEach(fn => fn(NET));
function onRoomChange(fn) {
  listeners.push(fn);
}
function onGameMsg(kind, fn) {
  msgHandlers.set(kind, fn);
}

// a random token per device: the relay recognises us again after a dropout
function token() {
  try {
    let t = localStorage.getItem('flintworks-token');
    if (!t) {
      t = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('flintworks-token', t);
    }
    return t;
  } catch {
    return 'anon' + Math.random();
  }
}
const me = () => ({ name: P.name || 'Kurt', cap: P.cap, hat: P.hat, token: token() });

on('room', m => {
  NET.room = m.code;
  NET.pid = m.pid;
  NET.hostPid = m.host;
  NET.host = m.host === m.pid;
  NET.players = m.players;
  NET.status = 'waiting';
  NET.error = null;
  G.myId = m.pid;
  changed();
});
on('players', m => {
  NET.players = m.players;
  NET.hostPid = m.host;
  NET.host = m.host === NET.pid;
  changed();
});
on('error', m => {
  NET.error = m.e;
  NET.status = 'error';
  if (m.e === 'nope' || m.e === 'full') leaveRoom(true);
  changed();
});
on('status', () => {
  if (transport.status !== 'open' && NET.room) NET.status = 'connecting';
  changed();
});
on('msg', m => {
  const fn = m.d && msgHandlers.get(m.d.k);
  if (fn) fn(m.d, m.from);
});

// (re)connect and enter the room; with no room yet a new one is created
function enter() {
  if (NET.room) send({ t: 'join', code: NET.room, ...me() });
  else send({ t: 'create', ...me() });
}
function createRoom() {
  if (NET.room && transport.status === 'open') return;
  NET.status = 'connecting';
  changed();
  connect(enter);
}
function joinRoom(code) {
  NET.room = String(code).toUpperCase();
  NET.status = 'connecting';
  changed();
  if (transport.status === 'open') enter();
  else connect(enter);
}
function leaveRoom(keepError) {
  if (NET.room) send({ t: 'leave' });
  disconnect();
  Object.assign(NET, { room: null, pid: null, host: false, players: [], status: keepError ? 'error' : 'offline' });
  G.myId = 0;
  changed();
}
function setReady(ready) {
  send({ t: 'ready', ready });
}
// game messages: to a player id, 'host' or 'all'
function sendTo(to, d) {
  send({ t: 'msg', to, d });
}
const inRoom = () => !!NET.room && NET.status === 'waiting';
const others = () => NET.players.filter(p => p.pid !== NET.pid);

function inviteLink() {
  return NET.room ? `${location.origin}${location.pathname}?room=${NET.room}` : '';
}
// share sheet on phones, clipboard elsewhere; resolves to 'shared' | 'copied' | 'failed'
async function shareInvite(text) {
  const url = inviteLink();
  if (!url) return 'failed';
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Flintworks', text, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

// app in the background: hang up (saves battery; as host the others get a new host after a
// few seconds) and come back into the room when the app is open again
document.addEventListener('visibilitychange', () => {
  if (!NET.room) return;
  if (document.hidden) disconnect();
  else {
    NET.status = 'connecting';
    changed();
    connect(enter);
  }
});

// ?room=CODE in the address: someone invited us – join right away
const fromUrl = new URLSearchParams(location.search).get('room');
if (fromUrl && /^[A-Z0-9]{6}$/i.test(fromUrl)) joinRoom(fromUrl);

export {
  MAX_PLAYERS,
  NET,
  createRoom,
  inRoom,
  inviteLink,
  joinRoom,
  leaveRoom,
  onGameMsg,
  onRoomChange,
  others,
  sendTo,
  setReady,
  shareInvite,
};
