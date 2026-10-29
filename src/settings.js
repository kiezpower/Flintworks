// The settings, shared by the lobby options and the in-game menu: one list in the same groups
// everywhere. The profile (P) is the truth; the live game (G) follows at once and again at the
// start of every round (main.js).
import { P, saveProfile } from './profile.js';
import { tr } from './i18n.js';
import { resize } from './render.js';
import { G, crew } from './state.js';
import { $, opt, sec } from './ui.js';

// one difficulty for dangers and pace together, chosen in the lobby: relaxed worlds have no
// monsters, gas, lightning or meteors (gen.js); speed is the share of the original pace
const DIFF = {
  relaxed: { name: 'Gemütlich', speed: 0.7, info: 'Keine Monster, kein Gas, keine Blitze und Meteore, ruhiges Tempo' },
  adventure: { name: 'Abenteuer', speed: 0.85, info: 'Alle Gefahren' },
  hard: { name: 'Hart', speed: 1, info: 'Alle Gefahren, volles Tempo' },
};
const diffOf = d => (DIFF[d] ? d : 'adventure');

// fills the panel p with the setting groups; reopen redraws the panel after a change
// (lobby: also the difficulty, which is set when a world is made)
function settingsSections(p, reopen, { lobby = false } = {}) {
  const item = (l, title, sub, fn) =>
    opt(l, {
      title: tr(title),
      sub: tr(sub),
      onClick: () => {
        fn();
        saveProfile();
        reopen();
      },
    });

  // the difficulty of free play (campaign levels and the Tagesschacht keep their own)
  if (lobby) {
    const k = diffOf(P.diff);
    item(sec(p, 'Spiel'), tr('Schwierigkeit: {name}', { name: tr(DIFF[k].name) }), DIFF[k].info, () => {
      const ks = Object.keys(DIFF);
      P.diff = ks[(ks.indexOf(k) + 1) % ks.length];
    });
  }

  const snd = sec(p, 'Ton');
  item(snd, G.muted ? 'Ton aus' : 'Ton an', 'Ton', () => $('sndBtn').click());
  item(snd, P.music === false ? 'Musik aus' : 'Musik an', 'Musik', () => (P.music = P.music === false));
  item(snd, P.vibe === false ? 'Vibration: aus' : 'Vibration: an', 'Kurzes Rütteln beim Graben, bei Treffern und Sprengungen', () => {
    P.vibe = P.vibe === false;
    G.vibe = P.vibe;
  });

  // modern: walking into earth digs, with a jump button; classic as in the originals: a dig
  // button, and climbing up walls and along ceilings
  const ctl = sec(p, 'Steuerung');
  const classic = P.autodig === false;
  item(
    ctl,
    classic ? 'Steuerung: Klassisch' : 'Steuerung: Modern',
    classic
      ? 'Graben-Knopf, an Wänden klettern und an Decken hängen – wie im Original'
      : 'Gegen Erde laufen gräbt, eigener Sprung-Knopf',
    () => {
      P.autodig = classic;
      applyControls();
    },
  );

  const gfx = sec(p, 'Grafik');
  // (a slow device may have switched to fast graphics on its own during the round, main.js)
  const low = G.state === 'play' ? G.res === 1 : P.gfx === 'low';
  item(gfx, low ? 'Grafik: schnell' : 'Grafik: fein', 'Schnell läuft flüssiger auf älteren Handys', () => {
    P.gfx = low ? 'high' : 'low';
    if (G.state === 'play') {
      G.res = P.gfx === 'low' ? 1 : 2;
      resize();
    }
  });
  item(gfx, P.lightfx === false ? 'Licht: aus' : 'Licht: an', 'Dämmerung unter Tage, Leuchten und Rahmen ums Bild', () => {
    P.lightfx = P.lightfx === false;
    G.lightFx = P.lightfx;
  });
}

// the controls from the profile into the running game (also at the start of every round)
function applyControls() {
  G.autoDig = P.autodig !== false;
  G.jumpBtn = true;
  G.climbOn = !G.autoDig;
  if (!G.climbOn) for (const c of crew) c.climb = c.hangle = false;
}

export { DIFF, applyControls, diffOf, settingsSections };
