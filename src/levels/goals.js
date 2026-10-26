// Goals, defeats and triggers of hand-built levels (level.json), checked every half second on
// the host or in a single game. The running state (what fired, flags, areas reached, the deepest
// point) lives in G.lvl and is saved with the game.
import { announce, announceBanner } from '../announce.js';
import { BT, resName } from '../buildings.js';
import { mkAnimal, spawnItem } from '../entities.js';
import { startQuake, startVolcano } from '../events.js';
import { addFloat } from '../floats.js';
import { tr } from '../i18n.js';
import { G, animals, builds, crew, vehicles } from '../state.js';
import { VK } from '../vehicles/index.js';
import { W, surf } from '../world.js';

const lvl = () => G.lvl || (G.lvl = { fired: {}, flags: {}, reached: {}, depth: {} });
// areas reached and the deepest point count per team (Versus maps; otherwise all are team 0)
const team = () => G.curTeam || 0;
const teamOfC = c => c.team || 0;
// [x, y, w, h], x below zero counts from the right edge
const areaOf = (L, name) => {
  const a = L.areas && L.areas[name];
  return a && [a[0] < 0 ? W + a[0] : a[0], a[1], a[2], a[3]];
};
const inArea = (o, a) => a && o.x + 3 >= a[0] && o.x + 3 < a[0] + a[2] && o.y + 5 >= a[1] && o.y + 5 < a[1] + a[3];
const alive = () => crew.filter(c => !c.dead && !c.trapped);
const depthM = c => Math.round((c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))]) / 4);
const nameOf = t => (BT[t] ? tr(BT[t].name) : VK[t] ? tr(VK[t].name) : t);

// what each kind of goal counts and how the goal line names it
const TYPES = {
  money: { val: () => G.money, label: () => tr('Taler') },
  sell: {
    val: g => (G.sold && G.sold[g.what]) || 0,
    label: g => tr('{what} verkauft', { what: resName(g.what) }),
  },
  collect: {
    val: g => (G.store && G.store[g.what]) || 0,
    label: g => tr('{what} im Lager', { what: resName(g.what) }),
  },
  rescue: { val: () => G.rescued || 0, label: () => tr('Gerettet') },
  kills: { val: () => G.kills || 0, label: () => tr('Monster besiegt') },
  chests: { val: () => G.chestsFound || 0, label: () => tr('Truhen') },
  depth: { val: () => lvl().depth[team()] || 0, label: () => tr('Tiefe in m') },
  build: {
    val: g =>
      builds.filter(b => b.done && b.type === g.what).length + vehicles.filter(v => v.kind === g.what).length,
    label: g => nameOf(g.what),
  },
  reach: { val: g => (lvl().reached[team() + ':' + g.area] ? 1 : 0), label: g => tr(g.label || 'Ziel erreicht') },
  survive: { val: () => Math.floor((G.playTicks || 0) / 3600), label: () => tr('Minuten') },
};
const need = g => g.n ?? 1;
// a goal as a sentence, for the level selection ("Verdiene 600 Taler")
const PHRASE = {
  money: g => tr('Verdiene {n} Taler', { n: need(g) }),
  sell: g => tr('Verkaufe {n} × {what}', { n: need(g), what: resName(g.what) }),
  collect: g => tr('Bringe {n} × {what} ins Lager', { n: need(g), what: resName(g.what) }),
  rescue: g => tr('Rette {n} Eingeschlossene', { n: need(g) }),
  kills: g => tr('Besiege {n} Monster', { n: need(g) }),
  chests: g => tr('Finde {n} Schatztruhen', { n: need(g) }),
  depth: g => tr('Erreiche {n} m Tiefe', { n: need(g) }),
  build: g => (need(g) > 1 ? `${need(g)} × ${nameOf(g.what)}` : tr('Baue: {what}', { what: nameOf(g.what) })),
  reach: g => tr(g.label || 'Ziel erreicht'),
  survive: g => tr('Halte {n} Minuten durch', { n: need(g) }),
};
const goalText = g => PHRASE[g.t](g);
const valOf = g => Math.min(need(g), TYPES[g.t].val(g));
const done = g => TYPES[g.t].val(g) >= need(g);

