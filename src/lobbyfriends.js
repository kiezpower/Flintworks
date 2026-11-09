// Lobby: friends without a login (net/friends.js). The own friend code to share (link, QR code),
// adding a code, requests to accept, who is online and in which room (join, invite into the own
// room), today's Tagesschacht among friends. Also the friends chip in the lobby, the invitation
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
import { MAX_PLAYERS, NET, copyText } from './net/room.js';
import { P } from './profile.js';
import { G } from './state.js';
import { $, closePanel, openPanel, panelEl, sec, toast } from './ui.js';
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
  const box = document.createElement('div');
  box.className = 'fr-box';
  p.appendChild(box);

  // an invitation from a friend comes first
  const inv = liveInvite();
  if (inv) {
    const c = document.createElement('div');
    c.className = 'fr-invite';
    c.id = 'frInvite';
    c.innerHTML = `<b>${tr('{name} lädt dich ein', { name: esc(inv.name) })}</b>`;
    const yes = document.createElement('button');
    yes.className = 'lb-create';
    yes.id = 'frInvJoin';
    yes.textContent = tr('Beitreten');
    yes.addEventListener('click', () => fresh() && (closePanel(), joinFriend(inv.room), G.onFriendJoin?.()));
    const no = document.createElement('button');
    no.className = 'fr-act';
    no.textContent = tr('Später');
    no.addEventListener('click', () => fresh() && dropInvite());
    c.append(yes, no);
    box.appendChild(c);
  }

  // the own code: tap to copy, the QR code for the sofa, share the link
  if (P.fid) {
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="lb-code">
        <button class="lb-codetap" id="frCodeTap" title="${tr('Tippen zum Kopieren')}">
          <small>${tr('Dein Freundescode')}</small><b id="frMyCode">${showFid(P.fid)}</b><small>${tr('Tippen zum Kopieren')}</small>
        </button>
        <div class="lb-qr" title="${tr('Mit der Kamera scannen')}">${qrSvg(friendLink())}</div>
      </div>`,
    );
    $('frCodeTap').addEventListener('click', async () => {
      if (fresh()) toast((await copyText(showFid(P.fid))) ? 'Code kopiert' : 'Kopieren nicht möglich');
    });
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
    box.appendChild(sh);
  } else box.insertAdjacentHTML('beforeend', `<p class="hint" id="frWait">${tr('Verbinde mit dem Server …')}</p>`);

  // add a code
  box.insertAdjacentHTML('beforeend', `<p class="lb-or">${tr('Code eines Freundes eingeben')}</p>`);
  const add = document.createElement('div');
  add.className = 'lb-join';
  add.innerHTML = `<input id="frCodeIn" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH"><button class="fr-act yes" id="frAddBtn">${tr('Hinzufügen')}</button>`;
  box.appendChild(add);
  $('frAddBtn').addEventListener('click', () => {
    if (!fresh()) return;
    const r = addFriend($('frCodeIn').value);
    tellAdd(r);
    if (r === 'ok') $('frCodeIn').value = '';
  });
  $('frCodeIn').addEventListener('keydown', e => e.key === 'Enter' && $('frAddBtn').click());

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

  // the friends: online first, then the others, then the ones who have not added me yet
  const rows = friendRows().sort((a, b) => b.mutual - a.mutual || b.online - a.online || a.name.localeCompare(b.name));
  const l = sec(p, rows.length ? tr('Freunde {n}', { n: rows.length }) : 'Freunde');
  l.id = 'frList';
  if (!rows.length)
    l.innerHTML = `<p class="hint">${tr('Noch keine Freunde. Teile deinen Code oder tippe in einem Raum auf „+“ neben einem Mitspieler.')}</p>`;
  const space = NET.room && NET.players.length < MAX_PLAYERS;
  for (const f of rows) {
    const acts = [];
    if (f.mutual && f.online && f.room && f.room !== NET.room) acts.push([tr('Beitreten'), () => (closePanel(), joinFriend(f.room), G.onFriendJoin?.()), 'yes']);
    else if (f.mutual && f.online && space && f.room !== NET.room)
      acts.push([tr('Einladen'), () => toast(inviteFriend(f.fid) ? 'Einladung an {name} geschickt' : 'Keine Verbindung zum Server', { name: f.name }), 'yes']);
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
    const sub = !f.mutual
      ? tr('wartet, bis {name} dich auch hinzufügt', { name: esc(f.name || tr('dein Freund')) })
      : !f.online
        ? tr('offline')
        : f.room === NET.room && NET.room
          ? tr('in deinem Raum')
          : f.room
            ? tr('online · im Raum ({n}/{max})', { n: f.n, max: MAX_PLAYERS })
            : tr('online');
    row(l, { dot: f.mutual && f.online ? 'on' : f.mutual ? '' : 'wait', name: esc(f.name || showFid(f.fid)), sub, acts }).dataset.fid = f.fid;
  }

  // today's Tagesschacht among friends
  const mine = P.daily?.best?.[dayNo()];
  const scores = FR.list.filter(f => f.daily != null).map(f => ({ name: f.name, s: f.daily }));
  if (scores.length) {
    scores.push({ name: P.name, s: mine ?? null, me: true });
    scores.sort((a, b) => (b.s ?? -1) - (a.s ?? -1));
    const d = sec(p, 'Tagesschacht heute');
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
      d = sec(p, 'Tagesschacht heute');
      d.id = 'frDaily';
    }
    const r = row(d, {
      dot: 'rank',
      name: tr('Platz {pos} von {of}', { pos: rk.pos, of: rk.of }),
      sub: tr('unter allen, die heute gespielt haben – ohne Namen'),
    });
    if (r) r.id = 'frRank';
  }
  p.insertAdjacentHTML('beforeend', `<p class="hint fr-note">${tr('Ohne Konto: Dein Code und deine Liste gehören zu diesem Gerät. Was andere sehen: dein Name, ob du online bist und dein Tagesschacht – nur Freunde, die dich auch hinzugefügt haben. Für deinen Platz unter allen zählt nur dein Ergebnis, ohne Namen.')}</p>`);
  if (back) {
    const b = document.createElement('button');
    b.className = 'lb-way fr-panel-back';
    b.textContent = tr('Zurück');
    b.addEventListener('click', () => fresh() && (open = false, back()));
    p.appendChild(b);
  }
  if (redraw) p.scrollTop = scroll;
}

