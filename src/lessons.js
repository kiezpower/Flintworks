// Lessons after the tutorial: one table for the tips that show up when a situation comes up and
// for the small missions of a round (missions.js) that let you practise them. When a mission
// starts, the tip of its lesson explains how to do it. Seen tips are kept in the profile, so a
// new world does not repeat them; the lobby lists them all under "Spielhilfe".
//   when    (c) → true when the tip fits right now – optional (some only come with their task)
//   tip     the text: a string or { touch, keys }
//   task    the mission { text, goal, pay, prog | count }; tasks run in the order of this table
//   urgent  shown even right after another tip or while in danger
import { countRes, terrOK, terrOn } from './buildings.js';
import { nearTree } from './clonk.js';
import { sel_ } from './entities.js';
import { tr } from './i18n.js';
import { isPlayer } from './players.js';
import { P, saveProfile } from './profile.js';
import { G, builds, crew } from './state.js';
import { stock } from './store.js';
import { hasTool } from './tools.js';
import { say } from './tutorial.js';
import { opt, sec, toast } from './ui.js';
import { darkness } from './weather.js';
import { H, ROCK, W, matAt, surf } from './world.js';

const helpers = () => crew.filter(c => !isPlayer(c) && !c.dead);
const below = c => c.y - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x)))];
const deepest = () => {
  const c = sel_();
  return c ? Math.round((c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))]) / 4) : 0;
};
const built = t => (builds.some(b => b.type === t && b.done) ? 1 : 0);

