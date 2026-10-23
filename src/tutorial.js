import { P, saveProfile, track } from './profile.js';
// Guided first game: short tasks with a pointer to the next goal.
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
document.getElementById('questSkip').addEventListener('click', () => endTutorial(false));

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
const STEPS = [
  { text: 'Lauf ein Stück nach rechts', done: (c, s) => c.x > s.x0 + 30 },
  { text: 'Spring einmal: Stick nach oben schnippen oder Sprung', done: c => c.vy < -1.5 && !c.climb },
  { text: 'Grab dich in die Erde: Graben halten', done: (c, s) => (s.dig += c.digging ? 1 : 0) > 60 },
  {
    text: 'Geh zu einem Baum und fälle ihn mit Aktion',
    target: c => {
      const t = nearest(
        c,
        trees.filter(t => !t.fall).map(t => ({ x: t.x, y: t.gy - t.spr.height })),
      );
      return t;
    },
    done: c => countRes(c, 'wood') > 0 || items.some(i => i.t === 'wood'),
  },
  {
    text: 'Sammle 2 Holz ein: einfach darüberlaufen',
    target: c =>
      nearest(
        c,
        items.filter(i => i.t === 'wood'),
      ),
    done: c => countRes(c, 'wood') >= 2,
  },
  { text: 'Tippe auf Bauen und wähle die Hütte', done: () => !!hut() },
  {
    text: 'Bleib in der Baustelle, bis die Hütte steht',
    target: () => {
      const b = hut();
      return b && { x: b.x + b.w / 2, y: b.gy - b.h };
    },
    done: () => hut()?.done,
  },
  {
    text: 'Grab zur Goldader und sammle Gold',
    hint: c => (c.inv.length >= 5 ? 'Gepäck voll: wirf etwas mit Wurf weg' : null),
    target: c => nearestGold(c),
    done: c => c.inv.includes('nug'),
  },
  {
    text: 'Bring das Gold zur Basis und verkaufe es mit Aktion',
    target: () => ({ x: G.base.x + G.base.w / 2, y: G.base.gy - G.base.h }),
    done: (c, s) => G.money > s.money0,
  },
];

function enterStep(i) {
  const c = sel_();
  G.tut = { i, s: { x0: c ? c.x : 0, dig: 0, money0: G.money } };
  stepTxt.textContent = `${i + 1}/${STEPS.length}`;
  goalTxt.textContent = tr(STEPS[i].text);
  box.hidden = false;
}
function startTutorial() {
  enterStep(0);
}
function endTutorial(finished) {
  G.tut = null;
  box.hidden = true;
  if (finished) {
    G.money += 20;
    sfx('done');
    toast('Tutorial geschafft! +20 Taler');
    track('tutorial');
    P.tutorialDone = true;
    saveProfile();
  }
}
function updTutorial() {
  if (!G.tut) return;
  const c = sel_();
  if (!c || c.dead) return;
  const step = STEPS[G.tut.i];
  const text = tr(step.hint?.(c) || step.text);
  if (goalTxt.textContent !== text) goalTxt.textContent = text;
  if (!step.done(c, G.tut.s)) return;
  sfx('pick');
  if (G.tut.i + 1 < STEPS.length) enterStep(G.tut.i + 1);
  else endTutorial(true);
}

// yellow arrow above the goal, or at the screen edge pointing towards it
function drawTutorial(ctx, cx, cy) {
  if (!G.tut) return;
  const c = sel_();
  const t = c && STEPS[G.tut.i].target?.(c);
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

export { drawTutorial, endTutorial, startTutorial, updTutorial };
