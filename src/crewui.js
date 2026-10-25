// Crew panel: tap a helper in the crew bar to give it a focus, or tap your own Wühler to set
// the focus for everybody and to mark a mining area.
import { tr } from './i18n.js';
import { sfx } from './sound.js';
import { SPR, itemIcon } from './sprites.js';
import { register, send } from './commands.js';
import { sel_ } from './entities.js';
import { isPlayer } from './players.js';
import { G, crew } from './state.js';
import { closePanel, openPanel, opt, sec, toast } from './ui.js';

const FOCUS = [
  { id: 'all', icon: 'plank', title: 'Alles erledigen', sub: 'Sammeln, bauen, fällen und graben' },
  { id: 'ore', icon: 'nug', title: 'Gold & Erz', sub: 'Gräbt Gold, Erz, Kohle und Edelsteine' },
  { id: 'wood', icon: 'wood', title: 'Holz', sub: 'Fällt Bäume und bringt das Holz heim' },
  { id: 'build', icon: 'rock', title: 'Bauen & Sammeln', sub: 'Hilft auf Baustellen, sammelt Sachen ein' },
  { id: 'follow', icon: 'clonk', title: 'Mir folgen', sub: 'Bleibt bei dir und sammelt unterwegs' },
  { id: 'stay', icon: 'loam', title: 'Pause', sub: 'Wartet in der Basis' },
];
const icon = t => (t === 'clonk' ? SPR.clonkIcon : itemIcon(t));
const focusOf = c => FOCUS.find(f => f.id === (c.focus || 'all'));

function setFocus(c, id, pid) {
  c.focus = id;
  c.followPid = pid; // "follow me" follows whoever gave the order
  c.job = c.path = c.plan = null;
  G.crewKey = '';
}
// your team's helpers (Versus: the other team's helpers do not take your orders)
const helperList = (team = G.myTeam) => crew.filter(o => !isPlayer(o) && !o.dead && (o.team || 0) === team);
// the orders, run for the player who gave them
register('focus', (me, { id, f }, pid) => {
  const c = crew.find(o => o.id === id);
  if (c && !isPlayer(c) && (c.team || 0) === (me.team || 0) && FOCUS.some(x => x.id === f)) setFocus(c, f, pid);
});
register('focusAll', (me, { f }, pid) => {
  if (FOCUS.some(x => x.id === f)) for (const o of helperList(me.team || 0)) setFocus(o, f, pid);
});
register('mark', me => {
  G.mineMark = { x: Math.round(me.x + 3), y: Math.round(me.y + 10) };
  for (const o of helperList(me.team || 0))
    if ((o.focus || 'all') === 'all' || o.focus === 'ore') o.job = o.path = o.plan = null;
});
register('unmark', () => (G.mineMark = null));
// small badge on the crew bar button
function focusBadge(c) {
  const f = c.focus || 'all';
  if (f === 'all') return '';
  if (f === 'follow') return '<i class="fo txt">♥</i>';
  if (f === 'stay') return '<i class="fo txt">z</i>';
  return `<i class="fo" style="background-image:url(${itemIcon(focusOf(c).icon).toDataURL()})"></i>`;
}

function openCrew(n) {
  const c = crew[n];
  if (!c || G.state !== 'play') return;
  const mine = c === sel_();
  if (isPlayer(c) && !mine) return; // other players steer themselves
  const helpers = helperList();
  const p = openPanel(mine ? 'Mannschaft' : c.name);
  if (!mine) {
    const l = sec(p, tr('Aufgabe für {name}', { name: c.name }));
    for (const f of FOCUS)
      opt(l, {
        icon: icon(f.icon),
        title: tr(f.title),
        sub: tr(f.sub),
        cost: f.id === (c.focus || 'all') ? '✓' : '',
        onClick: () => {
          send('focus', { id: c.id, f: f.id });
          sfx('pick');
          openCrew(n);
        },
      }).dataset.tut = 'f_' + f.id;
  }
  if (helpers.length) {
    const l = sec(p, mine ? 'Aufgabe für alle Helfer' : 'Für alle Helfer');
    for (const f of FOCUS)
      opt(l, {
        icon: icon(f.icon),
        title: tr(f.title),
        sub: mine ? tr(f.sub) : '',
        short: !mine,
        cost: helpers.every(o => (o.focus || 'all') === f.id) ? '✓' : '',
        onClick: () => {
          send('focusAll', { f: f.id });
          sfx('pick');
          openCrew(n);
        },
      });
  } else sec(p, 'Noch keine Helfer – in der Heimatbasis kannst du welche anheuern');
  // mining area: where the miners should dig
  const m = sec(p, 'Abbaugebiet');
  opt(m, {
    icon: itemIcon('nug'),
    title: tr('Hier abbauen'),
    sub: tr('Die Bergleute graben rund um diese Stelle'),
    onClick: () => {
      send('mark');
      toast('Abbaugebiet markiert');
      closePanel();
    },
  });
  if (G.mineMark)
    opt(m, {
      icon: itemIcon('rock'),
      title: tr('Markierung entfernen'),
      sub: tr('Die Bergleute suchen wieder selbst'),
      onClick: () => {
        send('unmark');
        openCrew(n);
      },
    });
}

export { focusBadge, openCrew };