// the chip in the lobby: friends online, a dot for requests and invitations
function refreshFriendsChip() {
  const b = $('lbFriends');
  if (!b) return;
  const n = onlineCount();
  $('lbFriendsN').textContent = n ? String(n) : '';
  b.classList.toggle('alert', FR.asks.length > 0 || !!liveInvite());
}

// "+" next to a player met in a room or a round: they get a request
function addPlayer(pl) {
  if (!pl || !pl.fid || isFriend(pl.fid) || pl.fid === P.fid) return;
  tellAdd(addFriend(pl.fid, pl.name), pl.name);
}
const canAdd = pl => !!pl && !!pl.fid && pl.pid !== NET.pid && pl.fid !== P.fid && !isFriend(pl.fid);
// the end screen of a shared round: one button per player who is no friend yet
function addButtonsHtml() {
  const list = NET.players.filter(canAdd);
  if (!list.length) return '';
  return `<p class="fr-end">${list.map(pl => `<button class="fr-act yes" data-addfid="${pl.fid}">+ ${esc(pl.name)}</button>`).join(' ')}</p>`;
}
function wireAddButtons(root) {
  for (const b of root.querySelectorAll('[data-addfid]'))
    b.addEventListener('click', () => {
      addPlayer(NET.players.find(pl => pl.fid === b.dataset.addfid));
      b.disabled = true;
      b.textContent = '✓ ' + b.textContent.slice(2);
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
// an invitation: the panel opens in the lobby (when nothing else is open), a note during a round
G.onFriendInvite = inv => {
  if (G.state === 'menu' && !$('lobby').hidden && panelEl.hidden) openFriends(null);
  else toast(G.state === 'menu' ? '{name} lädt dich ein – unter „Freunde“' : '{name} lädt dich ein – in der Lobby annehmen', { name: inv.name });
};
G.onFriendAdded = p => p && toast('Anfrage an {name} geschickt', { name: p.name || tr('deinen Freund') });

export { addButtonsHtml, addPlayer, canAdd, openFriends, refreshFriendsChip, wireAddButtons };
