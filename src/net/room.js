// Rooms: create or join with a 6-letter code, or without one: "quick play" takes any open room
// with space (or opens one), and the list shows the open rooms. See who is in, get ready, start
// together.
// The relay hands out the codes and player ids; the game messages go through sendTo().
import { Share } from '@capacitor/share';
import { tr } from '../i18n.js';
import { LIVE, isNative, ownWeb } from '../platform.js';
import { P } from '../profile.js';
import { G } from '../state.js';
import { fromTag, rotation } from './rotation.js';
import { connect, disconnect, on, send, transport } from './transport.js';

const NET = {
  room: null, // room code
  pid: null, // own player id in the room
  hostPid: 0,
  host: false, // this device is the host
  players: [], // [{pid, name, cap, hat, ready, online}]
  status: 'offline', // offline | connecting | waiting (in a room) | error
  error: null,
  versus: false, // the host's choice: together (Koop) or against each other
  gmode: null, // the host's game mode or map
  pub: false, // open room: anybody can find and join it without a code
  rooms: null, // the open rooms while looking for one: [{code, host, n, versus, playing, tag}]
  auto: null, // a quick play room: its mode {gmode, versus}, fixed; it starts by itself
  cdEnd: 0, // the next round starts at this time (performance.now()), 0: no countdown
};
let quick = false, // the next room to enter is any open one
  wantPub = false; // a room about to be created is open
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
  NET.pub = !!m.pub;
  NET.auto = fromTag(m.tag);
  if (NET.auto) Object.assign(NET, { versus: NET.auto.versus, gmode: NET.auto.gmode });
  NET.status = 'waiting';
  quick = false;
  browseRooms(false);
  NET.error = null;
  G.myId = m.pid;
  changed();
});
on('players', m => {
  NET.players = m.players;
  NET.hostPid = m.host;
  NET.host = m.host === NET.pid;
  NET.pub = !!m.pub;
  if (NET.host) sendCfg();
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
on('rooms', m => {
  if (!browsing || NET.room) return;
  NET.rooms = m.rooms || [];
  changed();
});
// the host's choices, shown to everybody in the room: Koop/Versus and the game mode or map
const sendCfg = () => sendTo('all', { k: 'cfg', versus: !!NET.versus, gmode: NET.gmode });
onGameMsg('cfg', d => {
  NET.versus = !!d.versus;
  NET.gmode = d.gmode || null;
  changed();
});
function setVersus(v) {
  if (NET.auto) return;
  NET.versus = v;
  sendCfg();
  changed();
}
function setGMode(id) {
  if (NET.auto) return;
  NET.gmode = id;
  sendCfg();
  changed();
}
on('msg', m => {
  const fn = m.d && msgHandlers.get(m.d.k);
  if (fn) fn(m.d, m.from);
});

// (re)connect and enter the room; with no room yet a new one is created (or any open one taken)
function enter() {
  if (NET.room) send({ t: 'join', code: NET.room, ...me() });
  else if (quick) send({ t: 'quick', tag: rotation().tag, ...me() });
  else send({ t: 'create', pub: wantPub, ...me() });
}
function go() {
  NET.status = 'connecting';
  changed();
  // (connect() only remembers enter for later reconnects when the line is already open)
  const open = transport.status === 'open';
  connect(enter);
  if (open) enter();
}
// pub: an open room others find in the list and through quick play
function createRoom(pub = false) {
  if (NET.room && transport.status === 'open') return;
  quick = false;
  wantPub = !!pub;
  go();
}
// play with anybody: into an open room with space, or a new open one others will find
function quickPlay() {
  if (NET.room) return;
  quick = true;
  go();
}
// the host opens the room to everybody or closes it again (the code works either way)
function setPublic(on) {
  if (NET.host) send({ t: 'public', on: !!on });
}
// while the room panel is open without a room: ask the relay for the open rooms every few seconds
// (until stillOpen() says the panel is gone)
let browsing = false,
  browseT = 0;
const askRooms = () => send({ t: 'list' });
function browseRooms(on, stillOpen) {
  if (on === browsing) return;
  browsing = on;
  clearInterval(browseT);
  if (on) {
    const open = transport.status === 'open';
    connect(askRooms);
    if (open) askRooms();
    browseT = setInterval(() => (stillOpen && !stillOpen() ? browseRooms(false) : askRooms()), 3000);
  } else {
    NET.rooms = null;
    // only looking, no room: hang up
    if (!NET.room && NET.status !== 'connecting') disconnect();
  }
}
function joinRoom(code) {
  NET.room = String(code).toUpperCase();
  go();
}
function leaveRoom(keepError) {
  browseRooms(false);
  if (NET.room) send({ t: 'leave' });
  disconnect();
  quick = false;
  Object.assign(NET, { room: null, pid: null, host: false, pub: false, auto: null, cdEnd: 0, players: [], gmode: null, status: keepError ? 'error' : 'offline' });
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

// in the Android app (localhost) and on itch.io (a frame) invite with the public web address
function inviteLink() {
  if (!NET.room) return '';
  return `${ownWeb() && location.hostname !== 'localhost' ? location.origin + location.pathname : LIVE}?room=${NET.room}`;
}
// the message friends get: who invites, the code (to type in if the link is not clickable), the link
function inviteText() {
  return tr('{name} lädt dich zu Flintworks ein! Raum-Code: {code}', { name: P.name, code: NET.room });
}
// share sheet: the app's own one in the Android app (the WebView has none), the browser's on
// phones, clipboard elsewhere; resolves to 'shared' | 'copied' | 'failed'
async function shareInvite() {
  const url = inviteLink();
  if (!url) return 'failed';
  const text = inviteText();
  try {
    if (isNative()) {
      await Share.share({ title: 'Flintworks', text, url, dialogTitle: tr('Freunde einladen') });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title: 'Flintworks', text, url });
      return 'shared';
    }
    return (await copyText(`${text}\n${url}`)) ? 'copied' : 'failed';
  } catch (e) {
    // closing the share sheet is not an error
    return /cancel|abort/i.test(String(e?.message || e?.name)) ? 'shared' : 'failed';
  }
}
// clipboard, with the old textarea way for WebViews without the clipboard API
async function copyText(s) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = s;
    t.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    t.remove();
    return ok;
  }
}
// a new name or hat while waiting in a room: joining again with the same token updates us
function updateMe() {
  if (inRoom() && !G.net) send({ t: 'join', code: NET.room, ...me() });
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
  browseRooms,
  copyText,
  createRoom,
  setGMode,
  setVersus,
  inRoom,
  inviteLink,
  inviteText,
  joinRoom,
  leaveRoom,
  onGameMsg,
  onRoomChange,
  others,
  quickPlay,
  sendTo,
  setPublic,
  setReady,
  shareInvite,
  updateMe,
};
