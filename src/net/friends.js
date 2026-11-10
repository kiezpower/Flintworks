// Friends without a login. The relay derives a public friend code from the device token
// (room.js), so nobody can take another's code. The list lives on the device (P.friends); every
// connect sends it whole, so the relay keeps nothing on disk. Friendship is mutual: online status,
// the room and today's Tagesschicht are only shown when both have each other in their lists; the
// other side sees a request and accepts it with a tap.
// The line to the relay is shared with the room (transport.js); it is only open while the app is
// visible, after the tutorial, and once this device has friends or showed its own code.
import { Share } from '@capacitor/share';
import { dayNo } from '../daily.js';
import { tr } from '../i18n.js';
import { LIVE, isNative, ownWeb } from '../platform.js';
import { P, cleanName, saveProfile } from '../profile.js';
import { G } from '../state.js';
import { NET, copyText, joinRoom, leaveRoom, token } from './room.js';
import { connect, disconnect, on, send, transport, wants } from './transport.js';

const MAX_FRIENDS = 100;
const INVITE_TTL = 2 * 60 * 1000;
const FID_RE = /^[A-Z2-9]{8}$/;
const FR = {
  list: [], // mutual friends from the relay: [{fid, name, online, room, n, daily}]
  asks: [], // who added me and waits: [{fid, name}]
  invite: null, // {from, name, room, at}: a friend invites me into their room
  known: false, // the relay answered since the line opened
  watching: false, // the friends panel is open (connect to learn the own code)
  rank: null, // {day, pos, of}: my place in today's Tagesschicht among everybody (anonymous)
};
if (!Array.isArray(P.friends)) P.friends = [];
if (!Array.isArray(P.fignored)) P.fignored = [];

const listeners = [];
const changed = () => listeners.forEach(fn => fn(FR));
function onFriendsChange(fn) {
  listeners.push(fn);
}
// "abcd-efgh", "ABCD EFGH" → "ABCDEFGH" (or '' if it is no code)
function normFid(s) {
  const c = String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return FID_RE.test(c) ? c : '';
}
const showFid = fid => (fid ? fid.slice(0, 4) + '-' + fid.slice(4) : '');

// ---- the line ----
const played = () => P.tutorialDone || P.games > 0;
const needed = () => played() && !document.hidden && (P.friends.length > 0 || !!P.fid || FR.watching);
function hello() {
  const n = dayNo(),
    best = P.daily?.best?.[n];
  send({
    t: 'hello',
    token: token(),
    name: P.name,
    friends: P.friends.map(f => f.fid),
    ignored: P.fignored,
    daily: { day: n, score: best ?? null },
  });
}
function update() {
  const want = needed();
  if (want && !wants('friends')) {
    const open = transport.status === 'open';
    connect(hello, 'friends');
    if (open) hello();
  } else if (!want && wants('friends')) {
    disconnect('friends');
    FR.known = false;
    for (const f of FR.list) f.online = false;
    changed();
  }
  if (want) takePending();
}
// tell the relay about a change (list, name, Tagesschicht)
function friendsSync() {
  update();
  if (wants('friends')) hello();
}
document.addEventListener('visibilitychange', update);
// a new best Tagesschicht today (daily.js): friends see it
G.onDailyRecord = friendsSync;
setInterval(update, 3000);
on('status', () => {
  if (transport.status !== 'open' && FR.known) {
    FR.known = false;
    changed();
  }
});
on('hi', m => {
  if (P.fid !== m.fid) {
    P.fid = m.fid;
    saveProfile();
  }
  changed();
});
on('friends', m => {
  FR.list = Array.isArray(m.list) ? m.list : [];
  FR.asks = Array.isArray(m.asks) ? m.asks : [];
  FR.known = true;
  // keep the names fresh in the own list
  let dirty = false;
  for (const f of P.friends) {
    const g = FR.list.find(x => x.fid === f.fid);
    if (g && g.name && g.name !== f.name) {
      f.name = cleanName(g.name);
      dirty = true;
    }
  }
  if (dirty) saveProfile();
  changed();
});
// my place in today's Tagesschicht among everybody the relay knows (anonymous, server/relay.js)
on('rank', m => {
  if (!Number.isInteger(m.day) || !Number.isInteger(m.pos) || !Number.isInteger(m.of)) return;
  FR.rank = { day: m.day, pos: m.pos, of: m.of };
  changed();
});
on('finvite', m => {
  if (!m.room || NET.room === m.room || !P.friends.some(f => f.fid === m.from)) return;
  FR.invite = { from: m.from, name: cleanName(m.name || ''), room: String(m.room), at: Date.now() };
  changed();
  G.onFriendInvite?.(FR.invite);
});