const LESSONS = [
  {
    id: 'crew',
    name: 'Helfer',
    when: () => G.frame > 600,
    tip: 'Deine Helfer arbeiten von selbst: sie sammeln, fällen Bäume, graben Erz und bringen alles zur Basis',
  },
  {
    id: 'crewtap',
    name: 'Aufgaben für Helfer',
    when: () => crew.length > 1 && G.frame > 900,
    tip: {
      touch: 'Tippe oben auf einen Helfer, um ihm eine Aufgabe zu geben',
      keys: 'Klick oben auf einen Helfer, um ihm eine Aufgabe zu geben',
    },
    task: {
      text: 'Gib einem Helfer eine Aufgabe',
      goal: 1,
      pay: 20,
      prog: () => (helpers().some(c => c.focus && c.focus !== 'all') ? 1 : 0),
    },
  },
  {
    id: 'tap',
    name: 'Laufen per Tipp',
    when: () => G.frame > 1500,
    tip: {
      touch: 'Tipp rechts ins Gelände: dein Wühler läuft (und gräbt) dorthin',
      keys: 'Klick ins Gelände: dein Wühler läuft (und gräbt) dorthin',
    },
  },
  {
    id: 'tree',
    name: 'Bäume',
    when: c => nearTree(c),
    tip: {
      touch: 'Aktion fällt den Baum. Holz brauchst du zum Bauen',
      keys: 'F fällt den Baum. Holz brauchst du zum Bauen',
    },
  },
  {
    id: 'store',
    name: 'Lager',
    tip: 'Was die Helfer heimbringen, liegt im Lager. Mit der Aufgabe Holz fällen sie Bäume',
    task: { text: 'Sammle {goal} Holz im Lager', goal: 15, pay: 30, prog: () => stock('wood') },
  },
  {
    id: 'build',
    name: 'Bauen',
    when: c => countRes(c, 'wood') >= 2 && countRes(c, 'rock') >= 1,
    tip: 'Genug Material für eine Hütte: Bauen',
  },
  {
    id: 'rock',
    name: 'Fels',
    when: c =>
      c.digging && matAt(Math.floor(c.x + 3 + c.digDir[0] * 9), Math.floor(c.y + 5 + c.digDir[1] * 10)) === ROCK,
    tip: 'Fels ist zu hart. Wirf einen Feuerstein darauf',
  },
  {
    id: 'loam',
    name: 'Brücke',
    when: c => c.inv[c.isel] === 'loam',
    tip: { touch: 'Lehm in der Hand: Aktion baut eine Brücke', keys: 'Lehm in der Hand: F baut eine Brücke' },
  },
  {
    id: 'depth',
    name: 'Tiefe',
    tip: 'Je tiefer, desto mehr Erz und Gold. Wie tief du bist, steht links oben',
    task: { text: 'Grabe {goal} m tief', goal: 20, pay: 30, prog: () => Math.max(0, deepest()) },
  },
  {
    id: 'beams',
    name: 'Stützbalken',
    tip: 'Helfer stützen ihre Stollen mit Balken – dafür brauchen sie Holz im Lager',
    task: { text: 'Lass {goal} Stützbalken aufstellen', goal: 3, pay: 40, count: () => (G.beams || []).length },
  },
  {
    id: 'mark',
    name: 'Abbaugebiet',
    tip: {
      touch: 'Tippe oben links auf deinen Wühler → Hier abbauen: dort graben die Bergleute',
      keys: 'Klick oben links auf deinen Wühler → Hier abbauen: dort graben die Bergleute',
    },
    task: { text: 'Markiere ein Abbaugebiet', goal: 1, pay: 20, prog: () => (G.mineMark ? 1 : 0) },
  },
  {
    id: 'saw',
    name: 'Sägewerk',
    tip: 'Das Sägewerk macht aus Holz Bretter: Bauen → Sägewerk',
    task: { text: 'Baue ein Sägewerk', goal: 1, pay: 50, prog: () => built('saw') },
  },
  {
    id: 'plank',
    name: 'Bretter',
    when: c => c.inv.includes('plank'),
    tip: 'Bretter: für Gebäude oder als Holzbrücke (Aktion)',
  },
  {
    id: 'gold',
    name: 'Gold',
    when: c => c.inv.includes('nug'),
    tip: 'Lauf mit dem Gold in die Heimatbasis – es wird sofort verkauft',
    task: { text: 'Verkaufe {goal} Goldklumpen', goal: 6, pay: 60, count: () => G.goldSold || 0 },
  },
  {
    id: 'hire',
    name: 'Anheuern',
    tip: 'Neue Helfer heuerst du in der Burg an: dort Aktion',
    task: { text: 'Heuere einen Helfer an', goal: 1, pay: 40, count: () => crew.length },
  },
  {
    id: 'ore',
    name: 'Hochofen',
    when: c => c.inv.includes('ore') || c.inv.includes('coal'),
    tip: 'Erz und Kohle schmilzt der Hochofen zu Metall',
    task: { text: 'Baue einen Hochofen', goal: 1, pay: 60, prog: () => built('furnace') },
  },
  {
    id: 'deep',
    name: 'Gefahr in der Tiefe',
    when: c => below(c) > 45,
    urgent: true,
    tip: 'Ab hier wird es gefährlich: Die Decke kann einstürzen, Grubengas lauert',
    task: { text: 'Grabe {goal} m tief', goal: 45, pay: 60, prog: () => Math.max(0, deepest()) },
  },
  {
    id: 'metal',
    name: 'Werkzeug',
    when: c => c.inv.includes('metal') && !hasTool('pick'),
    tip: 'Mit Metall gibt es an der Basis besseres Werkzeug',
  },
  {
    id: 'research',
    name: 'Forschung',
    when: () => G.frame > 7200 && G.money >= 40 && !G.teams,
    tip: 'In der Burg kannst du forschen: Fahrzeuge, Waffen und mehr',
  },
  {
    id: 'chest',
    name: 'Schatztruhen',
    when: () => (G.chestsFound || 0) === 0 && G.mode === 'treasure' && G.frame > 900,
    tip: 'Die Karte zeigt, wo die Schatztruhen vergraben sind',
  },
  {
    id: 'terr',
    name: 'Gebiet',
    when: c => terrOn() && !terrOK(c.x),
    tip: 'Du bist außerhalb deines Gebiets. Flaggen erweitern es',
  },
  {
    id: 'storm',
    name: 'Burgsturm',
    when: () => G.teams?.length === 2 && G.frame > 300,
    tip: 'Feuersteine, Sprengladungen und Pfeile beschädigen die feindliche Burg. Fällt sie, habt ihr gewonnen',
  },
  {
    id: 'ffa',
    name: 'Jeder gegen jeden',
    when: () => G.teams?.length > 2 && G.frame > 300,
    tip: 'Jeder hat eine eigene Burg. Eine gestürmte Burg ist raus, wer als Letzter steht, gewinnt',
  },
  {
    id: 'hill',
    name: 'Hügel',
    when: () => !!(G.teams && G.mp && G.mp.hill) && G.frame > 2400,
    tip: 'Wer den Hügel in der Mitte hält, bekommt laufend Taler',
  },
  {
    id: 'teamtask',
    name: 'Teamaufgabe',
    when: () => !!(G.mp && G.mp.coop),
    tip: 'Teamaufgaben schafft ihr nur gemeinsam. Sie bringen viele Taler',
  },
  { id: 'hang', name: 'Hangeln', when: c => c.hangle, tip: 'Du hängst an der Decke. Runter lässt los' },
  {
    id: 'night',
    name: 'Nacht',
    when: () => darkness() > 0.35,
    urgent: true,
    tip: 'Es wird Nacht. Bleib in der Nähe der Basis',
  },
  {
    id: 'lava',
    name: 'Lava',
    when: c => Math.abs(c.y - H + 60) < 40,
    urgent: true,
    tip: 'Vorsicht: In der Tiefe gibt es Lava und Säure',
  },
];
const MISSIONS = LESSONS.filter(l => l.task).map(l => ({ ...l.task, id: l.id }));

