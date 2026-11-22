// Lobby: playing together. Play with anybody (quick play or the list of open rooms), create a room
// or join one with a code, invite friends (WhatsApp, the
// share sheet, Telegram, SMS, e-mail, copy, QR code), see who is in and get ready. The "+" slots next
// to the hero show the players in the room.
import qrcode from 'qrcode-generator';
import { GAME_MODES } from './modes.js';
import { PLAY_KINDS } from './playkind.js';
import { tr } from './i18n.js';
import { openName } from './lobbyname.js';
import {
  CODE_RE,
  errorText,
  slotLeft,
  MAX_PLAYERS,
  setWatch,
  NET,
  browseRooms,
  copyText,
  createRoom,
  inviteLink,
  inviteText,
  joinRoom,
  leaveRoom,
  onRoomChange,
  others,
  quickPlay,
  setPublic,
  setReady,
  setVersus,
  shareInvite,
} from './net/room.js';
import { addPlayer, canAdd, openFriends } from './lobbyfriends.js';
import { onlineCount } from './net/friends.js';
import { netSaveInfo } from './net/netsave.js';
import { openWorlds } from './worldui.js';
import { setLocal } from './local.js';
import { fromTag, kindName, modeName, rotation } from './net/rotation.js';
import { P, saveProfile } from './profile.js';
import { G, safeCap } from './state.js';
import { $, closePanel, opt, openPanel, panelEl, sec, toast } from './ui.js';
import { transport } from './net/transport.js';
import { pingHtml } from './net/recent.js';
import './party.css';

let open = false,
  shown = ''; // the room state the panel was drawn for
const stateKey = () => `${NET.status}|${NET.room}|${NET.error}`;

