// The steps of the tutorial ("Die erste Schicht"), played in the tutorial world (tutlevel.js).
// A step has:
//   text     what to do: a string, { touch, keys } or a function giving one of them
//   target   where the yellow arrow points (world position) – optional
//   hl       CSS selector of a button to pulse – optional, may be a function
//   hand     gesture of the ghost hand on touch screens: right, down (on the stick) or tap (on
//            the pulsing button) – optional, may be a function
//   enter    runs when the step starts, leave when it is done; tick runs every frame while it is on
//   rescue   [{ after: seconds, text, run }] when the player is stuck for a while
//   praise   short line after it is done
//   done     (c, s) → true when the step is finished; s is the step's own state
import { BT, countRes } from './buildings.js';
import { addClonk, spawnItem } from './entities.js';
import { isPlayer } from './players.js';
import { G, INV_MAX, builds, crew, items, trees } from './state.js';
import { TUT, goldSpot, ground, rockOpen, rockTop, tidyRock } from './tutlevel.js';
import { mapView, panelEl, toast } from './ui.js';
import { GOLD, H, W, mat, surf } from './world.js';

const keys = () => G.inputKind === 'keys';
const nearest = (c, list) => {
  let best = null,
    bd = Infinity;
  for (const p of list) {
    const d = Math.hypot(p.x - c.x, (p.y ?? p.gy) - c.y); // trees only have their ground line
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
};
const carried = (c, t) => c.inv.filter(x => x === t).length;
const lying = t => items.filter(i => i.t === t);
const standing = () => trees.filter(t => !t.fall && t.x < TUT.end);
const treeTop = t => t && { x: t.x, y: t.gy - t.spr.height };
const castle = () => ({ x: G.base.x + G.base.w / 2, y: G.base.gy - G.base.h });
const hut = () => builds.find(b => b.type === 'hut');
const helper = () => crew.find(o => !isPlayer(o) && !o.dead);
const depth = c => c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))];
function give(c, t) {
  if (c.inv.length < INV_MAX) c.inv.push(t);
  else spawnItem(t, c.x + 2, c.y, 0, -1, 0);
}
function hold(c, t) {
  const k = c.inv.indexOf(t);
  if (k >= 0) c.isel = k;
}

// closest gold pixel within reach, looked up only every half second
let goldCache = null,
  goldT = -99;
function nearestGold(c) {
  if (Math.abs(G.frame - goldT) < 30) return goldCache;
  goldT = G.frame;
  goldCache = null;
  let bd = Infinity;
  for (let y = Math.max(0, Math.floor(c.y) - 60); y < Math.min(H, c.y + 90); y += 2)
    for (let x = Math.max(0, Math.floor(c.x) - 160); x < Math.min(W, c.x + 160); x += 2) {
      if (mat[y * W + x] !== GOLD) continue;
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < bd) {
        bd = d;
        goldCache = { x, y };
      }
    }
  return goldCache;
}

