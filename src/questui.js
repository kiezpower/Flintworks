// The tasks on screen: a small tracker under the money during a round (the round's task and the
// three daily quests, each with icon, bar and count) and the task board (pinned notes) that
// opens from the game menu (tab "Aufgaben") and from the level chip in the lobby.
import { missionNow } from './missions.js';
import { P, QUESTS, claimQuest, rollQuests, saveProfile } from './profile.js';
import { sfx } from './sound.js';
import { itemIcon, padIcon } from './sprites.js';
import { G } from './state.js';
import { tr } from './i18n.js';
import './questui.css';

const urls = {};
const item = t => (urls['i' + t] ||= itemIcon(t).toDataURL());
const pad = t => (urls['p' + t] ||= padIcon(t));
// icon of a daily quest and of a task in the round (by its lesson id, lessons.js)
const QUEST_ICON = {
  sell: () => pad('castle'),
  build: () => pad('hammer'),
  chop: () => item('wood'),
  monster: () => pad('sword'),
  gem: () => item('gem'),
  chest: () => pad('chest'),
  gold: () => item('nug'),
};
const MIS_ICON = {
  crewtap: () => pad('crew'),
  hire: () => pad('crew'),
  store: () => item('wood'),
  beams: () => item('wood'),
  depth: () => pad('dig'),
  deep: () => pad('dig'),
  mark: () => pad('dig'),
  gold: () => item('nug'),
  saw: () => item('plank'),
  ore: () => item('metal'),
};
const misIcon = id => (MIS_ICON[id] || (() => pad('hammer')))();
const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
// hours until the quests change (they roll by the UTC date, profile.js)
const hoursLeft = () => Math.max(1, Math.ceil((86400000 - (Date.now() % 86400000)) / 3600000));

// ---- the tracker under the money ----
const el = document.getElementById('qTrack');
let key = '';
const last = {};
function rows() {
  const out = [];
  const m = missionNow();
  if (m)
    out.push({ id: 'm', ico: misIcon(m.id), text: m.text, have: m.v, goal: m.goal, tip: `+${m.pay} ${tr('Taler')}` });
  for (const q of P.quests) {
    const Q = QUESTS[q.id];
    if (!Q) continue;
    out.push({ id: q.id, ico: QUEST_ICON[q.id](), text: tr(Q.text, { n: q.goal }), have: q.have, goal: q.goal, done: q.done, tip: `+${Q.xp} XP` });
  }
  return out;
}
function updTracker() {
  const show = G.state === 'play' && !G.tut;
  if (el.hidden === show) el.hidden = !show;
  if (!show) return;
  const r = rows();
  const k = (P.qtSmall ? 's' : '') + r.map(q => q.id + q.have + '/' + q.goal + (q.done ? 'd' : '') + q.text).join('|');
  if (k === key) return;
  key = k;
  const ready = P.quests.filter(q => !q.done && q.have >= q.goal).length;
  el.classList.toggle('small', !!P.qtSmall);
  el.innerHTML =
    `<button class="qt-head" aria-expanded="${!P.qtSmall}"><span>${tr('Aufgaben')}</span>` +
    (ready ? `<b class="qt-ready">${ready}</b>` : '') +
    `<i>${P.qtSmall ? '▾' : '▴'}</i></button>` +
    (P.qtSmall
      ? ''
      : `<div class="qt-rows">` +
        r
          .map(q => {
            const full = q.have >= q.goal;
            const up = last[q.id] != null && q.have > last[q.id];
            return `<div class="qt-row${full ? ' full' : ''}${q.done ? ' done' : ''}${up ? ' up' : ''}${q.id === 'm' ? ' qt-mis' : ''}" title="${esc(q.text + ' · ' + q.tip)}">
              <img src="${q.ico}" alt="">
              <span class="qt-t">${esc(q.text)}</span>
              <span class="qt-n">${full ? '✓' : `${q.have}/${q.goal}`}</span>
              <span class="qt-bar"><i style="width:${Math.min(100, (q.have / q.goal) * 100)}%"></i></span>
            </div>`;
          })
          .join('') +
        `</div>`);
  for (const q of r) last[q.id] = q.have;
}
let openTasks = () => {};
// the menu that holds the board (main.js sets it; the tracker opens it at the tab "Aufgaben")
function onTrackerOpen(fn) {
  openTasks = fn;
}
el.addEventListener('pointerdown', e => e.stopPropagation());
el.addEventListener('click', e => {
  if (e.target.closest('.qt-head')) {
    P.qtSmall = !P.qtSmall;
    saveProfile();
    sfx('click');
    updTracker();
    return;
  }
  openTasks();
});

// ---- the board ----
// parent: where it goes; reopen: draws the panel again after a reward was claimed
function questBoard(parent, reopen, onClaim) {
  rollQuests();
  const b = document.createElement('div');
  b.className = 'qboard';
  const m = G.state === 'play' && missionNow();
  if (m) {
    const n = document.createElement('div');
    n.className = 'qnote qmis';
    n.innerHTML = `<small>${tr('Auftrag der Runde')}</small>
      <img src="${misIcon(m.id)}" alt="">
      <b>${esc(m.text)}</b>
      <span class="qbar"><i style="width:${(Math.min(m.v, m.goal) / m.goal) * 100}%"></i></span>
      <em>${Math.min(m.v, m.goal)}/${m.goal} · +${m.pay} ${tr('Taler')}</em>`;
    b.appendChild(n);
  }
  P.quests.forEach((q, i) => {
    const Q = QUESTS[q.id];
    if (!Q) return;
    const ready = !q.done && q.have >= q.goal;
    const n = document.createElement('div');
    n.className = 'qnote' + (q.done ? ' done' : '') + (ready ? ' ready' : '');
    n.style.setProperty('--rot', [-2, 1.5, -1][i % 3] + 'deg');
    const prog =
      q.goal <= 10
        ? `<span class="qbox">${Array.from({ length: q.goal }, (_, k) => `<i${k < q.have ? ' class="on"' : ''}></i>`).join('')}</span>`
        : `<span class="qbar"><i style="width:${(q.have / q.goal) * 100}%"></i></span>`;
    n.innerHTML = `<span class="pin"></span>
      <img src="${QUEST_ICON[q.id]()}" alt="">
      <b>${esc(tr(Q.text, { n: q.goal }))}</b>
      ${prog}
      <em>${q.have}/${q.goal} · +${Q.xp} XP</em>
      ${q.done ? `<span class="stamp">${tr('Erledigt')}</span>` : ''}`;
    if (ready) {
      const btn = document.createElement('button');
      btn.className = 'go';
      btn.textContent = tr('Abholen +{n} XP', { n: Q.xp });
      btn.onclick = () => {
        if (performance.now() - G.panelT < 450) return;
        if (claimQuest(q)) {
          sfx('done');
          onClaim?.();
        }
        key = '';
        reopen();
      };
      n.appendChild(btn);
    }
    b.appendChild(n);
  });
  parent.appendChild(b);
  const f = document.createElement('div');
  f.className = 'qfoot';
  f.textContent = tr('Neue Tagesaufgaben in {h} Std', { h: hoursLeft() });
  parent.appendChild(f);
}

export { onTrackerOpen, questBoard, updTracker };
