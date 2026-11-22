// The steps of the tutorial ("Der Glutstein"), played in the tutorial world (tutlevel.js).
// Six beats, each learned by doing it: walk and jump to the well, dig a shaft down, mine flint and
// ore, build a bridge over the abyss, run from a cave-in, and carry the Glutstein back up to
// light the village fire again. The next beat only starts once the last one has worked.
// A step has:
//   text     what to do: a string, { touch, keys } or a function giving one of them
//   target   where the pointer goes (world position; finger: true points right at the spot)
//   hl       CSS selector of a button to pulse – optional, may be a function
//   hand     gesture of the ghost hand on touch screens: right, down (on the stick) or tap (on
//            the pulsing button) – optional, may be a function
//   enter    runs when the step starts, leave when it is done; tick runs every frame while it is on
//   act      (c, s) → { label, fn } what the action button does here (digger.js context)
//   hint     (c, s) → { id, text } a hint that fits the situation right now
//   rescue   [{ after: seconds, id, text, run }] when the player is stuck for a while
//   praise   short line after it is done
//   done     (c, s) → true when the step is finished; s is the step's own state
import { celebrate } from './effects.js';
import { hurt, startBridge } from './digger.js';
import { spawnItem } from './entities.js';
import { goHome } from './climb.js';
import { sfx } from './sound.js';
import { G, INV_MAX, items } from './state.js';
import { DUSK, FLINT_CELLS, TUT, at, caveFloor, flintLeft, glutSpot, ground, hearthSpot, shaftSpot } from './tutlevel.js';
import { clearRocks, dropRock, flash, sparkle, updRocks } from './tutscene.js';
import { toast } from './ui.js';
import { AIR, GRANITE, PLANK, SAND, W, activate, bg, mat, paint, surf } from './world.js';

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
const has = (c, t) => c.inv.includes(t);
const mid = c => c.x + 3;
const feet = c => c.y + 10;
const below = c => feet(c) - surf[Math.max(0, Math.min(W - 1, Math.floor(mid(c))))];
const still = c => Math.abs(c.vx) < 0.05;
const inCave = c => mid(c) > TUT.cave.x0 && mid(c) < TUT.room.x1 && feet(c) > at(TUT.cave.top) + 4;
function give(c, t) {
  if (c.inv.length < INV_MAX) c.inv.push(t);
  else spawnItem(t, c.x + 2, c.y, 0, -1, 0);
}
function take(c, t) {
  const k = c.inv.indexOf(t);
  if (k < 0) return false;
  c.inv.splice(k, 1);
  if (c.isel >= c.inv.length) c.isel = Math.max(0, c.inv.length - 1);
  return true;
}
function setCell(x, y, m) {
  const i = y * W + x;
  mat[i] = m;
  bg[i] = 1;
  paint(i);
  activate(x, y);
}
const put = (c, x, y) => Object.assign(c, { x: x - 3, y: y - 10, vx: 0, vy: 0, climb: false, hangle: false, tumble: false });
// standing in front of the bump (either side) without getting on
const atBump = c => {
  const B = TUT.bump,
    x = mid(c);
  return ((x > B.x0 - 10 && x < B.x0) || (x > B.x1 && x < B.x1 + 10)) && below(c) < 3;
};
const atEdge = c => mid(c) > TUT.gap.x0 - 24 && mid(c) <= TUT.gap.x0 + 1 && Math.abs(feet(c) - caveFloor()) < 3;
const atHearth = c => Math.abs(mid(c) - TUT.hearth.x) < 14 && Math.abs(feet(c) - ground()) < 5;
// counts frames while a condition holds, back to 0 when it does not
const hold = (s, k, on) => (s[k] = on ? (s[k] || 0) + 1 : 0);
const JUMP_HINT = { id: 'jump', text: { touch: 'Spring drüber: Sprung', keys: 'Spring drüber: Leertaste' }, hl: '.pad.jump', hand: 'tap' };

