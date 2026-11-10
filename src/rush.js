// Gold fever ("Goldfieber", not to be mixed up with the mode Goldrausch) now and then in the
// middle of a round, a high point for the long free rounds: for one minute the castle pays double
// for gold nuggets. Only in the free modes (no campaign, levels or tutorial), first after three
// minutes, then every five to seven; in the Tagesschicht only on its fever day (daily.js), where
// it comes after 90 seconds and then every minute and a quarter after the last one ended – the
// same for everybody, so the scores stay comparable. Runs on the host or in a single game;
// everybody hears the banner.
import { announce, announceBanner } from './announce.js';
import { GAME_MODES } from './modes.js';
import { sfx } from './sound.js';
import { G } from './state.js';
import { rnd } from './world.js';

const MINUTE = 3600; // ticks
const RUSH = MINUTE;
const feverDay = () => G.daily?.tw === 'fever';
const allowed = () => {
  const M = GAME_MODES[G.mode];
  return !!M && !M.campaign && !M.pkg && (!M.daily || feverDay()) && !G.tut;
};
// what a nugget sold now is worth, as a factor (store.js)
const rushK = t => (t === 'nug' && G.rushT > 0 ? 2 : 1);

// every tick (host or single game)
function updRush() {
  if (G.netClient || G.state !== 'play') return;
  if (G.rushT > 0) {
    if (--G.rushT === 0) announce('Das Goldfieber ist vorbei');
    return;
  }
  if (!allowed()) return;
  if (G.rushNext == null) G.rushNext = feverDay() ? 90 * 60 : 3 * MINUTE;
  if (--G.rushNext > 0) return;
  G.rushNext = feverDay() ? 75 * 60 : Math.round((5 + rnd() * 2) * MINUTE);
  startRush();
}
function startRush() {
  G.rushT = RUSH;
  announceBanner('Goldfieber!', 'Eine Minute lang zahlt die Burg doppelt für Gold');
  sfx('fanfare');
}
// a new world: the rush starts again from the beginning
function resetRush() {
  G.rushT = 0;
  G.rushNext = null;
}

export { resetRush, rushK, startRush, updRush };
