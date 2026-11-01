// Invitations that open the Android app: flintworks://join/CODE or the web link with ?room=CODE;
// friend links: flintworks://friend/CODE or ?friend=CODE (net/friends.js).
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { G } from '../state.js';
import { friendFromUrl } from './friends.js';
import { NET, joinRoom } from './room.js';

function handle(url) {
  if (friendFromUrl(url)) return G.onFriendAdded?.();
  const m = /[?&]room=([A-Z0-9]{6})/i.exec(url || '') || /join\/([A-Z0-9]{6})/i.exec(url || '');
  if (!m) return;
  const code = m[1].toUpperCase();
  if (NET.room === code || G.net) return; // already there, or busy in a round
  joinRoom(code);
  G.onInvited?.();
}
if (Capacitor.isNativePlatform()) {
  App.addListener('appUrlOpen', e => handle(e.url));
  App.getLaunchUrl().then(r => r && handle(r.url));
}
