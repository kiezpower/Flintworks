// Lobby: friends without a login (net/friends.js). The own friend code to share (link, QR code),
// adding a code, requests to accept, who is online and in which room (join, invite into the own
// room), today's Tagesschicht among friends. Also the friends chip in the lobby, the invitation
// from a friend and the "+" for players met in a room or round.
import qrcode from 'qrcode-generator';
import { MEDAL_ICON, dayNo, medalOf } from './daily.js';
import { tr } from './i18n.js';
import {
  FR,
  addFriend,
  declineAsk,
  dropInvite,
  friendLink,
  friendRows,
  inviteFriend,
  isFriend,
  joinFriend,
  liveInvite,
  onFriendsChange,
  onlineCount,
  removeFriend,
  shareFriend,
  showFid,
  watchFriends,
} from './net/friends.js';
import { MAX_PLAYERS, NET, copyText, createRoom, onRoomChange } from './net/room.js';
import { P } from './profile.js';
import { G } from './state.js';
import { $, closePanel, openPanel, panelEl, sec, toast } from './ui.js';
import { ago, lastRound, recentPlayers } from './net/recent.js';
import './friends.css';

const ADD_TOAST = {
  ok: 'Anfrage an {name} geschickt',
  bad: 'Ein Freundescode hat 8 Zeichen',
  self: 'Das ist dein eigener Code',
  have: 'Schon in deiner Liste',
  full: 'Deine Freundesliste ist voll',
};
let open = false,
  back = null, // the panel to return to
  armed = ''; // a friend whose ✕ was tapped once (tap again to remove)
