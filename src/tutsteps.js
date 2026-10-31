// The steps of the tutorial ("Die erste Schicht"), played in the tutorial world (tutlevel.js).
// Three beats that make the core loop once: walk (and jump the bump), dig to the gold, sell it.
// A step has:
//   text     what to do: a string, { touch, keys } or a function giving one of them
//   target   where the yellow arrow points (world position) – optional
//   hl       CSS selector of a button to pulse – optional, may be a function
//   hand     gesture of the ghost hand on touch screens: right, down (on the stick) or tap (on
//            the pulsing button) – optional, may be a function
//   enter    runs when the step starts, leave when it is done; tick runs every frame while it is on
//   hint     (c, s) → { id, text } a hint that fits the situation right now (stuck at the bump,
//            in the pit) – shown instead of the text after a moment
//   rescue   [{ after: seconds, id, text, run }] when the player is stuck for a while
//   praise   short line after it is done
//   done     (c, s) → true when the step is finished; s is the step's own state
import { spawnItem } from './entities.js';
import { goHome } from './climb.js';
import { G, INV_MAX, items } from './state.js';
import { TUT, bumpTop, goldSpot, ground, sparkle } from './tutlevel.js';
import { W, surf } from './world.js';

const nearest = (c, list) => {
  let best = null,
    bd = Infinity;
  for (const p of list) {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
};
const lying = t => items.filter(i => i.t === t);
const castle = () => ({ x: G.base.x + G.base.w / 2, y: G.base.gy - G.base.h });
const feet = c => c.y + 10;
const below = c => feet(c) - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))];
const still = c => Math.abs(c.vx) < 0.05;
function give(c, t) {
  if (c.inv.length < INV_MAX) c.inv.push(t);
  else spawnItem(t, c.x + 2, c.y, 0, -1, 0);
}
// standing in front of the bump (left of it, or right of it on the way back) without getting on
const atBump = c => {
  const B = TUT.bump,
    x = c.x + 3;
  return ((x > B.x0 - 10 && x < B.x0) || (x > B.x1 && x < B.x1 + 10)) && below(c) < 3;
};
// counts frames while a condition holds, back to 0 when it does not
const hold = (s, k, on) => (s[k] = on ? (s[k] || 0) + 1 : 0);

const STEPS = [
  {
    id: 'walk',
    text: { touch: 'Lauf nach rechts', keys: 'Lauf nach rechts: → oder D' },
    target: () => ({ x: goldSpot().x, y: ground() - 2 }),
    hand: 'right',
    tick: (c, s) => {
      sparkle();
      hold(s, 'bumpT', atBump(c) && still(c));
    },
    // standing at the bump for a second: the jump
    hint: (c, s) =>
      s.bumpT > 50 && {
        id: 'jump',
        text: { touch: 'Spring drüber: Sprung', keys: 'Spring drüber: Leertaste' },
        hl: '.pad.jump',
        hand: 'tap',
      },
    rescue: [
      {
        after: 8,
        id: 'walk',
        when: (c, s) => Math.abs(c.x - s.x0) < 8,
        text: { touch: 'Daumen links aufs Bild legen und nach rechts schieben', keys: 'Halte → oder D gedrückt' },
      },
      {
        // a long time in front of the bump: a hand over it
        after: 30,
        id: 'lift',
        when: c => atBump(c),
        run: c => {
          c.x = TUT.bump.x1 + 2;
          c.y = ground() - 11;
          c.vx = c.vy = 0;
        },
        text: 'Hopp – rüber mit dir!',
      },
    ],
    done: c => c.x + 3 > TUT.bump.x1 + 3,
  },
  {
    id: 'dig',
    text: () =>
      G.autoDig
        ? { touch: 'Grab dich zum Gold: Stick nach unten', keys: 'Grab dich zum Gold: ↓ oder S' }
        : { touch: 'Grab dich zum Gold: Graben halten', keys: 'Grab dich zum Gold: Shift halten, ↓ lenkt' },
    tick: c => sparkle(),
    target: c => nearest(c, lying('nug')) || goldSpot(),
    hl: () => (G.autoDig ? null : '.pad.big'),
    hand: () => (G.autoDig ? 'down' : 'tap'),
    // a nugget came loose: walk over it
    hint: () => lying('nug').length > 0 && { id: 'pickup', text: 'Lauf über den Klumpen', now: true },
    rescue: [
      {
        after: 12,
        id: 'dig',
        text: {
          touch: 'Stell dich aufs Glitzern und drück den Stick nach unten',
          keys: 'Stell dich aufs Glitzern und drück ↓',
        },
      },
      {
        after: 30,
        id: 'gift',
        run: c => {
          if (!c.inv.includes('nug') && !lying('nug').length) give(c, 'nug');
        },
        text: 'Hier, ein Klumpen für dich',
      },
    ],
    praise: 'Gold! Bring es nach Hause',
    done: c => c.inv.includes('nug'),
  },
  {
    id: 'sell',
    text: 'Bring das Gold zur Burg',
    target: castle,
    tick: (c, s) => {
      // the money counter turns up as the castle comes near, so the coins have somewhere to fly
      if (Math.abs(c.x + 3 - castle().x) < 70) s.near = true;
      hold(s, 'pitT', below(c) > 4 && still(c));
      hold(s, 'deepT', below(c) > 4); // (down in the pit, still or digging)
      hold(s, 'bumpT', atBump(c) && still(c));
    },
    hint: (c, s) =>
      (s.pitT > 120 && {
        id: 'pit',
        text: G.autoDig
          ? { touch: 'Raus aus der Grube: gegen die Wand laufen', keys: 'Raus aus der Grube: gegen die Wand laufen' }
          : {
              touch: 'Raus aus der Grube: an der Wand hochklettern',
              keys: 'Raus aus der Grube: an der Wand hochklettern',
            },
      }) ||
      (s.bumpT > 50 && {
        id: 'jump',
        text: { touch: 'Spring drüber: Sprung', keys: 'Spring drüber: Leertaste' },
        hl: '.pad.jump',
        hand: 'tap',
      }),
    rescue: [
      {
        // still deep down: the action button (Heim, Treppe …) gets you out
        after: 20,
        id: 'action',
        when: c => below(c) > 4,
        show: 'act',
        text: { touch: 'Steckst du fest? Tippe auf Aktion', keys: 'Steckst du fest? Drück F' },
        hl: '.pad.act',
      },
      {
        after: 40,
        id: 'home',
        run: c => goHome(c),
        text: 'Ab nach Hause!',
      },
    ],
    done: (c, s) => G.money > s.money0,
  },
];

export { STEPS, bumpTop };
