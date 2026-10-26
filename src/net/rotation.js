// The mode of the hour for quick play: every hour another mode or map, the same for everybody,
// so players looking for a game at the same time end up in the same room. A quick play room
// keeps the mode it was opened with (its tag, e.g. 'burgsturm:v').
import { GAME_MODES } from '../modes.js';

const ROTATION = [
  { gmode: 'burgsturm', versus: true },
  { gmode: 'gold', versus: false },
  { gmode: 'wettgraben', versus: true },
  { gmode: 'treasure', versus: false },
  { gmode: 'zweiburgen', versus: true },
  { gmode: 'build', versus: false },
  { gmode: 'gold', versus: true },
  { gmode: 'gold', versus: true, ffa: true },
  { gmode: 'treasure', versus: true, ffa: true },
];
const HOUR = 3600 * 1000;

// (modes that are missing in this version are skipped)
const usable = () => ROTATION.filter(r => GAME_MODES[r.gmode]);
function rotation(t = Date.now()) {
  const list = usable();
  const k = Math.floor(t / HOUR) % list.length;
  return { ...list[k], tag: tagOf(list[k]), until: (Math.floor(t / HOUR) + 1) * HOUR };
}
// k: Koop, v: Versus, f: everybody for themselves ("Jeder gegen jeden")
const tagOf = r => `${r.gmode}:${r.ffa ? 'f' : r.versus ? 'v' : 'k'}`;
function fromTag(tag) {
  const [gmode, v] = String(tag || '').split(':');
  if (!GAME_MODES[gmode] || GAME_MODES[gmode].campaign) return null;
  return { gmode, versus: v === 'v' || v === 'f', ffa: v === 'f' };
}
// "Burgsturm · Versus"
const kindName = r => (r.ffa ? 'Jeder gegen jeden' : r.versus ? 'Versus' : 'Koop');
const modeName = (r, tr) => `${tr(GAME_MODES[r.gmode].name)} · ${tr(kindName(r))}`;

export { fromTag, kindName, modeName, rotation };