// the old beams and the ore make a plank bridge, laid out straight over the abyss
function buildBridge(c, s) {
  if (!take(c, 'wood')) return;
  take(c, 'ore');
  c.inv.push('plank');
  c.isel = c.inv.length - 1;
  c.face = 1;
  startBridge(c, PLANK);
  // straight, and long enough to reach the far edge wherever at the edge you stand
  if (c.bridge) Object.assign(c.bridge, { dy: 0, len: Math.max(c.bridge.len, 2 * (TUT.gap.x1 + 4 - c.bridge.x0)) });
  s.built = true;
  sfx('hammer', c.x, c.y);
  toast('Balken + Erz = Brücke');
}
// the Glutstein goes into the hearth and the flint strikes the spark
function lightFire(c, s) {
  if (G.tut.run.glut !== 'carried') return;
  G.tut.run.glut = 'placed';
  take(c, 'flint');
  s.litT = 1;
  G.tutLit = G.frame || 1;
  sfx('boom');
  sfx('crackle');
  G.shake = Math.max(G.shake || 0, 3);
  flash(true);
  for (let k = 0; k < 3; k++) celebrate(TUT.hearth.x, ground() - 4, 30);
}
// is there something to walk on over the whole abyss (near the height of the cave floor)
function spans() {
  const f = caveFloor();
  for (let x = TUT.gap.x0; x < TUT.gap.x1; x++) {
    let on = false;
    for (let y = f - 3; y <= f + 2 && !on; y++) if (mat[y * W + x] !== AIR) on = true;
    if (!on) return false;
  }
  return true;
}
// a board over the shaft by the well, so the way home does not end in it again
function coverShaft() {
  const y = ground() + 1;
  for (let x = TUT.cave.x0; x < TUT.cave.x1; x++) if (mat[y * W + x] === AIR) setCell(x, y, PLANK);
}

