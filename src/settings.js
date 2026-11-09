// The settings, shared by the lobby options and the in-game menu: one list in the same groups
// everywhere. The profile (P) is the truth; the live game (G) follows at once and again at the
// start of every round (main.js).
import { P, saveProfile } from './profile.js';
import { tr } from './i18n.js';
import { resize } from './render.js';
import { soloBoosts } from './camp.js';
import { isPlayer } from './players.js';
import { addStock } from './store.js';
import { G, crew } from './state.js';
import { $, opt, sec } from './ui.js';
import { ACTIONS, keyName, keyOf, listenFor, resetKeys } from './keys.js';

// the action waiting for its new key (keys.js), while the panel shows it
let listening = null;

// one difficulty for dangers and pace together, chosen in the lobby: relaxed worlds have no
// monsters, gas, lightning or meteors (gen.js); speed is the share of the original pace
const DIFF = {
  relaxed: { name: 'Gemütlich', speed: 0.7, info: 'Keine Monster, kein Gas, keine Blitze und Meteore, ruhiges Tempo' },
  adventure: { name: 'Abenteuer', speed: 0.85, info: 'Alle Gefahren' },
  hard: { name: 'Hart', speed: 1, info: 'Alle Gefahren, volles Tempo' },
};
const diffOf = d => (DIFF[d] ? d : 'adventure');

// fills the panel p with the setting groups; reopen redraws the panel after a change
// (lobby: also the difficulty, which is set when a world is made; game: a section to add to)
function settingsSections(p, reopen, { lobby = false, game: gameSec = null } = {}) {
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

  // (the game menu passes its own first section, the lobby gets one here)
  const game = gameSec || sec(p, 'Spiel');
  // the difficulty of free play (campaign levels and the Tagesschacht keep their own)
  if (lobby) {
    const k = diffOf(P.diff);
    item(game, tr('Schwierigkeit: {name}', { name: tr(DIFF[k].name) }), DIFF[k].info, () => {
      const ks = Object.keys(DIFF);
      P.diff = ks[(ks.indexOf(k) + 1) % ks.length];
    });
  }
  // computer opponents in quick play (net/session.js, bots.js): off, the castles nobody plays
  // stay empty and a Versus room waits for a real player; counts from the next round, and in a
  // room the setting of the host decides
  item(
    game,
    P.bots === false ? 'Bots: aus' : 'Bots: an',
    P.bots === false
      ? 'Schnelles Spiel wartet auf echte Mitspieler – keine Computergegner'
      : 'Im schnellen Spiel besetzen Computergegner leere Burgen',
    () => (P.bots = P.bots === false),
  );
  // the helper Wühler of free play alone (applyHelpers): off, you dig alone, from now on
  item(
    game,
    P.helpers === false ? 'Helfer: aus' : 'Helfer: an',
    P.helpers === false
      ? 'Du gräbst allein: keine Helfer-Wühler, kein Anheuern (freies Spiel allein)'
      : 'Helfer-Wühler arbeiten von selbst für dich (freies Spiel allein)',
    () => {
      P.helpers = P.helpers === false;
      if (G.inRun) applyHelpers();
    },
  );

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

  // own keys (keys.js), on a device with a keyboard: tap an action, then press its new key
  if (G.inputKind === 'keys') {
    const kl = sec(p, 'Tasten');
    for (const [id, , name] of ACTIONS)
      opt(kl, {
        title: tr(name),
        sub: listening === id ? tr('Drück eine Taste … (Esc: abbrechen)') : tr(keyName(keyOf(id))),
        short: true,
        onClick: () => {
          if (listening) return;
          listening = id;
          reopen();
          listenFor(id, () => {
            listening = null;
            reopen();
          });
        },
      });
    if (P.keys && Object.keys(P.keys).length)
      item(kl, 'Tasten zurücksetzen', 'Alle Aktionen wieder auf ihren Standardtasten', resetKeys);
  }

  // larger tips, task line and cards (onboarding.css)
  const view = sec(p, 'Anzeige');
  item(view, P.bigtext ? 'Große Texte: an' : 'Große Texte: aus', 'Größere Schrift für Tipps und Aufgaben', () => {
    P.bigtext = !P.bigtext;
    applyText();
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
}

// the text size from the profile (also right at the start)
function applyText() {
  document.documentElement.classList.toggle('bigtext', !!P.bigtext);
}
applyText();

// the controls from the profile into the running game (also at the start of every round)
function applyControls() {
  G.autoDig = P.autodig !== false;
  G.jumpBtn = true;
  G.climbOn = !G.autoDig;
  if (!G.climbOn) for (const c of crew) c.climb = c.hangle = false;
}

// helpers switched off (only in free play alone; Versus, multiplayer, levels, the Tagesschacht and
// the tutorial keep their crew): the helper Wühler of your castle leave, what they carry goes into
// the store, and none can be hired (ui.js). Run at every start and resume, and when switched.
function applyHelpers() {
  G.noHelpers = P.helpers === false && soloBoosts();
  if (!G.noHelpers) return;
  for (let k = crew.length - 1; k >= 0; k--) {
    const c = crew[k];
    if (isPlayer(c) || c.bot || c.trapped || c.lost || (c.team || 0) !== (G.myTeam || 0)) continue;
    for (const t of c.inv || []) addStock(t);
    crew.splice(k, 1);
  }
  G.crewKey = '';
}

export { DIFF, applyControls, applyHelpers, applyText, diffOf, settingsSections };