// the goal line in the HUD: the first open goal, with how many goals there are
function status(L) {
  const gs = L.goals,
    k = Math.max(0, gs.findIndex(g => !done(g))),
    g = gs[k];
  const pre = gs.length > 1 ? `${k + 1}/${gs.length} · ` : '';
  return { text: `${pre}${TYPES[g.t].label(g)} ${valOf(g)}/${need(g)}`, p: valOf(g), of: need(g) };
}
// all goals together as one number, so the usual "goal reached" check works
const progress = L => L.goals.reduce((s, g) => s + valOf(g), 0);
const total = L => L.goals.reduce((s, g) => s + need(g), 0);

// trapped Wühler and lost animals wait until a Wühler reaches them
function rescueTick() {
  const near = o => crew.find(c => !c.trapped && !c.dead && Math.abs(c.x - o.x) < 14 && Math.abs(c.y - o.y) < 12);
  for (const c of crew) {
    if (!c.trapped || c.dead) continue;
    c.vx = 0;
    if (G.frame % 240 === 0) addFloat(c.x + 3, c.y - 6, tr('Hilfe!'), '#ffffff');
    if (!near(c)) continue;
    c.trapped = false;
    c.focus = 'all';
    G.rescued = (G.rescued || 0) + 1;
    announce('{name} ist gerettet!', { name: c.name });
  }
  for (const a of animals) {
    if (!a.lost || a.hp <= 0) continue;
    if (G.frame % 240 === 120) addFloat(a.x + 2, a.y - 5, '?', '#ffffff');
    if (!near(a)) continue;
    a.lost = false;
    G.rescued = (G.rescued || 0) + 1;
    announce('Ein Wipf ist gerettet!');
  }
}

const WHEN = {
  enter: (w, L) => crew.some(c => !c.dead && !c.trapped && inArea(c, areaOf(L, w.area))),
  after: w => (G.playTicks || 0) >= w.min * 3600,
  goal: (w, L) => done(L.goals[w.n]),
  flag: w => !!lvl().flags[w.name],
  rescued: w => (G.rescued || 0) >= w.n,
};
function act(d, L) {
  if (d.t === 'say') announce(d.text);
  else if (d.t === 'banner') announceBanner(d.title, d.text);
  else if (d.t === 'flag') lvl().flags[d.name] = true;
  else if (d.t === 'unlock') G.tools['r_' + d.what] = true;
  else if (d.t === 'event') {
    if (d.kind === 'quake') startQuake();
    else if (d.kind === 'volcano') startVolcano();
    else if (d.kind === 'meteor') G.meteorNext = 1;
  } else if (d.t === 'spawn') {
    const x = d.x < 0 ? W + d.x : d.x;
    if (d.animal) animals.push(mkAnimal(d.animal, x, d.y));
    else spawnItem(d.item, x, d.y, 0, 0);
  } else if (d.t === 'win') G.onLevelEnd?.(true);
  else if (d.t === 'lose') G.onLevelEnd?.(false, d.text);
}

// every half second: rescues, areas reached, the deepest point, triggers, defeats
function levelTick(L) {
  const s = lvl();
  rescueTick();
  for (const c of alive()) {
    const t = teamOfC(c);
    s.depth[t] = Math.max(s.depth[t] || 0, depthM(c));
    for (const name in L.areas || {}) if (inArea(c, areaOf(L, name))) s.reached[t + ':' + name] = true;
  }
  (L.triggers || []).forEach((t, k) => {
    if (s.fired[k] && !t.repeat) return;
    if (!WHEN[t.when.t](t.when, L)) return;
    s.fired[k] = true;
    for (const d of t.do) act(d, L);
  });
  const lose = L.lose || {};
  if (lose.crewDead && !alive().length) G.onLevelEnd?.(false, 'Alle Wühler sind verloren.');
  else if (lose.time && (G.playTicks || 0) >= lose.time * 3600) G.onLevelEnd?.(false, 'Die Zeit ist um.');
}

export { goalText, levelTick, progress, rescueTick, status, total, TYPES };
