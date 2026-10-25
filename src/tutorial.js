import { P, saveProfile, track } from './profile.js';
// Guided first game: short tasks with a pointer to the next goal. The steps live in STEPS; each
// one has a text (per input: touch or keys), a goal in the world, a done test and rescues that
// kick in when the player is stuck for a while.
import { countRes } from './buildings.js';
import { sel_ } from './entities.js';
import { tr } from './i18n.js';
import { sfx } from './sound.js';
import { G, builds, items, trees } from './state.js';
import { toast } from './ui.js';
import { GOLD, H, W, mat } from './world.js';

const box = document.getElementById('quest');
const stepTxt = document.getElementById('questStep');
const goalTxt = document.getElementById('questText');
const skipBtn = document.getElementById('questSkip');

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

// closest gold pixel within reach, looked up only every half second
let goldCache = null,
  goldT = 0;
function nearestGold(c) {
  if (G.frame - goldT < 30) return goldCache;
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

const hut = () => builds.find(b => b.type === 'hut');
const inHand = (c, t) => c.inv.filter(x => x === t).length;
const STEPS = [
  {
    id: 'walk',
    text: { touch: 'Lauf ein Stück nach rechts: Stick nach rechts', keys: 'Lauf ein Stück nach rechts: Pfeil → oder D' },
    done: (c, s) => c.x > s.x0 + 30,
  },
  {
    id: 'dig',
    text: () =>
      G.inputKind === 'keys'
        ? G.autoDig
          ? 'Grab dich in die Erde: Pfeil ↓ oder S'
          : 'Grab dich in die Erde: Shift oder X halten'
        : G.autoDig
          ? 'Grab dich in die Erde: Stick nach unten drücken'
          : 'Grab dich in die Erde: Graben halten',
    done: (c, s) => (s.dig += c.digging ? 1 : 0) > 60,
  },
  {
    id: 'wood',
    text: { touch: 'Fälle einen Baum mit Aktion und heb 2 Holz auf', keys: 'Fälle einen Baum mit F und heb 2 Holz auf' },
    target: c => {
      const wood = items.filter(i => i.t === 'wood');
      if (wood.length) return nearest(c, wood);
      return nearest(
        c,
        trees.filter(t => !t.fall).map(t => ({ x: t.x, y: t.gy - t.spr.height })),
      );
    },
    // only what you carry counts: the helpers' wood in the store would finish it by itself
    done: c => inHand(c, 'wood') >= 2,
  },
  {
    id: 'hut',
    text: {
      touch: 'Bau eine Hütte: Bauen → Hütte, dann drin stehen bleiben',
      keys: 'Bau eine Hütte: B → Hütte, dann drin stehen bleiben',
    },
    target: () => {
      const b = hut();
      return b && { x: b.x + b.w / 2, y: b.gy - b.h };
    },
    rescue: [{ after: 40, text: c => (countRes(c, 'wood') < 2 ? 'Für die Hütte fehlt noch Holz' : null) }],
    done: () => hut()?.done,
  },
  {
    id: 'gold',
    text: 'Grab Gold aus und lauf damit in die Basis',
    target: c => (c.inv.includes('nug') ? { x: G.base.x + G.base.w / 2, y: G.base.gy - G.base.h } : nearestGold(c)),
    done: (c, s) => G.money > s.money0,
  },
];
const stepOf = () => G.tut && STEPS[G.tut.i];

// a text can be plain, per input ({ touch, keys }) or worked out right now
function say(v, c, s) {
  if (typeof v === 'function') v = v(c, s);
  if (v && typeof v === 'object') v = v[G.inputKind] || v.touch;
  return v || null;
}

// ---- progress kept in the profile: where players get stuck, how long each step takes ----
function stats() {
  return (P.tutStats ||= { runs: 0, done: 0, skips: {}, steps: {}, rescues: {} });
}
function noteStep(id, ticks) {
  const st = (stats().steps[id] ||= { n: 0, ticks: 0 });
  st.n++;
  st.ticks += ticks;
}

function enterStep(i) {
  const c = sel_();
  G.tut = { i, s: { t: 0, x0: c ? c.x : 0, dig: 0, money0: G.money, help: 0 } };
  STEPS[i].enter?.(c, G.tut.s);
  showStep();
}
function showStep() {
  stepTxt.textContent = `${G.tut.i + 1}/${STEPS.length}`;
  goalTxt.textContent = tr(say(STEPS[G.tut.i].text, sel_(), G.tut.s) || '');
  skipBtn.textContent = tr('Überspringen');
  box.hidden = false;
}
function startTutorial() {
  stats().runs++;
  saveProfile();
  enterStep(0);
}
// after loading a saved tutorial game
function resumeTutorial() {
  if (!G.tut || !STEPS[G.tut.i]) return (G.tut = null);
  showStep();
}
// result: 'done', 'skip' or nothing (a new game without the tutorial)
function endTutorial(result) {
  const i = G.tut ? G.tut.i : 0;
  G.tut = null;
  box.hidden = true;
  if (!result) return;
  P.tutorialDone = true;
  if (result === 'skip') {
    stats().skips[STEPS[i].id] = (stats().skips[STEPS[i].id] || 0) + 1;
    toast('Tutorial übersprungen – du findest es in den Optionen');
  } else {
    stats().done++;
    G.money += 20;
    sfx('done');
    toast('Tutorial geschafft! +20 Taler');
    track('tutorial');
  }
  saveProfile();
}
// skipping needs a second tap, so a stray touch does not end it
let skipArmed = 0;
skipBtn.addEventListener('click', () => {
  if (performance.now() - skipArmed > 3000) {
    skipArmed = performance.now();
    skipBtn.textContent = tr('Wirklich?');
    setTimeout(() => G.tut && (skipBtn.textContent = tr('Überspringen')), 3000);
    return;
  }
  skipArmed = 0;
  endTutorial('skip');
});

function updTutorial() {
  if (!G.tut) return;
  const c = sel_();
  if (!c || c.dead) return;
  const step = STEPS[G.tut.i],
    s = G.tut.s;
  s.t++;
  // stuck for a while: the next rescue changes the text or lends a hand
  const r = step.rescue?.[s.help];
  if (r && s.t > r.after * 60) {
    s.help++;
    r.run?.(c, s);
    stats().rescues[step.id] = (stats().rescues[step.id] || 0) + 1;
    s.helpTxt = say(r.text, c, s) || s.helpTxt;
  }
  const text = tr(s.helpTxt || say(step.text, c, s) || '');
  if (goalTxt.textContent !== text) goalTxt.textContent = text;
  if (!step.done(c, s)) return;
  noteStep(step.id, s.t);
  sfx('pick');
  if (step.praise) toast(step.praise);
  if (G.tut.i + 1 < STEPS.length) enterStep(G.tut.i + 1);
  else endTutorial('done');
}

// yellow arrow above the goal, or at the screen edge pointing towards it
function drawTutorial(ctx, cx, cy) {
  const c = G.tut && sel_();
  const t = c && stepOf().target?.(c, G.tut.s);
  if (!t) return;
  const sx = t.x - cx,
    sy = t.y - cy - 6 + Math.sin(G.frame * 0.15) * 2;
  const m = 8,
    inside = sx > m && sx < G.VW - m && sy > m && sy < G.VH - m;
  const x = Math.min(G.VW - m, Math.max(m, sx)),
    y = Math.min(G.VH - m, Math.max(m, sy));
  const ang = inside ? Math.PI / 2 : Math.atan2(sy - y, sx - x);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(ang);
  ctx.fillStyle = '#1a120c';
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.fill();
  ctx.fillStyle = '#f2c230';
  ctx.beginPath();
  ctx.moveTo(3.5, 0);
  ctx.lineTo(-3, -3.5);
  ctx.lineTo(-3, 3.5);
  ctx.fill();
  ctx.restore();
}

export { STEPS, drawTutorial, endTutorial, resumeTutorial, startTutorial, updTutorial };