const STEPS = [
  {
    id: 'walk',
    text: { touch: 'Lauf nach rechts zu den Bäumen', keys: 'Lauf nach rechts zu den Bäumen: Pfeil → oder D' },
    target: () => treeTop(standing()[0]),
    hand: 'right',
    rescue: [
      {
        after: 20,
        text: {
          touch: 'Daumen links auf den Bildschirm legen und nach rechts schieben',
          keys: 'Halte Pfeil → oder D gedrückt',
        },
      },
    ],
    done: c => c.x + 3 > TUT.trees[0] - 14,
  },
  {
    id: 'chop',
    text: { touch: 'Stell dich an den Baum und tippe auf Aktion', keys: 'Stell dich an den Baum und drück F' },
    target: c => treeTop(nearest(c, standing())),
    // only once the button says Fällen: before that it would open the build menu
    hl: c => (standing().some(t => Math.abs(c.x + 3 - t.x) < 8) ? '.pad.act' : null),
    hand: 'tap',
    rescue: [
      { after: 25, text: { touch: 'Ganz nah an den Stamm, dann Aktion', keys: 'Ganz nah an den Stamm, dann F' } },
    ],
    praise: 'Gut gemacht! Holz brauchst du zum Bauen',
    done: () => standing().length < TUT.trees.length || lying('wood').length > 0,
  },
  {
    id: 'wood',
    text: 'Lauf über das Holz und heb 2 Stück auf',
    target: c => nearest(c, lying('wood')),
    rescue: [
      {
        after: 30,
        run: c => {
          for (let n = carried(c, 'wood') + lying('wood').length; n < 2; n++) give(c, 'wood');
        },
      },
    ],
    praise: 'Was du trägst, siehst du oben rechts',
    done: c => carried(c, 'wood') >= 2,
  },
  {
    id: 'blast',
    text: {
      touch: 'Ein Felsen! Lauf hin und wirf den Feuerstein: Wurf',
      keys: 'Ein Felsen! Lauf hin und wirf den Feuerstein: E',
    },
    enter: c => hold(c, 'flint'),
    // there is always a flint in the hand: a missed one comes back
    tick: c => {
      if (G.frame % 60) return;
      if (!c.inv.includes('flint') && !lying('flint').length) {
        give(c, 'flint');
        toast('Hier ist noch ein Feuerstein');
      }
      if (c.inv[c.isel] !== 'flint') hold(c, 'flint');
    },
    target: () => rockTop(),
    hl: '.pad.throw',
    hand: 'tap',
    rescue: [{ after: 30, text: 'Lauf bis kurz vor den Felsen, dann werfen' }],
    praise: 'Bumm! Feuersteine sprengen Fels',
    done: c => rockOpen() || c.x > TUT.rock.x1 + 2,
    leave: () => tidyRock(),
  },
  {
    id: 'dig',
    tick: () => G.frame % 20 || tidyRock(),
    text: () =>
      keys()
        ? G.autoDig
          ? 'Grab dich zum Gold: Pfeil ↓, schräg mit ↓ und →'
          : 'Grab dich zum Gold: Shift halten, Pfeile lenken'
        : G.autoDig
          ? 'Grab dich zum Gold: Stick nach unten oder schräg drücken'
          : 'Grab dich zum Gold: Graben halten, der Stick lenkt',
    target: () => goldSpot(),
    hl: () => (G.autoDig ? null : '.pad.big'),
    hand: () => (G.autoDig ? 'down' : 'tap'),
    rescue: [
      {
        after: 30,
        text: {
          touch: 'Stell dich über das Gold und drück den Stick nach unten',
          keys: 'Stell dich über das Gold und drück ↓',
        },
      },
    ],
    praise: 'So gräbst du dich durch die Erde',
    done: (c, s) => (s.dig += c.digging ? 1 : 0) > 30 && depth(c) > 4,
  },
  {
    id: 'gold',
    text: 'Grab das Gold aus – Klumpen hebst du von selbst auf',
    target: c => nearest(c, lying('nug')) || nearestGold(c),
    rescue: [
      {
        after: 45,
        run: c => {
          if (!c.inv.includes('nug') && !lying('nug').length) give(c, 'nug');
        },
      },
    ],
    praise: 'Gold! Das ist bares Geld wert',
    done: c => c.inv.includes('nug'),
  },
  {
    id: 'sell',
    text: 'Bring das Gold zur Burg – dort wird es verkauft',
    target: castle,
    rescue: [{ after: 50, text: 'Steckst du fest? Menü → Zurück zur Basis' }],
    praise: 'Verkauft! In der Burg kannst du auch einkaufen',
    done: (c, s) => G.money > s.money0,
  },
  {
    id: 'hut',
    // whatever went missing on the way is topped up: the lesson is the build menu
    enter: c => {
      for (const t in BT.hut.cost) for (let n = countRes(c, t); n < BT.hut.cost[t]; n++) give(c, t);
    },
    text: () =>
      hut()
        ? 'Bleib in der Baustelle, bis die Hütte steht'
        : !panelEl.hidden
          ? 'Wähle die Hütte'
          : { touch: 'Stell dich neben die Burg und tippe auf Bauen', keys: 'Stell dich neben die Burg und drück B' },
    target: () => {
      const b = hut();
      return b ? { x: b.x + b.w / 2, y: b.gy - b.h } : { x: TUT.plot, y: ground() - 2 };
    },
    hl: () => (hut() ? null : panelEl.hidden ? '#buildBtn' : '[data-tut=b_hut]'),
    hand: 'tap',
    rescue: [{ after: 60, text: 'Neben der Burg ist ein ebener Bauplatz – dort Bauen → Hütte' }],
    praise: 'Fertig! In der Hütte erholt sich deine Crew',
    done: () => hut()?.done,
  },
  {
    id: 'crew',
    enter: () => {
      if (!helper()) addClonk(G.base.x + 15, G.base.gy - 10);
      G.crewKey = '';
      toast('Ein Helfer ist da!');
    },
    text: () =>
      !panelEl.hidden
        ? 'Wähle eine Aufgabe, zum Beispiel Holz'
        : {
            touch: 'Tippe oben links auf deinen Helfer und gib ihm eine Aufgabe',
            keys: 'Klick oben links auf deinen Helfer und gib ihm eine Aufgabe',
          },
    target: () => {
      const h = helper();
      return h && { x: h.x + 3, y: h.y - 2 };
    },
    hl: () => (panelEl.hidden ? '#crew .cbtn:not(.sel)' : '[data-tut=f_wood]'),
    hand: 'tap',
    praise: 'Helfer arbeiten von selbst – mit einer Aufgabe gezielter',
    done: () => crew.some(o => !isPlayer(o) && (o.focus || 'all') !== 'all'),
  },
  {
    id: 'map',
    // open the map, have a look, close it again
    tick: (c, s) => (s.seen ||= !mapView.hidden),
    text: (c, s) =>
      s.seen
        ? {
            touch: 'Das ist die ganze Welt. Tippe sie an zum Schließen',
            keys: 'Das ist die ganze Welt. M schließt sie',
          }
        : { touch: 'Tippe oben rechts auf die kleine Karte', keys: 'Drück M oder klick oben rechts auf die Karte' },
    hl: (c, s) => (s.seen ? null : '#miniThumb'),
    hand: 'tap',
    done: (c, s) => s.seen && mapView.hidden,
  },
];

export { STEPS };
