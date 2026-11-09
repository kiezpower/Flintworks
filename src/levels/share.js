// Levels shared as a link (?lvl=…): the level editor packs a level (level.json and map.txt) into
// the address – JSON, deflated, base64url – and whoever opens the link plays it. A link can come
// from anybody, so what it carries is checked before the game touches it: only the fields and
// kinds the game knows, numbers within bounds, the map in the palette and in its size, and texts
// without any of the characters HTML is made of (texts reach the screen through tr() and some
// of it through innerHTML). Anything else and the link is refused as a whole.
import { SIZE_MAX, SIZE_MIN } from '../world.js';
import { ITEM } from '../sprites.js';
import { CHARS } from './palette.js';
import { TYPES } from './goals.js';
import { BadLink, packLevel, unpackJson } from './linkcode.js';

const SHARED_ID = 'geteilt';
const unpackLevel = async code => cleanLevel(await unpackJson(code));

// ---- checking ----
const bad = what => new BadLink(what);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
// a text for the screen: no markup characters, no control characters, not too long
const text = (v, max = 300) => {
  if (v == null) return undefined;
  if (typeof v !== 'string') throw bad('text');
  return v.replace(/[<>&"'`\\]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
};
const word = (v, re = /^[a-z][a-zA-Z0-9]{0,23}$/) => {
  if (typeof v !== 'string' || !re.test(v)) throw bad('word ' + String(v).slice(0, 20));
  return v;
};
const num = (v, lo, hi, int = false) => {
  if (v == null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (int && !Number.isInteger(v))) throw bad('number');
  return v;
};
const bool = v => (v == null ? undefined : !!v);
const list = (v, max, fn) => {
  if (v == null) return undefined;
  if (!Array.isArray(v) || v.length > max) throw bad('list');
  return v.map(fn);
};
const oneOf = (v, set) => {
  if (v == null) return undefined;
  if (!set.includes(v)) throw bad('choice ' + String(v).slice(0, 20));
  return v;
};
// drops undefined fields (so the game's own defaults apply)
const tidy = o => {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
};

const ANIMALS = ['fluffel', 'fish', 'monster', 'spider', 'slime', 'golem', 'bat', 'crawler', 'spore'];
const itemId = v => oneOf(word(v), Object.keys(ITEM));
const X = 4000; // coordinates (cells; x below zero counts from the right edge)
const coord = v => num(v, -X, X);

function cleanObject(o) {
  if (!isObj(o)) throw bad('object');
  const t = oneOf(o.t, ['base', 'tree', 'item', 'animal', 'trapped', 'chest', 'gas', 'beam', 'hill']);
  const out = { t, x: coord(o.x), y: coord(o.y) };
  if (t === 'base') Object.assign(out, { team: num(o.team, 0, 1, true), lvl: num(o.lvl, 1, 3, true) });
  if (t === 'tree') out.stage = num(o.stage, 0, 4, true);
  if (t === 'item') out.kind = itemId(o.kind);
  if (t === 'animal') Object.assign(out, { kind: oneOf(o.kind, ANIMALS), lost: bool(o.lost) });
  if (t === 'chest') out.re = num(o.re, 0, 3, true);
  if (t === 'gas' || t === 'hill') out.r = num(o.r, 1, 200);
  if (t === 'beam') Object.assign(out, { y0: coord(o.y0), y1: coord(o.y1) });
  return tidy(out);
}
function cleanGoal(g) {
  if (!isObj(g)) throw bad('goal');
  return tidy({
    t: oneOf(g.t, Object.keys(TYPES)),
    n: num(g.n, 0, 100000),
    what: g.what == null ? undefined : word(g.what),
    area: g.area == null ? undefined : word(g.area, /^[A-Za-z0-9_-]{1,24}$/),
    label: text(g.label, 80),
  });
}
function cleanTrigger(t, goals) {
  if (!isObj(t) || !isObj(t.when)) throw bad('trigger');
  const w = t.when,
    when = tidy({
      t: oneOf(w.t, ['enter', 'after', 'goal', 'flag', 'rescued']),
      area: w.area == null ? undefined : word(w.area, /^[A-Za-z0-9_-]{1,24}$/),
      min: num(w.min, 0, 600),
      n: num(w.n, 0, 100000, true),
      name: w.name == null ? undefined : word(w.name, /^[A-Za-z0-9_-]{1,24}$/),
    });
  if (when.t === 'goal' && !(when.n < goals)) throw bad('trigger goal');
  if (when.t === 'after' && when.min == null) throw bad('trigger time');
  const act = d => {
    if (!isObj(d)) throw bad('action');
    const t2 = oneOf(d.t, ['say', 'banner', 'flag', 'unlock', 'event', 'spawn', 'win', 'lose']);
    return tidy({
      t: t2,
      text: text(d.text),
      title: text(d.title, 80),
      name: d.name == null ? undefined : word(d.name, /^[A-Za-z0-9_-]{1,24}$/),
      what: t2 === 'unlock' ? word(d.what) : undefined,
      kind: t2 === 'event' ? oneOf(d.kind, ['quake', 'volcano', 'meteor']) : undefined,
      animal: t2 === 'spawn' && d.animal != null ? oneOf(d.animal, ANIMALS) : undefined,
      item: t2 === 'spawn' && d.animal == null ? itemId(d.item) : undefined,
      x: t2 === 'spawn' ? coord(d.x) ?? 0 : undefined,
      y: t2 === 'spawn' ? coord(d.y) ?? 0 : undefined,
    });
  };
  return tidy({ when, do: list(t.do, 12, act) || [], repeat: bool(t.repeat) });
}
// rules: what the game reads – switches, numbers, short words ("left") and small nested lists
// and objects of them (rise, siege waves, assault stocks); nothing of it is shown as text
function cleanRules(r) {
  if (r == null) return undefined;
  if (!isObj(r)) throw bad('rules');
  const val = (v, depth) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return num(v, -100000, 100000);
    if (typeof v === 'string') return word(v, /^[A-Za-z][A-Za-z0-9_-]{0,23}$/);
    if (depth > 3) throw bad('rules depth');
    if (Array.isArray(v)) return list(v, 32, x => val(x, depth + 1));
    if (isObj(v)) {
      const keys = Object.keys(v);
      if (keys.length > 32) throw bad('rules size');
      const o = {};
      for (const k of keys) o[word(k, /^[A-Za-z][A-Za-z0-9_]{0,23}$/)] = val(v[k], depth + 1);
      return o;
    }
    throw bad('rule');
  };
  return val(r, 0);
}
function cleanStart(s) {
  if (s == null) return undefined;
  if (!isObj(s)) throw bad('start');
  const counts = o => {
    if (o == null) return undefined;
    if (!isObj(o)) throw bad('counts');
    const out = {};
    for (const k of Object.keys(o)) out[itemId(k)] = num(o[k], 0, 999, true);
    return out;
  };
  return tidy({
    money: num(s.money, 0, 100000, true),
    crew: num(s.crew, 1, 8, true),
    inv: list(s.inv, 8, b => list(b, 16, itemId)),
    research: list(s.research, 16, v => word(v)),
    store: counts(s.store),
    tools: list(s.tools, 16, v => word(v)),
  });
}
// the whole package; the result is a fresh object with only what was checked
function cleanLevel(raw) {
  if (!isObj(raw)) throw bad('package');
  const size = list(raw.size, 2, v => num(v, 1, 10000, true));
  if (!size || size.length !== 2) throw bad('size');
  if (size[0] < SIZE_MIN[0] || size[0] > SIZE_MAX[0] || size[1] < SIZE_MIN[1] || size[1] > SIZE_MAX[1]) throw bad('size');
  const zoom = num(raw.zoom ?? 1, 1, 16, true);
  // the map: rows of palette characters that cover the world exactly at the zoom
  if (typeof raw.map !== 'string') throw bad('map');
  const rows = raw.map.replace(/\r/g, '').split('\n').filter(r => r.length);
  if (rows.length * zoom !== size[1] || !rows.length || rows[0].length * zoom !== size[0]) throw bad('map size');
  for (const r of rows) {
    if (r.length !== rows[0].length) throw bad('map row');
    for (const ch of r) if (!CHARS[ch]) throw bad('map character');
  }
  const goals = list(raw.goals, 8, cleanGoal);
  if (!goals || !goals.length) throw bad('goals');
  const areas = {};
  if (raw.areas != null) {
    if (!isObj(raw.areas) || Object.keys(raw.areas).length > 24) throw bad('areas');
    for (const k of Object.keys(raw.areas)) {
      const a = list(raw.areas[k], 4, v => num(v, -X, X));
      if (!a || a.length !== 4) throw bad('area');
      areas[word(k, /^[A-Za-z0-9_-]{1,24}$/)] = a;
    }
  }
  const lose = isObj(raw.lose)
    ? tidy({ crewDead: bool(raw.lose.crewDead), castle: bool(raw.lose.castle), time: num(raw.lose.time, 0, 600) })
    : undefined;
  const fill = isObj(raw.fill)
    ? Object.fromEntries(Object.keys(raw.fill).map(k => [word(k), num(raw.fill[k], 0, 10)]))
    : undefined;
  return tidy({
    id: SHARED_ID,
    v: num(raw.v, 0, 99, true),
    name: text(raw.name, 60) || 'Geteiltes Level',
    icon: raw.icon == null ? undefined : word(raw.icon),
    desc: text(raw.desc, 160),
    intro: text(raw.intro, 400),
    biome: oneOf(raw.biome, ['meadow', 'desert', 'winter']),
    size,
    zoom,
    rough: num(raw.rough, 0, 3),
    seed: num(raw.seed, 0, 2 ** 32 - 1, true),
    diff: oneOf(raw.diff, ['relaxed', 'adventure', 'hard']),
    stars: list(raw.stars, 2, v => num(v, 1, 600)),
    fill,
    start: cleanStart(raw.start),
    rules: cleanRules(raw.rules),
    objects: list(raw.objects, 400, cleanObject),
    triggers: list(raw.triggers, 60, t => cleanTrigger(t, goals.length)),
    areas,
    goals,
    lose,
    map: rows.join('\n'),
  });
}

export { SHARED_ID, cleanLevel, packLevel, unpackLevel };
