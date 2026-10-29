// The settings, shared by the lobby options and the in-game menu: one list in the same groups
// everywhere. The profile (P) is the truth; the live game (G) follows at once and again at the
// start of every round (main.js).
import { P, saveProfile } from './profile.js';
import { tr } from './i18n.js';
import { resize } from './render.js';
import { G, crew } from './state.js';
import { $, opt, sec } from './ui.js';

const TEMPO = { calm: 0.7, normal: 0.85, fast: 1 };
const TEMPO_NAME = { calm: 'Gemütlich', normal: 'Normal', fast: 'Schnell' };

// fills the panel p with the setting groups; reopen redraws the panel after a change
// (lobby: also the rules that only apply to the next new game)
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

  const snd = sec(p, 'Ton');
  item(snd, G.muted ? 'Ton aus' : 'Ton an', 'Ton', () => $('sndBtn').click());
  item(snd, P.music === false ? 'Musik aus' : 'Musik an', 'Musik', () => (P.music = P.music === false));
  item(snd, P.vibe === false ? 'Vibration: aus' : 'Vibration: an', 'Kurzes Rütteln beim Graben, bei Treffern und Sprengungen', () => {
    P.vibe = P.vibe === false;
    G.vibe = P.vibe;
  });

  const ctl = sec(p, 'Steuerung');
  item(
    ctl,
    P.autodig === false ? 'Automatisch graben aus' : 'Automatisch graben an',
    'Gegen Erde laufen gräbt. Aus: Graben- und Sprung-Knopf wie früher',
    () => {
      P.autodig = P.autodig === false;
      G.autoDig = P.autodig;
    },
  );
  if (P.autodig !== false)
    item(ctl, P.jumpbtn === false ? 'Sprung-Knopf aus' : 'Sprung-Knopf an', 'Eigener Knopf zum Springen, auch beim automatischen Graben', () => {
      P.jumpbtn = P.jumpbtn === false;
      G.jumpBtn = P.jumpbtn;
    });
  item(ctl, tr('Spieltempo: {t}', { t: tr(TEMPO_NAME[P.tempo || 'normal']) }), 'Gemütlich, Normal oder Schnell', () => {
    const ks = Object.keys(TEMPO);
    P.tempo = ks[(ks.indexOf(P.tempo || 'normal') + 1) % ks.length];
    if (G.state === 'play') G.speed = TEMPO[P.tempo];
  });

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

  const rules = sec(p, 'Regeln');
  item(rules, P.climbing ? 'Klettern an' : 'Klettern aus', 'An Wänden hochklettern und an Decken hängen', () => {
    P.climbing = !P.climbing;
    G.climbOn = P.climbing;
    if (!G.climbOn) for (const c of crew) c.climb = c.hangle = false;
  });
  // (territories are laid out when a world starts, so only for the next new game)
  if (lobby)
    item(rules, P.territory ? 'Baugebiete an' : 'Baugebiete aus', 'Bauen nur im eigenen Gebiet, Flaggen erweitern es', () => {
      P.territory = !P.territory;
    });
}

export { TEMPO, settingsSections };
