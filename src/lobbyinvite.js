// Lobby: playing together. Create a room or join one with a code, share the invite link,
// see who is in and get ready. The "+" slots next to the hero show the players in the room.
import { tr } from './i18n.js';
import {
  MAX_PLAYERS,
  NET,
  createRoom,
  inviteLink,
  joinRoom,
  leaveRoom,
  onRoomChange,
  others,
  setReady,
  shareInvite,
} from './net/room.js';
import { G } from './state.js';
import { $, closePanel, opt, openPanel, panelEl, sec, toast } from './ui.js';

const ERRORS = { nope: 'Raum nicht gefunden', full: 'Der Raum ist voll', bad: 'Verbindung unterbrochen' };
let open = false;

function openInvite() {
  open = true;
  const p = openPanel('Zusammen spielen');
  const box = document.createElement('div');
  box.className = 'lb-invite';
  p.appendChild(box);
  if (NET.status === 'connecting') {
    box.innerHTML = `<p>${tr('Verbinde mit dem Server …')}</p>`;
    leaveOpt(p, 'Abbrechen');
    return;
  }
  if (!NET.room) {
    box.innerHTML = `<p>${tr('Grabt zu zweit bis zu viert in einer Welt. Erstelle einen Raum und lade Freunde ein – oder tritt mit einem Code bei.')}</p>`;
    if (NET.status === 'error' && NET.error)
      box.innerHTML += `<p class="hint">${tr(ERRORS[NET.error] || 'Keine Verbindung zum Server')}</p>`;
    const l = sec(p, 'Raum');
    opt(l, {
      title: tr('Raum erstellen'),
      sub: tr('Du bist Host: dein Handy rechnet das Spiel'),
      onClick: () => createRoom(),
    });
    // join with a code
    const row = document.createElement('div');
    row.className = 'lb-join';
    row.innerHTML = `<input id="lbCodeIn" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="${tr('Code')}"><button class="opt short" id="lbJoinBtn"><b>${tr('Beitreten')}</b></button>`;
    p.appendChild(row);
    $('lbJoinBtn').addEventListener('click', () => {
      const code = $('lbCodeIn').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) return toast('Der Code hat 6 Zeichen');
      joinRoom(code);
    });
    return;
  }
  box.innerHTML = `<div class="lb-code"><small>${tr('Raum-Code')}</small><b>${NET.room}</b></div>`;
  // who is in
  const l = sec(p, tr('Spieler {n}/{max}', { n: NET.players.length, max: MAX_PLAYERS }));
  for (const pl of NET.players) {
    const host = pl.pid === NET.hostPid;
    opt(l, {
      title: `<span class="lb-dot" style="background:${pl.cap}"></span>${esc(pl.name)}${pl.pid === NET.pid ? ' ' + tr('(du)') : ''}`,
      sub: !pl.online ? tr('getrennt') : host ? tr('Host') : pl.ready ? tr('bereit') : tr('noch nicht bereit'),
      cost: host ? '★' : pl.ready ? '✓' : '',
      short: true,
      onClick: () => {},
    });
  }
  const a = sec(p, 'Einladen');
  if (NET.players.length < MAX_PLAYERS)
    opt(a, {
      title: tr('Link teilen'),
      sub: tr('Schicke deinen Freunden den Einladungslink'),
      onClick: async () => {
        const r = await shareInvite(tr('Grab mit mir in Flintworks!'));
        if (r === 'copied') toast('Link kopiert');
        else if (r === 'failed') toast('Teilen nicht möglich');
      },
    });
  if (!NET.host) {
    const mine = NET.players.find(q => q.pid === NET.pid);
    opt(a, {
      title: tr(mine && mine.ready ? 'Bereit ✓' : 'Bereit?'),
      sub: tr('Der Host startet das Spiel'),
      onClick: () => setReady(!(mine && mine.ready)),
    });
  } else
    opt(a, {
      title: tr('Spiel starten'),
      sub: tr('Mit „Spielen“ in der Lobby geht es für alle los'),
      onClick: () => {
        closePanel();
        $('lbPlay').click();
      },
    });
  const link = document.createElement('p');
  link.className = 'hint lb-link';
  link.textContent = inviteLink();
  p.appendChild(link);
  leaveOpt(p, 'Raum verlassen');
}
function leaveOpt(p, title) {
  opt(sec(p, ''), {
    title: tr(title),
    short: true,
    onClick: () => {
      leaveRoom();
      G.onLeaveRoom?.();
    },
  });
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

// the two "+" slots beside the hero show the other players
function refreshSlots() {
  const list = others();
  ['lbSlot1', 'lbSlot2'].forEach((id, k) => {
    const b = $(id),
      pl = list[k];
    b.classList.toggle('filled', !!pl);
    b.classList.toggle('waiting', !pl && !!NET.room);
    // a friend is drawn in the scene; the button only carries the name
    b.innerHTML = pl
      ? `<span class="nm">${esc(pl.name)}${pl.ready || pl.pid === NET.hostPid ? ' ✓' : ''}</span>`
      : '<b>+</b>';
    b.title = pl ? pl.name : tr('Mitspieler einladen');
  });
}
onRoomChange(() => {
  refreshSlots();
  G.onRoomChange?.();
  // keep the open room panel up to date
  if (open && !panelEl.hidden) openInvite();
  else open = false;
});

export { openInvite, refreshSlots };