function openInvite() {
  open = true;
  shown = stateKey();
  const p = openPanel('Zusammen spielen');
  const box = document.createElement('div');
  box.className = 'lb-invite';
  p.appendChild(box);
  if (NET.status === 'connecting') {
    // a dropout: the place in the room is held for 30 s (server/relay.js)
    const left = NET.pid != null ? slotLeft() : null;
    box.innerHTML =
      left != null
        ? `<div class="pt-lost"><b>${tr('Verbindung weg')}</b><span>${tr('Verbinde neu … dein Platz wird noch {s} s gehalten', { s: left })}</span></div>`
        : `<div class="pt-lost pt-wait"><span class="pt-spin"></span><span>${tr('Verbinde mit dem Server …')}</span></div>`;
    leaveOpt(p, 'Abbrechen');
    return;
  }
  if (!NET.room) {
    // straight to the point: one tap and you play with whoever is there, no code needed; below
    // the open rooms to pick one, a room for friends and joining with a code
    if (NET.status === 'error' && NET.error)
      box.innerHTML = `<p class="pt-err" role="alert">⚠ ${esc(errorText(NET.error))}</p>`;
    box.appendChild(meRow());
    const quick = document.createElement('button');
    quick.className = 'lb-create';
    quick.id = 'lbQuick';
    quick.innerHTML = `${tr('Schnell spielen')}<small>${tr('Mit anderen Spielern, ohne Code')} · ${modeName(rotation(), tr)}</small>`;
    quick.addEventListener('click', () => fresh() && quickPlay());
    box.appendChild(quick);
    box.insertAdjacentHTML('beforeend', `<p class="lb-or">${tr('oder einen offenen Raum wählen')}</p>`);
    const list = document.createElement('div');
    list.className = 'plist lb-rooms';
    list.id = 'lbRooms';
    box.appendChild(list);
    drawRooms();
    browseRooms(true, () => open && !panelEl.hidden && !!$('lbRooms'));
    box.insertAdjacentHTML('beforeend', `<p class="lb-or">${tr('oder mit Freunden spielen')}</p>`);
    box.appendChild(friendsBtn());
    const go = document.createElement('button');
    go.className = 'lb-way lb-friends';
    go.id = 'lbCreate';
    go.textContent = tr('Raum für Freunde erstellen');
    go.addEventListener('click', () => fresh() && createRoom());
    box.appendChild(go);
    box.insertAdjacentHTML('beforeend', `<p class="lb-or">${tr('oder mit Code beitreten')}</p>`);
    const row = document.createElement('div');
    row.className = 'lb-join';
    row.innerHTML = `<input id="lbCodeIn" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE"><button class="opt short" id="lbJoinBtn"><b>${tr('Beitreten')}</b></button>`;
    box.appendChild(row);
    $('lbJoinBtn').addEventListener('click', () => {
      const code = $('lbCodeIn').value.trim().toUpperCase();
      if (!CODE_RE.test(code)) return toast('Der Raum-Code hat 5 Zeichen');
      joinRoom(code);
    });
    $('lbCodeIn').addEventListener('keydown', e => e.key === 'Enter' && $('lbJoinBtn').click());
    // two at this device, no network (local.js): the second player with a gamepad
    box.insertAdjacentHTML('beforeend', `<p class="lb-or">${tr('oder an diesem Gerät')}</p>`);
    const loc = document.createElement('button');
    loc.className = 'lb-way';
    loc.id = 'lbLocal';
    loc.innerHTML = `🎮 ${tr('Zu zweit an diesem Gerät')}${G.local ? ' ✓' : ''}<small>${tr('Spieler 2 spielt mit einem Gamepad (bei zwei Gamepads das zweite)')}</small>`;
    loc.addEventListener('click', () => {
      if (!fresh()) return;
      setLocal(!G.local);
      if (G.local) {
        P.playKind = 'coop';
        saveProfile();
      }
      G.onRoomChange?.();
      refreshSlots();
      openInvite();
    });
    if (P.playKind !== 'versus') box.appendChild(loc);
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
  if (NET.pub) box.insertAdjacentHTML('afterbegin', `<p class="hint">${tr('Offener Raum: weitere Spieler können jederzeit dazukommen')}</p>`);
  $('lbCodeTap').addEventListener('click', async () => {
    if (fresh()) toast((await copyText(NET.room)) ? 'Code kopiert' : 'Kopieren nicht möglich');
  });
  // who is in: four places, empty ones invite
  box.appendChild(partyGrid());
  // a quick play room: the mode of the hour, and it starts by itself (net/countdown.js)
  if (NET.auto)
    opt(sec(p, 'Modus der Stunde'), {
      title: modeName(NET.auto, tr),
      // (bots switched off in the settings: the host waits for a real opponent)
      sub: tr(
        NET.host && P.bots === false
          ? 'Startet von selbst, sobald ein Mitspieler da ist – Bots sind aus'
          : 'Startet von selbst; allein nach 30 s, im Versus gegen Bots',
      ),
      short: true,
    });
  // Koop or Versus: the host picks, everybody sees it
  if (!NET.auto) {
    box.appendChild(modeSwitch());
    const choice = sec(p, 'Karte');
    opt(choice, {
      title: tr((GAME_MODES[NET.gmode || P.gmode] || GAME_MODES.gold).name),
      disabled: !NET.host,
      sub: tr(NET.host ? 'Tippen: Karte oder Modus ändern' : 'Der Host wählt die Karte'),
      short: true,
      onClick: () => {
        closePanel();
        $('lbKind').click();
      },
    });
    if (NET.versus && !GAME_MODES[NET.gmode || P.gmode]?.pkg && NET.players.length > 2)
      opt(choice, {
        title: tr('Jeder gegen jeden'),
        sub: tr('Jeder mit eigener Burg, eine gestürmte Burg ist raus, der Letzte gewinnt'),
        short: true,
        cost: NET.ffa ? '✓' : '',
        disabled: !NET.host,
        onClick: () => NET.host && setVersus(true, !NET.ffa),
      });
  }
  box.appendChild(readyBar());
  // more ways to invite below (the empty places invite too)
  if (NET.players.length < MAX_PLAYERS) {
    box.insertAdjacentHTML('beforeend', `<p class="lb-or">${tr('Freunde einladen')}</p>`);
    box.appendChild(shareRow());
    box.appendChild(friendsBtn());
  }
  box.appendChild(meRow());
  const a = sec(p, '');
  if (!NET.host) {
    const mine = NET.players.find(q => q.pid === NET.pid);
    // watch instead of playing: no Wühler of your own, the camera follows the others
    opt(a, {
      title: tr(mine && mine.watch ? 'Zuschauen ✓' : 'Zuschauen'),
      sub: tr('Ohne eigenen Wühler zusehen – „Mitspielen“ steigt jederzeit ein'),
      onClick: () => setWatch(!(mine && mine.watch)),
    });
  } else {
    if (!NET.auto) opt(a, { title: tr('Meine Welten'), sub: tr('Eine gespeicherte Welt gemeinsam fortsetzen'), onClick: openWorlds });
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
  }
  // an open room: anybody finds it in the list and through quick play, the code works too
  if (NET.host)
    opt(sec(p, ''), {
      title: tr('Offener Raum'),
      sub: tr(NET.pub ? 'Jeder kann ohne Code beitreten' : 'Nur mit Code oder Einladung'),
      cost: NET.pub ? '✓' : '',
      short: true,
      onClick: () => setPublic(!NET.pub),
    });
  leaveOpt(p, 'Raum verlassen');
}
// the open rooms: who hosts, how many are in, Koop or Versus, a round running (join it late)
function drawRooms() {
  const l = $('lbRooms');
  if (!l) return;
  l.innerHTML = '';
  if (!NET.rooms) {
    l.innerHTML = `<p class="hint">${tr('Suche offene Räume …')}</p>`;
    return;
  }
  if (!NET.rooms.length) {
    l.innerHTML = `<p class="hint">${tr('Gerade ist kein Raum offen. Mit „Schnell spielen“ eröffnest du einen, andere finden ihn hier.')}</p>`;
    return;
  }
  for (const r of NET.rooms) {
    const t = fromTag(r.tag);
    opt(l, {
      title: tr(r.hosted ? 'Dauerwelt: {name}' : 'Raum von {name}', { name: esc(r.host || '?') }),
      sub: `${t ? modeName(t, tr) : tr(kindName(r))}${r.playing ? ' · ' + tr('Spiel läuft') : ''}`,
      cost: `${r.n}/${MAX_PLAYERS}`,
      short: true,
      onClick: () => fresh() && joinRoom(r.code),
    });
  }
}
// the four places of a room: colour, name, host / ready / gone; an empty place invites
function partyGrid() {
  const wrap = document.createElement('div');
  wrap.className = 'pt-party';
  const ready = NET.players.filter(q => q.pid === NET.hostPid || q.ready || q.watch).length;
  wrap.innerHTML = `<div class="pt-head"><b>${tr('Team {n}/{max}', { n: NET.players.length, max: MAX_PLAYERS })}</b><span>${tr('{n} bereit', { n: ready })}</span>${pingHtml(transport)}</div>`;
  const grid = document.createElement('div');
  grid.className = 'pt-grid';
  for (let k = 0; k < MAX_PLAYERS; k++) {
    const pl = NET.players[k];
    const b = document.createElement('button');
    if (!pl) {
      b.className = 'pt-card empty';
      b.innerHTML = `<span class="pt-av">+</span><span class="pt-nm">${tr('Einladen')}</span>`;
      b.addEventListener('click', async () => {
        if (!fresh()) return;
        const r = await shareInvite();
        if (r === 'copied') toast('Einladung kopiert');
        else if (r === 'failed') toast('Teilen nicht möglich');
      });
      grid.appendChild(b);
      continue;
    }
    const host = pl.pid === NET.hostPid,
      mine = pl.pid === NET.pid,
      add = canAdd(pl);
    const [cls, txt] = !pl.online
      ? ['off', tr('getrennt')]
      : host
        ? ['host', '★ ' + tr('Host')]
        : pl.watch
          ? ['watch', '👁 ' + tr('schaut zu')]
          : pl.ready
            ? ['ready', '✓ ' + tr('bereit')]
            : ['wait', tr('nicht bereit')];
    b.className = `pt-card ${cls}${mine ? ' me' : ''}`;
    b.innerHTML = `<span class="pt-av" style="--c:${safeCap(pl.cap)}">${esc((pl.name || '?').slice(0, 1).toUpperCase())}</span>
      <span class="pt-nm">${esc(pl.name)}${mine ? ' ' + tr('(du)') : ''}</span><span class="pt-st">${txt}</span>${add ? '<span class="pt-add" title="' + tr('Als Freund hinzufügen') + '">+</span>' : ''}`;
    b.addEventListener('click', () => {
      if (!fresh()) return;
      if (mine && !G.net) openName(openInvite);
      else if (add) {
        addPlayer(pl);
        openInvite();
      }
    });
    grid.appendChild(b);
  }
  wrap.appendChild(grid);
  return wrap;
}
// Koop or Versus side by side; only the host can switch
function modeSwitch() {
  const w = document.createElement('div');
  w.className = 'pt-seg' + (NET.host ? '' : ' ro');
  for (const [v, icon, name, sub] of [
    [false, '🤝', 'Koop', 'Zusammen gegen die Tiefe'],
    [true, '⚔️', 'Versus', 'Burg gegen Burg'],
  ]) {
    const b = document.createElement('button');
    b.className = 'pt-segb' + (!!NET.versus === v ? ' on' : '');
    b.disabled = !NET.host;
    b.innerHTML = `<i>${icon}</i><b>${tr(name)}</b><small>${tr(sub)}</small>`;
    b.addEventListener('click', () => {
      if (!fresh() || !NET.host || !!NET.versus === v) return;
      P.playKind = v ? 'versus' : 'coop';
      saveProfile();
      setVersus(v);
    });
    w.appendChild(b);
  }
  return w;
}
// the big button: get ready (players) or start (host)
function readyBar() {
  const b = document.createElement('button');
  const mine = NET.players.find(q => q.pid === NET.pid);
  const waiting = NET.players.filter(q => q.online && q.pid !== NET.hostPid && !q.ready && !q.watch).length;
  if (NET.host) {
    b.className = 'pt-go' + (waiting ? ' soft' : '');
    b.innerHTML = `${tr('Spiel starten')}<small>${waiting ? tr('{n} noch nicht bereit', { n: waiting }) : NET.players.length > 1 ? tr('Alle sind bereit!') : tr('Du kannst auch allein loslegen')}</small>`;
    b.addEventListener('click', () => {
      if (!fresh()) return;
      closePanel();
      $('lbPlay').click();
    });
  } else {
    const r = !!(mine && mine.ready);
    b.className = 'pt-go' + (r ? ' done' : '');
    b.innerHTML = `${tr(r ? 'Bereit ✓' : 'Bereit!')}<small>${tr(r ? 'Tippen, um es zurückzunehmen' : NET.auto ? 'Sind alle bereit, geht es gleich los' : 'Der Host startet das Spiel')}</small>`;
    b.addEventListener('click', () => fresh() && setReady(!r));
  }
  return b;
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
// to the friends panel (join a friend's room, invite a friend into this one)
function friendsBtn() {
  const b = document.createElement('button');
  b.className = 'lb-way lb-friends';
  b.id = 'lbToFriends';
  const n = onlineCount();
  b.textContent = n ? tr('Freunde ({n} online)', { n }) : tr('Freunde');
  b.addEventListener('click', () => {
    if (!fresh()) return;
    open = false;
    openFriends(openInvite);
  });
  return b;
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
const fresh = () => performance.now() - G.panelT >= (G.tapGuard ?? 450);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

// the two "+" slots beside the hero show the other players (with up to four in a room, the second
// one also says how many more there are)
function refreshSlots() {
  const list = others();
  ['lbSlot1', 'lbSlot2'].forEach((id, k) => {
    // (two at this device: the first slot shows the second player, local.js)
    const b = $(id),
      pl = list[k] || (k === 0 && G.local && !NET.room ? { name: '🎮 ' + tr('Spieler 2'), ready: true } : null),
      more = k === 1 && list.length > 2 ? ` +${list.length - 2}` : '';
    b.classList.toggle('filled', !!pl);
    b.classList.toggle('waiting', !pl && !!NET.room);
    // a friend is drawn in the scene; the button only carries the name
    b.innerHTML = pl
      ? `<span class="nm">${esc(pl.name)}${pl.online !== false && (pl.ready || pl.pid === NET.hostPid) ? ' ✓' : ''}${more}</span>`
      : '<b>+</b>';
    const status = pl && (!pl.online && pl.pid != null ? tr('getrennt') : pl.watch ? tr('schaut zu') : pl.ready || pl.pid === NET.hostPid ? tr('bereit') : tr('noch nicht bereit'));
    b.title = pl ? `${pl.name} · ${status}${more}` : tr('Mitspieler einladen');
    b.setAttribute('aria-label', b.title);
  });
}
onRoomChange(() => {
  refreshSlots();
  G.onRoomChange?.();
  // joined through an invitation link: straight into the room lobby (or show why not)
  if (G.linkJoin && (NET.status === 'waiting' || NET.status === 'error') && G.state === 'menu' && !$('lobby').hidden && panelEl.hidden) {
    G.linkJoin = false;
    openInvite();
    return;
  }
  // keep the open room panel up to date; a new room list only redraws the list (so a code being
  // typed stays)
  if (open && !panelEl.hidden) {
    if (stateKey() === shown && $('lbRooms')) drawRooms();
    else openInvite();
  } else open = false;
});

// while the line is down, count the held place down once a second
setInterval(() => {
  if (open && !panelEl.hidden && NET.status === 'connecting' && NET.lostAt) openInvite();
}, 1000);

// joining a friend's room from the friends panel: on to the room panel
G.onFriendJoin = () => openInvite();

export { openInvite, refreshSlots };

