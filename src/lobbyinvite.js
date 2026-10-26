// Lobby: playing together. Create a room or join one with a code, invite friends (WhatsApp, the
// share sheet, Telegram, SMS, e-mail, copy, QR code), see who is in and get ready. The "+" slots next
// to the hero show the players in the room.
import qrcode from 'qrcode-generator';
import { tr } from './i18n.js';
import { openName } from './lobbyname.js';
import {
  MAX_PLAYERS,
  NET,
  copyText,
  createRoom,
  inviteLink,
  inviteText,
  joinRoom,
  leaveRoom,
  onRoomChange,
  others,
  setReady,
  setVersus,
  shareInvite,
} from './net/room.js';
import { netSaveInfo } from './net/netsave.js';
import { P } from './profile.js';
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
    box.appendChild(meRow());
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
  // the code, a QR code for friends right next to you and the ways to send the link come first:
  // inviting is what a new room is for
  box.innerHTML = `<div class="lb-code">
    <button class="lb-codetap" id="lbCodeTap" title="${tr('Tippen zum Kopieren')}">
      <small>${tr('Raum-Code')}</small><b>${NET.room}</b><small>${tr('Tippen zum Kopieren')}</small>
    </button>
    <div class="lb-qr" title="${tr('Mit der Kamera scannen')}">${qrSvg(inviteLink())}</div>
  </div>`;
  $('lbCodeTap').addEventListener('click', async () => {
    if (fresh()) toast((await copyText(NET.room)) ? 'Code kopiert' : 'Kopieren nicht möglich');
  });
  if (NET.players.length < MAX_PLAYERS) box.appendChild(shareRow());
  box.appendChild(meRow());
  // who is in
  const l = sec(p, tr('Spieler {n}/{max}', { n: NET.players.length, max: MAX_PLAYERS }));
  l.classList.add('lb-players');
  for (const pl of NET.players) {
    const host = pl.pid === NET.hostPid;
    opt(l, {
      title: `<span class="lb-dot" style="background:${pl.cap}"></span>${esc(pl.name)}${pl.pid === NET.pid ? ' ' + tr('(du)') : ''}`,
      sub: !pl.online ? tr('getrennt') : host ? tr('Host') : pl.ready ? tr('bereit') : tr('noch nicht bereit'),
      cost: host ? '★' : pl.ready ? '✓' : '',
      short: true,
      onClick: () => pl.pid === NET.pid && !G.net && openName(openInvite),
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
// "You play as …": tap to change the name others see
function meRow() {
  const b = document.createElement('button');
  b.className = 'lb-me';
  b.innerHTML = `${tr('Du spielst als')} <b>${esc(P.name)}</b> <i>✎</i>`;
  b.addEventListener('click', () => fresh() && openName(openInvite));
  return b;
}
// the invite link as a QR code: friends on the same sofa scan it and are in the room
function qrSvg(url) {
  const q = qrcode(0, 'M');
  q.addData(url);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
// WhatsApp big (it is how most friends are reached), the system share sheet next to it, then
// Telegram, SMS, e-mail and copying for everything else
const enc = encodeURIComponent;
function shareRow() {
  const wrap = document.createElement('div');
  wrap.className = 'lb-share';
  const msg = () => `${inviteText()}\n${inviteLink()}`;
  const go = url => () => {
    // https links open the app or a new tab; sms: and mailto: hand over to the phone
    if (url().startsWith('http')) window.open(url(), '_blank');
    else location.href = url();
  };
  const ways = [
    ['wa', 'WhatsApp', go(() => `https://wa.me/?text=${enc(msg())}`)],
    [
      'more',
      tr('Teilen …'),
      async () => {
        const r = await shareInvite();
        if (r === 'copied') toast('Einladung kopiert');
        else if (r === 'failed') toast('Teilen nicht möglich');
      },
    ],
    ['tg', 'Telegram', go(() => `https://t.me/share/url?url=${enc(inviteLink())}&text=${enc(inviteText())}`)],
    ['sms', 'SMS', go(() => `sms:?&body=${enc(msg())}`)],
    ['mail', tr('E-Mail'), go(() => `mailto:?subject=${enc(tr('Spiel mit mir Flintworks!'))}&body=${enc(msg())}`)],
    ['copy', tr('Kopieren'), async () => toast((await copyText(msg())) ? 'Einladung kopiert' : 'Kopieren nicht möglich')],
  ];
  for (const [k, label, fn] of ways) {
    const b = document.createElement('button');
    b.className = 'lb-way lb-way-' + k;
    b.textContent = label;
    b.addEventListener('click', () => fresh() && fn());
    wrap.appendChild(b);
  }
  return wrap;
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