const fresh = () => performance.now() - G.panelT >= (G.tapGuard ?? 450);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function qrSvg(url) {
  const q = qrcode(0, 'M');
  q.addData(url);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
// a row: a dot, the name and a line below, buttons on the right
function row(list, { dot, name, sub, acts = [] }) {
  const r = document.createElement('div');
  r.className = 'fr-row';
  r.innerHTML = `<span class="fr-dot ${dot || ''}"></span><span class="fr-txt"><b>${name}</b><small>${sub || ''}</small></span>`;
  for (const [label, fn, cls] of acts) {
    const b = document.createElement('button');
    b.className = 'fr-act' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', () => fresh() && fn());
    r.appendChild(b);
  }
  list.appendChild(r);
  return r;
}
function tellAdd(r, name) {
  toast(ADD_TOAST[r], { name: name || tr('deinen Freund') });
}

// one-tap "Einladen" without a room of my own: a room for friends opens first, the invitation
// follows once it is there
let pendingInvite = null;
function invite(f) {
  if (NET.room) return toast(inviteFriend(f.fid) ? 'Einladung an {name} geschickt' : 'Keine Verbindung zum Server', { name: f.name });
  pendingInvite = f;
  createRoom();
  toast('Raum wird geöffnet – {name} bekommt gleich die Einladung', { name: f.name });
}
onRoomChange(() => {
  if (!pendingInvite || !NET.room || NET.status !== 'waiting') return;
  const f = pendingInvite;
  pendingInvite = null;
  toast(inviteFriend(f.fid) ? 'Einladung an {name} geschickt' : 'Keine Verbindung zum Server', { name: f.name });
  // on to the new room: you see your friend come in
  if (G.state === 'menu') {
    open = false;
    G.onFriendJoin?.();
  }
});
// where a friend is: Im Menü / In Lobby / Im Match (only for mutual friends who are online)
function where(f) {
  if (!f.mutual) return ['wait', tr('wartet, bis {name} dich auch hinzufügt', { name: esc(f.name || tr('dein Freund')) })];
  if (!f.online) return ['', tr('offline')];
  if (NET.room && f.room === NET.room) return ['on', `<em class="fr-tag lobby">${tr('In deinem Raum')}</em>`];
  const full = f.n != null && !f.room ? ' · ' + tr('voll') : '';
  if (f.playing) return ['on', `<em class="fr-tag play">${tr('Im Match')}</em> ${f.n}/${MAX_PLAYERS}${full}`];
  if (f.n != null) return ['on', `<em class="fr-tag lobby">${tr('In Lobby')}</em> ${f.n}/${MAX_PLAYERS}${full}`];
  return ['on', `<em class="fr-tag on">${tr('Im Menü')}</em>`];
}
// the friends panel is a sheet on the right side (like the friends list of Brawl Stars or
// Fortnite); any other panel opened later is the normal one in the middle again
let sideTitle = '';
new MutationObserver(() => {
  if (panelEl.hidden || $('pTitle').textContent !== sideTitle) panelEl.classList.remove('fr-side');
}).observe(panelEl, { attributes: true, attributeFilter: ['hidden'], subtree: true, childList: true, characterData: true });
// the big button of an empty list: share the own code and link
function inviteBig() {
  const b = document.createElement('button');
  b.className = 'lb-create fr-empty';
  b.id = 'frInviteBig';
  b.innerHTML = `${tr('Freunde einladen')}<small>${tr('Code, Link oder QR-Code teilen')}</small>`;
  b.addEventListener('click', async () => {
    if (!fresh()) return;
    const r = await shareFriend();
    if (r === 'copied') toast('Link kopiert');
    else if (r === 'failed') toast('Teilen nicht möglich');
  });
  return b;
}

// redraw: the panel is already open, only its content changes (no sound, taps stay live, the
// scroll position stays)
function openFriends(from, redraw = false) {
  if (from !== undefined) back = from || null;
  open = true;
  watchFriends(true);
  let p, scroll = 0;
  if (redraw) {
    p = $('pBody');
    scroll = p.scrollTop;
    p.innerHTML = '';
  } else p = openPanel('Freunde');
  sideTitle = $('pTitle').textContent;
  panelEl.classList.add('fr-side');
  const box = document.createElement('div');
  box.className = 'fr-box';
  p.appendChild(box);

  // an invitation from a friend comes first
  const inv = liveInvite();
  if (inv) {
    const c = document.createElement('div');
    c.className = 'fr-invite';
    c.id = 'frInvCard';
    c.innerHTML = `<b>${tr('{name} lädt dich ein', { name: esc(inv.name) })}</b>`;
    const yes = document.createElement('button');
    yes.className = 'lb-create';
    yes.textContent = tr('Annehmen');
    yes.addEventListener('click', () => fresh() && acceptInvite(inv));
    const no = document.createElement('button');
    no.className = 'fr-act';
    no.textContent = tr('Ablehnen');
    no.addEventListener('click', () => fresh() && dropInvite());
    c.append(yes, no);
    box.appendChild(c);
  }

  // requests: they added me
  if (FR.asks.length) {
    const l = sec(p, 'Anfragen');
    l.id = 'frAsks';
    for (const a of FR.asks)
      row(l, {
        dot: 'ask',
        name: esc(a.name || '?'),
        sub: tr('möchte dein Freund sein'),
        acts: [
          [tr('Annehmen'), () => addFriend(a.fid, a.name) === 'ok' && toast('{name} ist jetzt dein Freund', { name: a.name || '?' }), 'yes'],
          ['✕', () => declineAsk(a.fid)],
        ],
      });
  }

  // the friends: online first (green dot and where they are), then offline, then the ones who
  // have not added me yet
  const rows = friendRows().sort((a, b) => b.mutual - a.mutual || b.online - a.online || a.name.localeCompare(b.name));
  const on = rows.filter(f => f.mutual && f.online).length;
  const l = sec(p, rows.length ? tr('Freunde · {on} von {n} online', { on, n: rows.length }) : 'Freunde');
  l.id = 'frList';
  if (!rows.length) {
    l.insertAdjacentHTML('beforeend', `<p class="hint">${tr('Noch keine Freunde – lade welche ein oder tippe nach einem Match auf „+ Freund“.')}</p>`);
    l.appendChild(inviteBig());
  }
  let heading = '';
  for (const f of rows) {
    const h = !f.mutual ? 'Ausstehend' : f.online ? 'Online' : 'Offline';
    if (h !== heading) {
      heading = h;
      l.insertAdjacentHTML('beforeend', `<p class="fr-head">${tr(h)}</p>`);
    }
    const acts = [];
    if (f.mutual && f.online && f.room && f.room !== NET.room) acts.push([tr('Beitreten'), () => (closePanel(), joinFriend(f.room), G.onFriendJoin?.()), 'yes']);
    else if (f.mutual && f.online && f.n == null && (!NET.room || NET.players.length < MAX_PLAYERS)) acts.push([tr('Einladen'), () => invite(f), 'yes']);
    acts.push([
      armed === f.fid ? tr('Entfernen?') : '✕',
      () => {
        if (armed === f.fid) {
          armed = '';
          removeFriend(f.fid);
        } else {
          armed = f.fid;
          openFriends(undefined, true);
        }
      },
      armed === f.fid ? 'no' : '',
    ]);
    const [dot, sub] = where(f);
    row(l, { dot, name: esc(f.name || showFid(f.fid)), sub, acts }).dataset.fid = f.fid;
  }

  // "Zuletzt gespielt mit": teammates of the last shared rounds, one tap to send a request
  const recent = recentPlayers().filter(r => !isFriend(r.fid));
  if (recent.length) {
    const rl = sec(p, 'Zuletzt gespielt mit');
    rl.id = 'frRecent';
    for (const r of recent.slice(0, 6))
      row(rl, {
        dot: 'recent',
        name: esc(r.name || '?'),
        sub: ago(r.at),
        acts: [['+ ' + tr('Freund'), () => tellAdd(addFriend(r.fid, r.name), r.name), 'yes']],
      });
  }

  // today's Tagesschicht among friends
  const mine = P.daily?.best?.[dayNo()];
  const scores = FR.list.filter(f => f.daily != null).map(f => ({ name: f.name, s: f.daily }));
  if (scores.length) {
    scores.push({ name: P.name, s: mine ?? null, me: true });
    scores.sort((a, b) => (b.s ?? -1) - (a.s ?? -1));
    const d = sec(p, 'Tagesschicht heute');
    d.id = 'frDaily';
    scores.forEach((x, k) =>
      row(d, {
        dot: 'rank',
        name: `${k + 1}. ${esc(x.name)}${x.me ? ' ' + tr('(du)') : ''}`,
        sub: x.s == null ? tr('noch nicht gespielt') : `${MEDAL_ICON[medalOf(x.s)]} ${tr('{n} Taler', { n: x.s })}`,
      }),
    );
  }
  // and my place among everybody (anonymous: only the place, server/relay.js)
  const rk = FR.rank && FR.rank.day === dayNo() && mine != null ? FR.rank : null;
  if (rk) {
    let d = p.querySelector('#frDaily');
    if (!d) {
      d = sec(p, 'Tagesschicht heute');
      d.id = 'frDaily';
    }
    const r = row(d, {
      dot: 'rank',
      name: tr('Platz {pos} von {of}', { pos: rk.pos, of: rk.of }),
      sub: tr('unter allen, die heute gespielt haben – ohne Namen'),
    });
    if (r) r.id = 'frRank';
  }

  // adding friends: the own code (tap to copy, QR code for the sofa, share the link) and a code
  const ad = sec(p, 'Freunde hinzufügen');
  ad.classList.add('fr-add');
  if (P.fid) {
    ad.insertAdjacentHTML(
      'beforeend',
      `<div class="lb-code">
        <button class="lb-codetap" id="frCodeTap" title="${tr('Tippen zum Kopieren')}">
          <small>${tr('Dein Freundescode')}</small><b id="frMyCode">${showFid(P.fid)}</b><small>${tr('Tippen zum Kopieren')}</small>
        </button>
        <div class="lb-qr" title="${tr('Mit der Kamera scannen')}">${qrSvg(friendLink())}</div>
      </div>`,
    );
    ad.querySelector('#frCodeTap').addEventListener('click', async () => {
      if (fresh()) toast((await copyText(showFid(P.fid))) ? 'Code kopiert' : 'Kopieren nicht möglich');
    });
    if (rows.length) {
      const sh = document.createElement('button');
      sh.className = 'lb-way lb-friends';
      sh.id = 'frShare';
      sh.textContent = tr('Freundescode teilen …');
      sh.addEventListener('click', async () => {
        if (!fresh()) return;
        const r = await shareFriend();
        if (r === 'copied') toast('Link kopiert');
        else if (r === 'failed') toast('Teilen nicht möglich');
      });
      ad.appendChild(sh);
    }
  } else ad.insertAdjacentHTML('beforeend', `<p class="hint" id="frWait">${tr('Verbinde mit dem Server …')}</p>`);
  ad.insertAdjacentHTML('beforeend', `<p class="lb-or">${tr('Code eines Freundes eingeben')}</p>`);
  const add = document.createElement('div');
  add.className = 'lb-join';
  add.innerHTML = `<input id="frCodeIn" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH"><button class="fr-act yes" id="frAddBtn">${tr('Hinzufügen')}</button>`;
  ad.appendChild(add);
  add.querySelector('#frAddBtn').addEventListener('click', () => {
    if (!fresh()) return;
    const r = addFriend($('frCodeIn').value);
    tellAdd(r);
    if (r === 'ok') $('frCodeIn').value = '';
  });
  add.querySelector('#frCodeIn').addEventListener('keydown', e => e.key === 'Enter' && $('frAddBtn').click());

  p.insertAdjacentHTML('beforeend', `<p class="hint fr-note">${tr('Ohne Konto: Dein Code und deine Liste gehören zu diesem Gerät. Was andere sehen: dein Name, ob du online bist und deine Tagesschicht (Ergebnis und bester Lauf als Geist) – nur Freunde, die dich auch hinzugefügt haben. Für deinen Platz unter allen zählt nur dein Ergebnis, ohne Namen.')}</p>`);
  if (back) {
    const b = document.createElement('button');
    b.className = 'lb-way fr-panel-back';
    b.textContent = tr('Zurück');
    b.addEventListener('click', () => fresh() && (open = false, back()));
    p.appendChild(b);
  }
  if (redraw) p.scrollTop = scroll;
}

// the button at the top right of the main menu: green, friends online; red, requests and
// invitations waiting
function refreshFriendsChip() {
  const b = $('lbFriends');
  if (!b) return;
  const n = onlineCount(),
    a = FR.asks.length + (liveInvite() ? 1 : 0);
  $('lbFriendsN').textContent = n ? String(n) : '';
  $('lbFriendsAlert').textContent = a ? String(a) : '';
  b.classList.toggle('alert', a > 0);
  b.title = [n && tr('{n} online', { n }), a && tr('{n} neu', { n: a })].filter(Boolean).join(' · ') || tr('Freunde');
  showPop();
}

// ---- an invitation as a pop-up: wherever you are in the menu, on top of any panel ----
function acceptInvite(inv) {
  hidePop();
  closePanel();
  joinFriend(inv.room);
  G.onFriendJoin?.();
}
let pop = null;
function hidePop() {
  if (pop) pop.hidden = true;
}
function showPop() {
  const inv = liveInvite();
  // (in a round the invitation waits: a line at the top says so)
  if (!inv || G.state !== 'menu') return hidePop();
  if (!pop) {
    pop = document.createElement('div');
    pop.className = 'fr-pop';
    pop.setAttribute('role', 'alertdialog');
    pop.addEventListener('pointerdown', e => e.stopPropagation());
    document.getElementById('game').appendChild(pop);
  }
  if (!pop.hidden && pop.dataset.room === inv.room) return;
  pop.dataset.room = inv.room;
  pop.id = 'frInvite';
  pop.innerHTML = `<i class="fr-pop-i" aria-hidden="true">🤝</i><b>${tr('{name} lädt dich ein', { name: esc(inv.name) })}</b><small>${tr('Raum {code} · Tippe, um mitzuspielen', { code: inv.room })}</small>`;
  const yes = document.createElement('button');
  yes.className = 'fr-act yes';
  yes.id = 'frInvJoin';
  yes.textContent = tr('Annehmen');
  yes.addEventListener('click', () => acceptInvite(inv));
  const no = document.createElement('button');
  no.className = 'fr-act';
  no.textContent = tr('Ablehnen');
  no.addEventListener('click', () => {
    hidePop();
    dropInvite();
  });
  pop.append(yes, no);
  pop.hidden = false;
}
// an invitation runs out after a while (net/friends.js INVITE_TTL)
setInterval(() => pop && !pop.hidden && !liveInvite() && hidePop(), 2000);

// "+" next to a player met in a room or a round: they get a request
function addPlayer(pl) {
  if (!pl || !pl.fid || isFriend(pl.fid) || pl.fid === P.fid) return;
  tellAdd(addFriend(pl.fid, pl.name), pl.name);
}
const canAdd = pl => !!pl && !!pl.fid && pl.pid !== NET.pid && pl.fid !== P.fid && !isFriend(pl.fid);
// after a match: everybody of the round (also who already left), one tap each to add as a friend
function addButtonsHtml() {
  const seen = new Set(),
    list = [...lastRound(), ...NET.players].filter(pl => pl && pl.fid && pl.fid !== P.fid && !seen.has(pl.fid) && seen.add(pl.fid));
  if (!list.length) return '';
  const btn = pl =>
    isFriend(pl.fid)
      ? `<span class="fr-mate"><b>${esc(pl.name)}</b><em>✓ ${tr('Freund')}</em></span>`
      : `<span class="fr-mate"><b>${esc(pl.name)}</b><button class="fr-act yes" data-addfid="${pl.fid}" data-name="${esc(pl.name)}">+ ${tr('Freund')}</button></span>`;
  return `<div class="fr-end"><p>${tr('Mitspieler als Freund hinzufügen')}</p>${list.map(btn).join('')}</div>`;
}
function wireAddButtons(root) {
  for (const b of root.querySelectorAll('[data-addfid]'))
    b.addEventListener('click', () => {
      addPlayer({ fid: b.dataset.addfid, name: b.dataset.name });
      b.disabled = true;
      b.textContent = '✓ ' + tr('Anfrage gesendet');
    });
}

onFriendsChange(() => {
  refreshFriendsChip();
  if (open && !panelEl.hidden && $('frCodeIn')) {
    // (a code being typed stays)
    const typed = $('frCodeIn').value,
      focus = document.activeElement === $('frCodeIn');
    openFriends(undefined, true);
    $('frCodeIn').value = typed;
    if (focus) $('frCodeIn').focus();
  } else if (open && (panelEl.hidden || !$('frCodeIn'))) {
    open = false;
    armed = '';
    watchFriends(false);
  }
});
// an invitation: a pop-up in the menu (over any panel), a line during a round
G.onFriendInvite = inv => {
  if (G.state === 'menu') showPop();
  else toast('{name} lädt dich ein – in der Lobby annehmen', { name: inv.name });
};
G.onFriendAdded = p => p && toast('Anfrage an {name} geschickt', { name: p.name || tr('deinen Freund') });

export { addButtonsHtml, addPlayer, canAdd, openFriends, refreshFriendsChip, wireAddButtons };
