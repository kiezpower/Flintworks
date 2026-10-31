// Tools and equipment bought at the home base: they tie the production chain (metal, coal) to
// digging and fighting. Bought once per team; some need research first (res).
import { costTxt, hasRes, payRes } from './buildings.js';
import { register, send } from './commands.js';
import { tr } from './i18n.js';
import { knowsAll, needText } from './research.js';
import { sfx } from './sound.js';
import { toolIcon } from './sprites.js';
import { G } from './state.js';
import { toast as toastMsg } from './ui.js';

const TOOLS = {
  pick: {
    name: 'Stahlhacke',
    icon: 'dig',
    sub: 'Gräbt schneller und kommt auch durch Fels',
    money: 60,
    need: { metal: 2 },
    res: ['metal'],
  },
  lamp: {
    name: 'Grubenlampe',
    icon: 'lamp',
    sub: 'Helleres Licht, zeigt Grubengas in der Nähe',
    money: 40,
    need: { metal: 1, coal: 1 },
  },
  // gets you out of pits and onto ledges (climb.js): cheap and early, no research
  hook: {
    name: 'Enterhaken',
    icon: 'hook',
    sub: 'Eigener Knopf (G): wirf den Haken, wohin du zielst – er zieht dich hin',
    money: 30,
    need: { wood: 2, rock: 1 },
  },
  sword: {
    name: 'Schwert',
    icon: 'sword',
    sub: 'Aktion schlägt zu – und alle Wühler wehren sich gegen Monster',
    money: 50,
    need: { metal: 2, wood: 1 },
    res: ['metal'],
    gear: true,
  },
  bow: {
    name: 'Langbogen',
    icon: 'bow',
    sub: 'Wurf mit leerer Hand schießt Pfeile aus dem Köcher und zielt von selbst auf Monster',
    money: 40,
    need: { wood: 3, plank: 1 },
    res: ['archery'],
    gear: true,
  },
  shield: {
    name: 'Schild',
    icon: 'shield',
    sub: 'Halbiert, was Monster anrichten',
    money: 60,
    need: { metal: 2, plank: 2 },
    res: ['armor'],
    gear: true,
  },
  helm: {
    name: 'Eisenhelm',
    icon: 'helm',
    sub: 'Halbiert Schaden durch Steine, Geröll und Blitze',
    money: 60,
    need: { metal: 3 },
    res: ['armor'],
    gear: true,
  },
};
// arrows are made at the castle and kept in the store
const ARROWS = {
  arrow: { name: '5 Pfeile', n: 5, need: { wood: 1, rock: 1 } },
  farrow: { name: '3 Brandpfeile', n: 3, need: { wood: 1, coal: 1 } },
};
const hasTool = id => !!(G.tools && G.tools[id]);
// arrows in the quiver (kept with the tools: per team, saved and sent along)
const arrowsOf = id => (G.tools && G.tools['q_' + id]) || 0;
function addArrows(id, n) {
  G.tools = { ...(G.tools || {}), ['q_' + id]: Math.max(0, arrowsOf(id) + n) };
}
// a tool of any team (Versus: the current team's values live in G, the others in G.teams)
function teamHas(team, id) {
  if (!G.teams || (team || 0) === G.curTeam) return hasTool(id);
  const t = G.teams[team || 0];
  return !!(t && t.tools && t.tools[id]);
}

// adds the tool and equipment sections to the base panel; opt/sec/toast come from ui.js
function toolSection(p, c, { opt, sec, toast, reopen }) {
  for (const gear of [false, true]) {
    const open = Object.keys(TOOLS).filter(id => !hasTool(id) && !!TOOLS[id].gear === gear);
    const l = sec(p, gear ? 'Ausrüstung' : 'Werkzeug');
    for (const id of open) {
      const T = TOOLS[id],
        known = knowsAll(T.res);
      const ok = known && G.money >= T.money && hasRes(c, T.need);
      opt(l, {
        icon: toolIcon(T.icon),
        title: tr(T.name),
        sub: known ? tr(T.sub) : needText(T.res),
        cost: tr('{m} Taler + {cost}', { m: T.money, cost: costTxt(T.need) }),
        short: !ok,
        onClick: () => {
          if (!known) return toast(needText(T.res));
          if (!ok)
            return toast('{name} braucht {m} Taler + {cost}', { name: tr(T.name), m: T.money, cost: costTxt(T.need) });
          send('tool', { id });
          reopen();
        },
      });
    }
    if (gear && hasTool('bow'))
      for (const id in ARROWS) {
        const A = ARROWS[id];
        opt(l, {
          icon: toolIcon(id),
          title: tr(A.name),
          sub: tr('Im Köcher: {n}', { n: arrowsOf(id) }),
          cost: costTxt(A.need),
          short: !hasRes(c, A.need),
          onClick: () => {
            if (!hasRes(c, A.need)) return toast('{name} braucht {cost}', { name: tr(A.name), cost: costTxt(A.need) });
            send('arrows', { id });
            reopen();
          },
        });
      }
    if (!l.children.length) {
      l.previousSibling.remove();
      l.remove();
    }
  }
}

// buying a tool (run for the player who sent it)
register('tool', (c, { id }) => {
  const T = TOOLS[id];
  if (!T || hasTool(id) || !knowsAll(T.res) || G.money < T.money || !hasRes(c, T.need)) return;
  G.money -= T.money;
  payRes(c, T.need);
  G.tools = { ...(G.tools || {}), [id]: true };
  sfx('done');
  toastMsg('{name} gekauft', { name: tr(T.name) });
});
register('arrows', (c, { id }) => {
  const A = ARROWS[id];
  if (!A || !hasTool('bow') || !hasRes(c, A.need)) return;
  payRes(c, A.need);
  addArrows(id, A.n);
  sfx('hammer', c.x, c.y);
});

export { TOOLS, addArrows, arrowsOf, hasTool, teamHas, toolSection };