// ---- showing tips ----
const COOLDOWN = 45 * 60; // game ticks between two tips that are not urgent
G.hintsSeen = new Set(); // this round (saved with the game); P.tips: ever seen (profile)
const seen = id => G.hintsSeen.has(id) || (P.tips || []).includes(id);
function show(l) {
  G.hintsSeen.add(l.id);
  (P.tips ||= []).push(l.id);
  saveProfile();
  G.tipT = G.playTicks || 0;
  toast(say(l.tip));
}
// every second while playing
function checkLessons() {
  const c = sel_();
  if (!c || c.dead || G.toastT > 0 || G.tut) return;
  const calm = !c.hurt && !c.burn && !c.tumble && !(G.quakeT > 0);
  // the current mission's lesson first: it says how to do it
  const m = G.mis && MISSIONS[G.mis.i] && LESSONS.find(l => l.id === MISSIONS[G.mis.i].id);
  if (m && calm && !seen(m.id)) return show(m);
  const ready = (G.playTicks || 0) - (G.tipT ?? -Infinity) > COOLDOWN;
  for (const l of LESSONS) if (l.when && !seen(l.id) && (l.urgent || (ready && calm)) && l.when(c)) return show(l);
}

// "Spielhilfe" in the lobby: every tip found so far to read again
function lessonsPanel(p, reopen) {
  const n = LESSONS.filter(l => seen(l.id)).length;
  const l = sec(p, tr('Entdeckt: {n} von {m}', { n, m: LESSONS.length }));
  for (const L of LESSONS)
    opt(l, {
      title: seen(L.id) ? tr(L.name) : '???',
      sub: seen(L.id) ? tr(say(L.tip)) : tr('Noch nicht entdeckt'),
      onClick: () => {},
    });
  const r = sec(p, '');
  opt(r, {
    title: tr('Tipps wieder zeigen'),
    sub: tr('Alle Tipps erscheinen im Spiel noch einmal'),
    short: true,
    onClick: () => {
      P.tips = [];
      G.hintsSeen.clear();
      saveProfile();
      toast('Die Tipps kommen wieder');
      reopen();
    },
  });
}

export { LESSONS, MISSIONS, checkLessons, lessonsPanel };
