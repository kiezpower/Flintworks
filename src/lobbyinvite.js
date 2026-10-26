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
  setVersus,
  shareInvite,
} from './net/room.js';
import { netSaveInfo } from './net/netsave.js';
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
    // straight to the point: one tap creates the room, a code joins one
    if (NET.status === 'error' && NET.error)
      box.innerHTML = `<p class="hint">${tr(ERRORS[NET.error] || 'Keine Verbindung zum Server')}</p>`;
    const go = document.createElement('button');
    go.className = 'lb-create';
    go.id = 'lbCreate';
    go.textContent = tr('Raum erstellen');
    go.addEventListener('click', () => fresh() && createRoom());
    box.appendChild(go);
    box.insertAdjacentHTML('beforeend', `<p class="lb-or">${tr('oder mit Code beitreten')}</p>`);
    const row = document.createElement('div');
    row.className = 'lb-join';
    row.innerHTML = `<input id="lbCodeIn" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="${tr('Code')}"><button class="opt short" id="lbJoinBtn"><b>${tr('Beitreten')}</b></button>`;
    box.appendChild(row);
    $('lbJoinBtn').addEventListener('click', () => {
      const code = $('lbCodeIn').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) return toast('Der Code hat 6 Zeichen');
      joinRoom(code);
    });
    $('lbCodeIn').addEventListener('keydown', e => e.key === 'Enter' && $('lbJoinBtn').click());
    return;
  }
  // the code and the share button come first: inviting is what a new room is for
  box.innerHTML = `<div class="lb-code"><small>${tr('Raum-Code')}</small><b>${NET.room}</b><small class="lb-link">${esc(inviteLink())}</small></div>`;
  if (NET.players.length < MAX_PLAYERS) {
    const share = document.createElement('button');
    share.className = 'lb-create';
    share.textContent = tr('Link teilen');
    share.addEventListener('click', async () => {
      if (!fresh()) return;
      const r = await shareInvite(tr('Grab mit mir in Flintworks!'));
      if (r === 'copied') toast('Link kopiert');
      else if (r === 'failed') toast('Teilen nicht möglich');
    });
    box.firstChild.appendChild(share);
  }
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
  // Koop or Versus: the host chooses, everybody sees it
  const m = sec(p, 'Spielart');
  for (const [v, title, sub] of [
    [false, 'Koop', 'Zusammen: eine Burg, eine Kasse, ein Ziel'],
    [true, 'Versus', 'Gegeneinander: rote gegen blaue Burg – wer zuerst das Ziel schafft'],
  ])
    opt(m, {
      title: tr(title),
      sub: tr(sub),
      short: true,
      cost: !!NET.versus === v ? '✓' : '',
      disabled: !NET.host && !!NET.versus !== v,
      onClick: () => NET.host && setVersus(v),
    });
  const a = sec(p, '');
  if (!NET.host) {
    const mine = NET.players.find(q => q.pid === NET.pid);
    opt(a, {
      title: tr(mine && mine.ready ? 'Bereit ✓' : 'Bereit?'),
      sub: tr('Der Host startet das Spiel'),
      onClick: () => setReady(!(mine && mine.ready)),
    });
  } else {
    // a saved shared round: carry on with it
    const sv = netSaveInfo();
    if (sv)
      opt(a, {
        title: tr('Gespeicherte Runde fortsetzen'),
        sub: `${new Date(sv.t).toLocaleString()} · ${sv.names.map(esc).join(', ')}${sv.versus ? ' · Versus' : ''}`,
        onClick: () => {
          G.resumeNet = true;
          closePanel();
          $('lbPlay').click();
        },
      });
    opt(a, {
      title: tr('Spiel starten'),
      sub: tr('Mit „Spielen“ in der Lobby geht es für alle los'),
      onClick: () => {
        closePanel();
        $('lbPlay').click();
      },
    });
  }
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
// ignore the tap that opened the panel landing on the button beneath it (like opt() does)
const fresh = () => performance.now() - G.panelT >= 450;
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