// ---- the list ----
// 'ok' | 'bad' (no code) | 'self' | 'have' | 'full'
function addFriend(code, name = '') {
  const fid = normFid(code);
  if (!fid) return 'bad';
  if (fid === P.fid) return 'self';
  if (P.friends.some(f => f.fid === fid)) return 'have';
  if (P.friends.length >= MAX_FRIENDS) return 'full';
  const ask = FR.asks.find(a => a.fid === fid);
  P.friends.push({ fid, name: cleanName(name || ask?.name || '') });
  P.fignored = P.fignored.filter(x => x !== fid);
  saveProfile();
  friendsSync();
  changed();
  return 'ok';
}
function removeFriend(fid) {
  P.friends = P.friends.filter(f => f.fid !== fid);
  FR.list = FR.list.filter(f => f.fid !== fid);
  // (they may still have me: without this they would come back as a request at once; adding
  // them again lifts it)
  if (!P.fignored.includes(fid)) P.fignored.push(fid);
  saveProfile();
  friendsSync();
  changed();
}
function declineAsk(fid) {
  if (!P.fignored.includes(fid)) P.fignored.push(fid);
  P.fignored = P.fignored.slice(-200);
  FR.asks = FR.asks.filter(a => a.fid !== fid);
  saveProfile();
  friendsSync();
  changed();
}
const isFriend = fid => P.friends.some(f => f.fid === fid);
// one entry per friend for the panel: mutual ones with their status, the others waiting
function friendRows() {
  return P.friends.map(f => {
    const g = FR.list.find(x => x.fid === f.fid);
    return g ? { ...g, name: g.name || f.name, mutual: true } : { fid: f.fid, name: f.name, mutual: false, online: false };
  });
}
const onlineCount = () => FR.list.filter(f => f.online).length;

// ---- rooms ----
function inviteFriend(fid) {
  if (!NET.room) return false;
  return send({ t: 'finvite', to: fid });
}
const liveInvite = () => (FR.invite && Date.now() - FR.invite.at < INVITE_TTL && NET.room !== FR.invite.room ? FR.invite : null);
function joinFriend(room) {
  FR.invite = null;
  if (NET.room === room) return changed();
  if (NET.room) leaveRoom();
  joinRoom(room);
  changed();
}
function dropInvite() {
  FR.invite = null;
  changed();
}

// ---- the own code ----
function watchFriends(on) {
  FR.watching = !!on;
  update();
}
const base = () => (ownWeb() && location.hostname !== 'localhost' ? location.origin + location.pathname : LIVE);
const friendLink = () => (P.fid ? `${base()}?friend=${P.fid}&n=${encodeURIComponent(P.name)}` : '');
const friendText = () => tr('Werde mein Freund in Flintworks! Mein Freundescode: {code}', { code: showFid(P.fid) });
// 'shared' | 'copied' | 'failed'
async function shareFriend() {
  const url = friendLink();
  if (!url) return 'failed';
  const text = friendText();
  try {
    if (isNative()) {
      await Share.share({ title: 'Flintworks', text, url, dialogTitle: tr('Freundescode teilen') });
      return 'shared';
    }
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: 'Flintworks', text, url });
      return 'shared';
    }
    return (await copyText(`${text}\n${url}`)) ? 'copied' : 'failed';
  } catch (e) {
    return /cancel|abort/i.test(String(e?.message || e?.name)) ? 'shared' : 'failed';
  }
}

// ---- links: ?friend=CODE&n=Name (web) or flintworks://friend/CODE (deeplink.js) ----
// kept until the tutorial is done (the first start belongs to the tutorial)
function friendFromUrl(url) {
  const m = /[?&]friend=([A-Za-z0-9-]{8,9})/.exec(url || '') || /friend\/([A-Za-z0-9-]{8,9})/.exec(url || '');
  const fid = m && normFid(m[1]);
  if (!fid) return false;
  const n = /[?&]n=([^&#]*)/.exec(url || '');
  let name = '';
  try {
    name = n ? decodeURIComponent(n[1].replace(/\+/g, ' ')) : '';
  } catch {}
  P.pendingFriend = { fid, name: cleanName(name) };
  saveProfile();
  update();
  return true;
}
function takePending() {
  const p = P.pendingFriend;
  if (!p || !played()) return;
  delete P.pendingFriend;
  const r = addFriend(p.fid, p.name);
  saveProfile();
  if (r === 'ok') G.onFriendAdded?.(p);
}
if (friendFromUrl(location.search))
  try {
    const u = new URL(location.href);
    u.searchParams.delete('friend');
    u.searchParams.delete('n');
    history.replaceState(null, '', u);
  } catch {}

export {
  FR,
  addFriend,
  declineAsk,
  dropInvite,
  friendFromUrl,
  friendLink,
  friendRows,
  friendsSync,
  inviteFriend,
  isFriend,
  joinFriend,
  liveInvite,
  normFid,
  onFriendsChange,
  onlineCount,
  removeFriend,
  shareFriend,
  showFid,
  watchFriends,
};
