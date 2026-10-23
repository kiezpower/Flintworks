// Tool upgrades bought at the home base: they tie the production chain (metal, coal) to digging.
import { costTxt, hasRes, payRes } from './buildings.js';
import { tr } from './i18n.js';
import { sfx } from './sound.js';
import { toolIcon } from './sprites.js';
import { G } from './state.js';

const TOOLS = {
  pick: {
    name: 'Stahlhacke',
    icon: 'dig',
    sub: 'Gräbt schneller und kommt auch durch Fels',
    money: 60,
    need: { metal: 2 },
  },
  lamp: {
    name: 'Grubenlampe',
    icon: 'lamp',
    sub: 'Helleres Licht, zeigt Grubengas in der Nähe',
    money: 40,
    need: { metal: 1, coal: 1 },
  },
};
const hasTool = id => !!(G.tools && G.tools[id]);

// adds the tool section to the base panel; opt/sec/toast come from ui.js to avoid a cycle at load
function toolSection(p, c, { opt, sec, toast, reopen }) {
  const open = Object.keys(TOOLS).filter(id => !hasTool(id));
  if (!open.length) return;
  const l = sec(p, 'Werkzeug');
  for (const id of open) {
    const T = TOOLS[id];
    const ok = G.money >= T.money && hasRes(c, T.need);
    opt(l, {
      icon: toolIcon(T.icon),
      title: tr(T.name),
      sub: tr(T.sub),
      cost: tr('{m} Taler + {cost}', { m: T.money, cost: costTxt(T.need) }),
      short: !ok,
      onClick: () => {
        if (!ok) {
          toast('{name} braucht {m} Taler + {cost}', { name: tr(T.name), m: T.money, cost: costTxt(T.need) });
          return;
        }
        G.money -= T.money;
        payRes(c, T.need);
        G.tools = { ...(G.tools || {}), [id]: true };
        sfx('done');
        toast('{name} gekauft', { name: tr(T.name) });
        reopen();
      },
    });
  }
}

export { TOOLS, hasTool, toolSection };
