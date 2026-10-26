// A quick play room starts by itself, like a match in a phone arena game: as soon as two players
// are in, the host counts down and starts the round for everybody; after a round the next one
// follows the same way. When every guest is ready it goes off sooner. Alone, it starts after a
// longer wait anyway: in Versus bots take the other castles (bots.js). The host sends the time
// left every second, the others show it.
import { tr } from '../i18n.js';
import { G } from '../state.js';
import { NET, inRoom, onGameMsg, onRoomChange, sendTo, setReady } from './room.js';
import { modeName } from './rotation.js';

const WAIT = 20000, // ms from two players to the start
  SOLO = 30000, // ms alone until the round starts anyway (against bots)
  READY = 3000; // ms left once everybody is ready
let end = 0, // host: when the round starts (performance.now()), 0: not counting
  sent = -1, // host: the seconds left last sent
  heard = 0; // guest: last word from the host

// the host is free to start a round: in the lobby or on the end card, not in a shared game (a
// paused game of one's own gives way, like it does for any shared round)
const idle = () => G.state !== 'play' && !(G.inRun && G.net);
const online = () => NET.players.filter(p => p.online);

function hostTick() {
  const now = performance.now();
  const go = NET.host && NET.auto && inRoom() && idle() && online().length >= 1;
  if (!go) {
    if (end) {
      end = NET.cdEnd = 0;
      sent = -1;
      if (inRoom()) sendTo('all', { k: 'cd', ms: 0 });
    }
    return;
  }
  const guests = online().filter(p => p.pid !== NET.pid);
  if (!end) end = now + (guests.length ? WAIT : SOLO);
  // somebody came: the usual wait at most
  if (guests.length) end = Math.min(end, now + WAIT);
  if (guests.length && guests.every(p => p.ready)) end = Math.min(end, now + READY);
  NET.cdEnd = end;
  if (now >= end) {
    end = NET.cdEnd = 0;
    sent = -1;
    G.autoPlay?.();
    return;
  }
  // (once a second is enough)
  const s = Math.ceil((end - now) / 1000);
  if (s !== sent) {
    sent = s;
    sendTo('all', { k: 'cd', ms: Math.round(end - now) });
  }
}
onGameMsg('cd', d => {
  if (NET.host) return;
  heard = performance.now();
  NET.cdEnd = d.ms > 0 ? heard + d.ms : 0;
  draw();
});
onRoomChange(() => {
  if (!NET.room) end = NET.cdEnd = 0;
});

// a band at the top of the screen, in the lobby and on the end card
let el = null;
function draw() {
  // (a guest that hears nothing from the host for a while stops counting)
  if (!NET.host && NET.cdEnd && performance.now() - heard > 2500) NET.cdEnd = 0;
  const left = NET.cdEnd ? Math.max(0, Math.ceil((NET.cdEnd - performance.now()) / 1000)) : 0;
  const show = !!NET.auto && inRoom() && idle();
  if (!el) {
    if (!show) return;
    el = document.createElement('div');
    el.id = 'mpCountdown';
    document.body.appendChild(el);
  }
  el.hidden = !show;
  if (!show) return;
  const what = modeName(NET.auto, tr);
  const solo = online().length < 2,
    n = `<b>${left}</b>`;
  el.classList.toggle('on', left > 0);
  el.innerHTML = !left
    ? `${tr('Warte auf Mitspieler …')} · ${what}`
    : solo && NET.auto.versus
      ? `${tr('Noch allein: in {n} s geht es gegen Bots los', { n })} · ${what}`
      : solo
        ? `${tr('Noch allein: in {n} s geht es los', { n })} · ${what}`
        : `${tr('Nächste Runde in {n} s', { n })} · ${what}`;
}

setInterval(() => {
  if (NET.room) {
    hostTick();
    // ready counts for one round: in the game it is reset, so the next countdown runs in full
    const mine = NET.auto && G.inRun && NET.players.find(p => p.pid === NET.pid);
    if (mine && mine.ready) setReady(false);
  }
  draw();
}, 250);
