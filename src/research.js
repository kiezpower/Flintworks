// Research at the castle: a small tech tree. One topic at a time runs in the background and
// unlocks vehicles, rails, tools and equipment. The state lives in G.tools (per team, saved
// and sent to the other players like the tools): 'r_<id>' when done, _rq while running.
import { announceBanner } from './announce.js';
import { register, send } from './commands.js';
import { tr } from './i18n.js';
import { sfx } from './sound.js';
import { toolIcon } from './sprites.js';
import { G } from './state.js';
import { useMine, useTeam } from './teams.js';
import { toast } from './ui.js';

// time in seconds of game time
const RESEARCH = {
  mech: { name: 'Mechanik', sub: 'Katapult, Seilbahn, Bohrwagen', money: 40, time: 30, icon: 'gear' },
  metal: { name: 'Metallurgie', sub: 'Stahlhacke, Schwert, Bohrwagen', money: 60, time: 40, icon: 'dig' },
  archery: { name: 'Bogenbau', sub: 'Langbogen, Pfeile und Brandpfeile', money: 40, time: 25, icon: 'bow' },
  rails: { name: 'Schienenbau', sub: 'Schienen und Grubenbahn', money: 50, time: 30, req: ['mech'], icon: 'rails' },
  armor: { name: 'Rüstungsschmiede', sub: 'Schild und Eisenhelm', money: 70, time: 40, req: ['metal'], icon: 'shield' },
  flight: { name: 'Luftfahrt', sub: 'Luftschiff', money: 120, time: 60, req: ['mech', 'metal'], icon: 'balloon' },
};
const known = id => !id || !!(G.tools && G.tools['r_' + id]);
const knowsAll = ids => (ids || []).every(known);
const running = () => (G.tools && G.tools._rq) || null;
const missing = ids => (ids || []).filter(id => !known(id));
// "Erst erforschen: Mechanik, Metallurgie"
const needText = ids =>
  tr('Erst erforschen: {list}', {
    list: missing(ids)
      .map(id => tr(RESEARCH[id].name))
      .join(', '),
  });

register('research', (c, { id }) => {
  const R = RESEARCH[id];
  if (!R || known(id) || running() || !knowsAll(R.req)) return;
  if (G.money < R.money) return toast('{name} braucht {m} Taler', { name: tr(R.name), m: R.money });
  G.money -= R.money;
  G.tools = { ...(G.tools || {}), _rq: { id, left: R.time * 60 } };
  sfx('done');
  toast('Forschung läuft: {name}', { name: tr(R.name) });
});

// every tick on the host / in a single game: research of all teams goes on
function updResearch() {
  const teams = G.teams ? G.teams.length : 1;
  for (let t = 0; t < teams; t++) {
    useTeam(t);
    const q = running();
    if (!q || --q.left > 0) continue;
    G.tools = { ...G.tools, ['r_' + q.id]: true, _rq: null };
    sfx('fanfare');
    announceBanner('Erforscht', RESEARCH[q.id].name, null, G.teams ? t : null);
  }
  useMine();
}

// the research part of the castle panel
function researchSection(p, { opt, sec, reopen }) {
  const l = sec(p, 'Forschung');
  const q = running();
  for (const id in RESEARCH) {
    const R = RESEARCH[id],
      done = known(id),
      now = q && q.id === id,
      open = knowsAll(R.req);
    const pct = now ? Math.floor(100 - (q.left / (R.time * 60)) * 100) : 0;
    // the state shows at a glance, the chip says why (docs/UI_STYLE.md)
    const state = done ? 'done' : now ? 'busy' : !open || q ? 'locked' : G.money < R.money ? 'poor' : 'ok';
    const why = !open
      ? needText(R.req)
      : q && !now && !done
        ? tr('Es läuft schon eine Forschung')
        : state === 'poor'
          ? tr('Fehlt: {list}', { list: tr('{n} Taler', { n: R.money - G.money }) })
          : '';
    opt(l, {
      icon: toolIcon(R.icon),
      title: tr(R.name),
      sub: tr(R.sub),
      cost: done ? tr('Erforscht') : now ? pct + ' %' : tr('{m} Taler · {s} s', { m: R.money, s: R.time }),
      state,
      why,
      pct,
      disabled: done || now,
      onClick: () => {
        // (the same reason as on the tile)
        if (!open) return toast(needText(R.req));
        if (q) return toast('Es läuft schon eine Forschung');
        send('research', { id });
        reopen();
      },
    });
  }
}

export { RESEARCH, knowsAll, needText, researchSection, updResearch };
