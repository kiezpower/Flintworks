// Crew panel: tap a helper in the crew bar to give it a focus, or tap your own Wühler to set
// the focus for everybody and to mark a mining area.
import { tr } from './i18n.js';
import { sfx } from './sound.js';
import { SPR, itemIcon } from './sprites.js';
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

function setFocus(c, id) {
  c.focus = id;
  c.job = c.path = null;
  G.crewKey = '';
}
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
  const helpers = crew.filter((o, k) => k > 0 && !o.dead);
  const p = openPanel(n === 0 ? 'Mannschaft' : c.name);
  if (n > 0) {
    const l = sec(p, tr('Aufgabe für {name}', { name: c.name }));
    for (const f of FOCUS)
      opt(l, {
        icon: icon(f.icon),
        title: tr(f.title),
        sub: tr(f.sub),
        cost: f.id === (c.focus || 'all') ? '✓' : '',
        onClick: () => {
          setFocus(c, f.id);
          sfx('pick');
          openCrew(n);
        },
      });
  }
  if (helpers.length) {
    const l = sec(p, n === 0 ? 'Aufgabe für alle Helfer' : 'Für alle Helfer');
    for (const f of FOCUS)
      opt(l, {
        icon: icon(f.icon),
        title: tr(f.title),
        sub: n === 0 ? tr(f.sub) : '',
        short: n > 0,
        cost: helpers.every(o => (o.focus || 'all') === f.id) ? '✓' : '',
        onClick: () => {
          for (const o of helpers) setFocus(o, f.id);
          sfx('pick');
          openCrew(n);
        },
      });
  } else sec(p, 'Noch keine Helfer – in der Heimatbasis kannst du welche anheuern');
  // mining area: where the miners should dig
  const me = crew[0];
  const m = sec(p, 'Abbaugebiet');
  opt(m, {
    icon: itemIcon('nug'),
    title: tr('Hier abbauen'),
    sub: tr('Die Bergleute graben rund um diese Stelle'),
    onClick: () => {
      G.mineMark = { x: Math.round(me.x + 3), y: Math.round(me.y + 10) };
      for (const o of helpers) if ((o.focus || 'all') === 'all' || o.focus === 'ore') o.job = o.path = null;
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
        G.mineMark = null;
        openCrew(n);
      },
    });
}

export { focusBadge, openCrew };
