// An invitation link (?room=CODE) or friend link (?friend=CODE) opened in the browser of an
// Android phone: a small bar offers to open it in the app instead. It goes through an intent://
// address, so it works without verified app links: with the app installed Android opens it
// there (flintworks://join/CODE, deeplink.js), without it the browser stays on this page and
// plays on (&web=1 keeps the bar away then). Imported first in main.js, so it reads the address
// before friends.js tidies it up.
import { tr } from './i18n.js';
import { ownWeb } from './platform.js';

const PKG = 'de.kiezpower.flintworks';
const q = new URLSearchParams(location.search);
const room = q.get('room'),
  friend = q.get('friend');
const path = room && /^[A-Z0-9]{6}$/i.test(room) ? 'join/' + room.toUpperCase() : friend ? 'friend/' + encodeURIComponent(friend) : '';

function appIntent() {
  const back = new URL(location.href);
  back.searchParams.set('web', '1');
  return `intent://${path}#Intent;scheme=flintworks;package=${PKG};S.browser_fallback_url=${encodeURIComponent(back.href)};end`;
}

if (path && ownWeb() && /Android/i.test(navigator.userAgent) && !q.has('web')) {
  const bar = document.createElement('div');
  bar.id = 'appBar';
  bar.innerHTML = `<span>${tr('Flintworks-App installiert?')}</span><a class="btn" href="${appIntent()}">${tr('In der App öffnen')}</a><button aria-label="${tr('Schließen')}">✕</button>`;
  bar.querySelector('button').addEventListener('click', () => bar.remove());
  document.body.appendChild(bar);
}