const STEPS = [
  {
    id: 'walk',
    text: { touch: 'Lauf zum Brunnen', keys: 'Lauf zum Brunnen: → oder D' },
    target: () => ({ x: TUT.well.x, y: ground() - 15, finger: true }),
    hand: 'right',
    tick: (c, s) => hold(s, 'bumpT', atBump(c) && still(c)),
    // standing at the bump for a second: the jump
    hint: (c, s) => s.bumpT > 50 && JUMP_HINT,
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
        run: c => put(c, TUT.bump.x1 + 5, ground()),
        text: 'Hopp – rüber mit dir!',
      },
    ],
    praise: 'Der Brunnen! Unter ihm geht es hinab',
    done: c => mid(c) > TUT.well.x - 4 && below(c) < 3,
  },
  {
    id: 'dig',
    text: () =>
      G.autoDig
        ? { touch: 'Grab neben dem Brunnen nach unten: Stick nach unten', keys: 'Grab neben dem Brunnen nach unten: ↓ oder S' }
        : { touch: 'Grab neben dem Brunnen nach unten: Graben halten', keys: 'Grab neben dem Brunnen nach unten: Shift halten, ↓ lenkt' },
    target: () => ({ ...shaftSpot(), finger: true }),
    hl: () => (G.autoDig ? null : '.pad.big'),
    hand: () => (G.autoDig ? 'down' : 'tap'),
    tick: c => {
      // a little dust trickles from where the shaft should go
      if (G.frame % 50 === 0 && below(c) < 3) sparkle(TUT.shaft.x, ground(), '#c9a27a');
    },
    // digging down too far to the left: the cave is under the well
    hint: c =>
      below(c) > 6 &&
      mid(c) < TUT.cave.x0 && { id: 'wrong', text: 'Die Höhle liegt unter dem Brunnen – weiter rechts' },
    rescue: [
      {
        after: 15,
        id: 'dig',
        text: { touch: 'Stell dich auf den Finger und drück den Stick nach unten', keys: 'Stell dich auf den Finger und drück ↓' },
      },
      {
        after: 40,
        id: 'drop',
        run: c => {
          // the shaft opens by itself, and down you go
          for (let y = ground() + 1; y < at(TUT.cave.top); y++)
            for (let x = TUT.shaft.x - 4; x < TUT.shaft.x + 4; x++) setCell(x, y, AIR);
          put(c, TUT.shaft.x, caveFloor());
        },
        text: 'Hinab mit dir!',
      },
    ],
    praise: 'Eine Höhle! Hier liegen Feuerstein und Erz',
    done: c => inCave(c),
  },
  {
    id: 'mine',
    enter: (c, s) => {
      // the pick comes with this step: rock can be mined now
      G.tools = { ...(G.tools || {}), pick: true };
      G.tut.run.show.inv = true;
      s.drops = 0;
    },
    text: c => {
      const flint = !has(c, 'flint');
      if (G.autoDig) return flint ? 'Hack Feuerstein aus der grauen Felswand: lauf dagegen' : 'Jetzt das Erz: lauf gegen die rostrote Wand';
      return flint
        ? { touch: 'Hack Feuerstein aus der grauen Felswand: Graben halten', keys: 'Hack Feuerstein aus der grauen Felswand: Shift halten' }
        : { touch: 'Jetzt das Erz aus der rostroten Wand: Graben halten', keys: 'Jetzt das Erz aus der rostroten Wand: Shift halten' };
    },
    target: c => {
      const loose = nearest(c, lying('flint').concat(lying('ore')));
      if (loose && Math.abs(loose.x - c.x) < 40) return { x: loose.x + 1, y: loose.y, finger: true };
      const W0 = !has(c, 'flint') ? TUT.flint : TUT.ore;
      return { x: W0.x0, y: caveFloor() - 8, finger: true };
    },
    hl: () => (G.autoDig ? null : '.pad.big'),
    hand: () => (G.autoDig ? 'right' : 'tap'),
    tick: (c, s) => {
      // the flint wall is rock: what comes off it is flint (one piece for every bit of wall)
      if (G.frame % 6 === 0) {
        const want = Math.floor((FLINT_CELLS - flintLeft()) / 20);
        while (s.drops < want) {
          s.drops++;
          spawnItem('flint', mid(c) + c.face * 5, c.y + 3, -c.face * 0.6, -1.2, 20);
          sfx('ting', c.x, c.y);
        }
      }
      // through a wall without anything to show for it: here is one
      if (mid(c) > TUT.flint.x1 + 3 && !has(c, 'flint') && !lying('flint').length) give(c, 'flint');
      if (mid(c) > TUT.ore.x1 + 3 && !has(c, 'ore') && !lying('ore').length) give(c, 'ore');
    },
    hint: c => {
      const loose = nearest(c, lying('flint').concat(lying('ore')));
      return loose && Math.abs(loose.x - c.x) < 30 && { id: 'pickup', text: 'Heb es auf: lauf drüber' };
    },
    rescue: [
      {
        after: 45,
        id: 'mine',
        text: () => (G.autoDig ? 'Lauf einfach gegen die Wand – der Wühler hackt von selbst' : 'Halte Graben gedrückt und lauf dabei gegen die Wand'),
      },
      {
        after: 90,
        id: 'gift',
        run: c => {
          if (!has(c, 'flint')) give(c, 'flint');
          if (!has(c, 'ore')) give(c, 'ore');
        },
        text: 'Hier, ein Stück Feuerstein und Erz',
      },
    ],
    praise: 'Feuerstein und Erz! Damit lässt sich bauen',
    done: c => has(c, 'flint') && has(c, 'ore'),
  },
  {
    id: 'bridge',
    enter: c => {
      // the beams are still there (else two new ones), and the ore too
      if (!has(c, 'wood') && !lying('wood').length) for (const x of TUT.beams) spawnItem('wood', x, caveFloor() - 3, 0, 0, 0);
      if (!has(c, 'ore')) give(c, 'ore');
    },
    text: (c, s) =>
      s.built
        ? 'Lauf über die Brücke'
        : !has(c, 'wood')
          ? 'Nimm einen alten Balken an der Kante'
          : atEdge(c)
            ? { touch: 'Balken + Erz: tippe auf Brücke', keys: 'Balken + Erz: drück F für die Brücke' }
            : 'Stell dich an die Kante des Abgrunds',
    target: (c, s) => {
      if (s.built) return { x: TUT.gap.x1 + 8, y: caveFloor() - 4 };
      const beam = !has(c, 'wood') && nearest(c, lying('wood'));
      if (beam) return { x: beam.x + 3, y: beam.y, finger: true };
      return { x: TUT.gap.x0 - 6, y: caveFloor() - 1, finger: true };
    },
    hl: (c, s) => (!s.built && has(c, 'wood') && atEdge(c) ? '.pad.act' : null),
    hand: (c, s) => (!s.built && has(c, 'wood') && atEdge(c) ? 'tap' : 'right'),
    act: (c, s) => (!s.built && !c.bridge && has(c, 'wood') && atEdge(c) ? { label: 'Brücke', fn: () => buildBridge(c, s) } : null),
    tick: (c, s) => {
      if (has(c, 'wood')) G.tut.run.show.act = true;
      // the bridge stopped half way (a jump, a turn): the beam and the ore come back for a new try
      if (s.built && !c.bridge && !spans()) {
        s.built = false;
        if (!has(c, 'wood')) give(c, 'wood');
        if (!has(c, 'ore')) give(c, 'ore');
      }
      // down in the abyss: back to the edge after a moment
      hold(s, 'fallT', mid(c) > TUT.gap.x0 && mid(c) < TUT.gap.x1 && feet(c) > caveFloor() + 8);
      if (s.fallT > 45) {
        put(c, TUT.gap.x0 - 10, caveFloor());
        toast('Zurück an die Kante – erst die Brücke bauen');
        s.fallT = 0;
      }
    },
    rescue: [
      {
        after: 50,
        id: 'build',
        when: (c, s) => !s.built,
        run: c => {
          if (!has(c, 'wood')) give(c, 'wood');
          if (!has(c, 'ore')) give(c, 'ore');
        },
        text: { touch: 'An der Kante wird Aktion zu „Brücke“', keys: 'An der Kante baut F die Brücke' },
        hl: '.pad.act',
      },
      {
        after: 90,
        id: 'auto',
        when: (c, s) => !s.built && !c.bridge,
        run: (c, s) => {
          put(c, TUT.gap.x0 - 8, caveFloor());
          if (!has(c, 'wood')) give(c, 'wood');
          buildBridge(c, s);
        },
        text: 'Ich helf dir – die Brücke wächst',
      },
    ],
    praise: 'Die Brücke hält!',
    done: c => mid(c) > TUT.gap.x1 + 4 && Math.abs(feet(c) - caveFloor()) < 4,
  },
  {
    id: 'danger',
    text: (c, s) => (s.started ? 'Einsturz! Lauf weiter und weich den Steinen aus' : 'Weiter durch den Stollen'),
    target: () => ({ x: TUT.room.x0 + 10, y: caveFloor() - 2 }),
    hand: 'right',
    tick: (c, s) => {
      const H0 = TUT.hall;
      if (!s.started && mid(c) > H0.x0 + 14) {
        s.started = s.t;
        G.shake = Math.max(G.shake || 0, 4.5);
        sfx('boom');
        sfx('thunder');
        // the first stones, right in front: you see what is coming
        dropRock(mid(c) + 18, 26);
        dropRock(mid(c) + 34, 34);
      }
      if (!s.started) return;
      // stones keep coming down around you and ahead of you
      if ((s.t - s.started) % 17 === 0 && mid(c) < H0.x1 - 8) {
        const ahead = Math.min(H0.x1 - 4, mid(c) + 10 + Math.random() * 40);
        dropRock(Math.random() < 0.35 ? mid(c) + c.vx * 22 : ahead);
      }
      if ((s.t - s.started) % 40 === 0) G.shake = Math.max(G.shake || 0, 1.5);
      const hit = updRocks(c);
      if (hit) {
        hurt(c, 6);
        c.vx = 1.6;
        c.vy = -1;
        G.shake = Math.max(G.shake || 0, 3);
        s.hits = (s.hits || 0) + 1;
      }
      // behind you the ceiling comes down for real: sand fills the corridor
      s.fill ||= H0.x0 + 4;
      for (let n = 0; n < 2 && s.fill < mid(c) - 24 && s.fill < H0.x1 - 30; n++, s.fill++)
        for (let y = at(TUT.cave.top); y < at(TUT.cave.top) + 7; y++) if (mat[y * W + s.fill] === AIR) setCell(s.fill, y, SAND);
      hold(s, 'stillT', still(c));
    },
    hint: (c, s) => s.started && s.stillT > 45 && { id: 'run', text: 'Nicht stehen bleiben – lauf!' },
    rescue: [
      {
        after: 40,
        id: 'push',
        run: c => put(c, TUT.room.x0 + 8, at(TUT.room.floor)),
        text: 'Puh – geschafft!',
      },
    ],
    leave: (c, s) => {
      clearRocks();
      // the corridor behind is gone for good: a plug of fallen rock under the sand
      for (let x = TUT.hall.x0 + 26; x < TUT.hall.x0 + 40; x++)
        for (let y = at(TUT.cave.top); y < caveFloor(); y++) if (mat[y * W + x] === AIR || mat[y * W + x] === SAND) setCell(x, y, y < at(TUT.cave.top) + 5 ? SAND : GRANITE);
      G.shake = Math.max(G.shake || 0, 3);
      sfx('thud');
      s.praise = s.hits ? 'Puh! Das war knapp' : 'Ausgewichen wie ein Profi!';
    },
    praise: (c, s) => s.praise,
    done: c => mid(c) > TUT.room.x0 + 4,
  },
  {
    id: 'glut',
    enter: () => {
      G.tut.run.glut ||= 'room';
    },
    text: (c, s) => {
      const g = G.tut.run.glut;
      if (g === 'placed') return 'Das Herdfeuer brennt wieder!';
      if (g !== 'carried') return 'Da liegt der Glutstein! Nimm ihn';
      if (atHearth(c)) return { touch: 'Entfache das Feuer: tippe auf Entfachen', keys: 'Entfache das Feuer: drück F' };
      return mid(c) < TUT.room.x0 && feet(c) > ground() + 4
        ? 'Der Weg zurück ist verschüttet – nimm den Tunnel nach oben'
        : 'Trag den Glutstein hoch ins Dorf zum Herdfeuer';
    },
    target: () => {
      const g = G.tut.run.glut;
      if (g === 'placed') return null;
      if (g !== 'carried') return { ...glutSpot(), finger: true };
      const h = hearthSpot();
      return { x: h.x, y: h.y - 6, finger: true };
    },
    hl: c => (G.tut.run.glut === 'carried' && atHearth(c) ? '.pad.act' : null),
    hand: c => (G.tut.run.glut === 'carried' && atHearth(c) ? 'tap' : null),
    act: (c, s) => (G.tut.run.glut === 'carried' && atHearth(c) ? { label: 'Entfachen', fn: () => lightFire(c, s) } : null),
    tick: (c, s) => {
      const run = G.tut.run;
      // picked up by walking into it
      if (run.glut === 'room') {
        const g = glutSpot();
        if (Math.abs(mid(c) - g.x) < 6 && Math.abs(feet(c) - (g.y + 1)) < 6) {
          run.glut = 'carried';
          sfx('fanfare');
          celebrate(g.x, g.y, 40);
          flash();
          G.shake = Math.max(G.shake || 0, 2);
          coverShaft();
        }
      }
      if (run.glut === 'carried' && atHearth(c)) run.show.act = true;
      // the fire is lit: the day comes back over the village
      if (s.litT) {
        s.litT++;
        G.dayT = DUSK - Math.min(1, s.litT / 150) * (DUSK - 0.27);
      }
    },
    rescue: [
      {
        after: 100,
        id: 'home',
        when: () => G.tut.run.glut === 'carried',
        run: c => goHome(c),
        text: 'Ab nach Hause zum Herdfeuer!',
      },
    ],
    done: (c, s) => s.litT > 170,
  },
];

export { STEPS };
