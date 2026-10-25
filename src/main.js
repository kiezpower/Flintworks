import { ownWeb } from './platform.js';
import { tapGotoInput } from './tapgo.js';
import { calcTerr } from './render.js';
import { updHazards } from './hazards.js';
import { GAME_MODES, goalReached, mode, starsFor } from './modes.js';
import { updBuildFx } from './bfx.js';
import { updMusic } from './music.js';
import { updFloats } from './floats.js';
import { updDecor } from './decor.js';
import { chosenBiome, hideLobby, lobbyFrame, lobbyOpen, showLobby } from './lobby.js';
import { P, finishGame, saveProfile } from './profile.js';
import { biome } from './biomes.js';
import { updAmbience } from './ambience.js';
import { endTutorial, resumeTutorial, setTutHooks, startTutorial, tutHud, updTutorial } from './tutorial.js';
import { applyStatic, tr } from './i18n.js';
import { openPanel, opt, sec } from './ui.js';
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import './style.css';
import { updBuilds, updLorry } from './buildings.js';
import { NOIN, context, doThrow, updClonk } from './clonk.js';
import { addClonk, insideB, sel_ } from './entities.js';
import { gen } from './gen.js';
import { cycleCrew, readInput } from './input.js';
import { helperAI } from './helpers.js';
import { updBeams } from './mine.js';
import { checkLessons } from './lessons.js';
import { updMissions } from './missions.js';
import { killAnimal, updAnimal, updItems, updParts, updTrees } from './objects.js';
import { updArrows, updCombat } from './combat.js';
import { updResearch } from './research.js';
import { updEvents } from './events.js';
import { recordCampaign, updScenario } from './scenarios.js';
import { cam, render, resize } from './render.js';
import { clearSave, hasSave, loadGame, saveGame } from './save.js';
import { simulate } from './sim.js';
import { audioInit, sfx } from './sound.js';
import { initUiArt } from './uiart.js';
import { G, animals, builds, crew, lorries } from './state.js';
import { $, closePanel, drawMini, hud, openBase, openBuild, panelEl, toast, toastEl, toggleMap } from './ui.js';
import { register, send } from './commands.js';
import { NET, inRoom, onGameMsg, sendTo } from './net/room.js';
import { beginNet, endNet, resumeNet, startMessage } from './net/session.js';
import { clearNetSave, loadNetSave, saveNet } from './net/netsave.js';
import { clientStep } from './net/client.js';
import { hostEnd, hostTick } from './net/host.js';
import { teamOf, useMine, useTeam } from './teams.js';
import { updVehicles } from './vehicles/core.js';
import { playerVehicleTick } from './vehicles/index.js';
import { updEmoBtn } from './net/emotes.js';
import './net/deeplink.js';
import { inputOf, isPlayer } from './players.js';
import { updWeather } from './weather.js';
import { H, H0, W, W0, clamp, dryFresh, surf } from './world.js';

// ---- Screens & loop ----
const overlay = $('overlay'),
  card = $('card');
const TOUCH_KEYS = [
  ['Stick links', 'laufen, klettern, nach oben schnippen = springen; gegen Erde laufen oder runter drücken = graben'],
  ['Tippen rechts', 'dein Wühler läuft dorthin'],
  ['Aktion', 'Fällen, Basis, Truhe, Brücke, Bauen'],
  ['Wurf', 'erscheint mit etwas in der Hand; Stick hoch = Bogen, runter = ablegen'],
];
const DESK_KEYS = [
  ['Pfeile / WASD', 'laufen, klettern, hangeln, schwimmen'],
  ['Leertaste', 'springen'],
  ['Shift / X', 'graben: gerade, mit ↓/↑ schräg'],
  ['E', 'werfen (Q wechselt, 1–5 wählt)'],
  ['F', 'Aktion: Fällen, Basis, Lore, Brücke'],
  ['B · Tab · M', 'Bauen · Wühler wechseln · Karte'],
];
const keyList = (cls, rows) =>
  `<dl class="keys ${cls}">${rows.map(([k, v]) => `<dt>${tr(k)}</dt><dd>${tr(v)}</dd>`).join('')}</dl>`;
const keysHtml = () => `${keyList('touchonly', TOUCH_KEYS)}${keyList('keyonly', DESK_KEYS)}`;
// A run is in progress when a world is loaded or a save is waiting
const hasRun = () => G.inRun || hasSave();
function play(withTutorial, level = null) {
  // in a room: the host starts the round for everybody, the others wait for the host
  if (inRoom() && !G.inRun) {
    if (!NET.host) return toast('Warte auf den Host');
    // the host carries on with a saved shared round
    if (G.resumeNet) {
      G.resumeNet = false;
      if (resumeNet(loadNetSave())) {
        resetCam();
        G.inRun = true;
        startGame('resume');
        return;
      }
      toast('Der Spielstand ließ sich nicht laden');
    }
    const d = startMessage();
    d.biome = chosenBiome() || ['meadow', 'desert', 'winter'][Math.floor(Math.random() * 3)];
    d.gmode = GAME_MODES[P.gmode] && !GAME_MODES[P.gmode].campaign ? P.gmode : 'gold';
    d.diff = P.diff || 'adventure';
    sendTo('all', d);
    playNet(d);
    return;
  }
  if (withTutorial) {
    clearSave();
    G.inRun = false;
  }
  let bonus = 0;
  if (!G.inRun) {
    if (hasSave() && loadGame()) {
      G.crewKey = G.invKey = '';
      if (G.tut) withTutorial = 'loaded'; // a saved tutorial goes on where it was
    } else {
      // the very first game is the tutorial in its own small world (also when asked for)
      if (!P.tutorialDone && !level) withTutorial = true;
      if (withTutorial) level = 'tut';
      const L = level && GAME_MODES[level];
      // start money earned in the tutorial, for the next free game
      bonus = !withTutorial && !L && P.tutBonus ? P.tutBonus : 0;
      G.nextBiome = L ? L.biome : chosenBiome();
      G.nextMode = L ? level : GAME_MODES[P.gmode] ? P.gmode : 'gold';
      G.nextDiff = L ? L.diff || 'adventure' : P.diff || 'adventure';
      G.nextSeed = L ? L.seed : null;
      // tutorial and levels have their own size; free play is 1400 × 400 (or ?size= when developing)
      G.nextSize = L ? L.size || [W0, H0] : null;
      G.nextVersus = false;
      gen();
      G.nextSeed = G.nextSize = null;
      if (bonus) {
        G.money += bonus;
        P.tutBonus = 0;
        saveProfile();
      }
    }
    resetCam();
    G.inRun = true;
    startGame(withTutorial);
    if (bonus) toast('Startgeld aus dem Tutorial: +{n} Taler', { n: bonus });
    return;
  }
  G.startT += performance.now() - (G.pauseAt || performance.now());
  startGame('resume');
}
// a network round: same seed and settings on every device
function playNet(d) {
  clearSave();
  endNet();
  G.nextSeed = d.seed;
  G.nextBiome = d.biome;
  G.nextMode = d.gmode;
  G.nextDiff = d.diff;
  G.nextVersus = !!d.versus;
  G.nextSize = d.size || [W0, H0];
  gen();
  G.nextSeed = G.nextSize = null;
  G.nextVersus = false;
  beginNet(d);
  resetCam();
  G.inRun = true;
  startGame(false);
}
onGameMsg('start', d => {
  if (!NET.host) playNet(d);
});
function discard() {
  clearSave();
  endNet();
  G.inRun = false;
}
const lobbyHooks = { play, discard, hasRun, keysHtml };
setTutHooks({ play, menu, discard });
function menu() {
  showLobby(lobbyHooks);
}
// game tempo: share of the original speed
const TEMPO = { calm: 0.7, normal: 0.85, fast: 1 };
const TEMPO_NAME = { calm: 'Gemütlich', normal: 'Normal', fast: 'Schnell' };
function startGame(withTutorial = false) {
  if (withTutorial === true) startTutorial();
  else if (withTutorial === 'resume' || withTutorial === 'loaded') resumeTutorial();
  else endTutorial();
  audioInit();
  if (G.AC && G.AC.state === 'suspended') G.AC.resume();
  const mine = sel_();
  if (mine) Object.assign(mine, { hat: P.hat, cap: P.cap, name: P.name || mine.name });
  G.autoDig = P.autodig !== false;
  G.climbOn = !!P.climbing;
  G.jumpBtn = P.jumpbtn !== false;
  G.lightFx = P.lightfx !== false;
  G.vibe = P.vibe !== false;
  G.speed = TEMPO[P.tempo || 'normal'] || 0.85;
  if (!G.climbOn) for (const c of crew) c.climb = c.hangle = false;
  const res = P.gfx === 'low' || new URLSearchParams(location.search).get('res') === '1' ? 1 : 2;
  if (res !== G.res) {
    G.res = res;
    resize();
  }
  G.territory = !!P.territory;
  calcTerr();
  G.crewKey = '';
  G.state = 'play';
  hideLobby();
  overlay.hidden = true;
  if (withTutorial !== 'resume') {
    G.startT = performance.now();
    G.playTicks = 0;
  }
  if (!G.tut && withTutorial !== 'resume') toast('Welt: {name}', { name: tr(biome().name) });
}
// a client hears from the host that the round is over (Versus: which team won)
G.onNetEnd = (won, winner) => G.state === 'play' && endScreen(winner == null ? won : winner === G.myTeam);
// the goal: in Versus the first team to reach it wins
function checkGoal() {
  if (!G.teams) {
    if (goalReached()) endScreen(true);
    return;
  }
  let winner = -1;
  G.vs = [];
  for (let t = 0; t < G.teams.length; t++) {
    useTeam(t);
    G.vs[t] = mode().prog();
    if (winner < 0 && goalReached()) winner = t;
  }
  useMine();
  if (winner >= 0) {
    hostEnd(winner === G.myTeam, winner);
    endScreen(winner === G.myTeam);
  }
}
function endScreen(won) {
  if (!G.teams) hostEnd(won);
  if (G.netHost) clearNetSave();
  G.state = won ? 'won' : 'lost';
  if (won) sfx('fanfare');
  closePanel();
  clearSave();
  G.inRun = false;
  // counted in game ticks: a slower tempo or a pause does not cost stars
  const s = Math.round((G.playTicks || 0) / 60);
  const stars = won ? starsFor(s) : 0;
  if (won) recordCampaign(stars);
  const tro = finishGame(won, G.earned || 0, stars);
  const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const M = mode();
  card.innerHTML = won
    ? `<h1>${tr('Geschafft')}</h1><p class="stars">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span></p>
       <p>${tr(M.name)} · ${tr(M.desc, { goal: M.goal })} · ${tr('Zeit {time}', { time })}</p>
       <p class="hint">${tr('3 Sterne unter {a} Min., 2 Sterne unter {b} Min.', { a: M.stars[0], b: M.stars[1] })}</p>`
    : `<h1>${tr('Crew verloren')}</h1><p>${tr('Alle Wühler sind erschöpft und die Kasse reicht für keinen neuen.')}</p>`;
  card.innerHTML += `<p class="trophy-gain">${tr('{n} Trophäen', { n: (tro >= 0 ? '+' : '') + tro })}</p><button class="go" id="goBtn">${tr('Zur Lobby')}</button>`;
  $('goBtn').onclick = () => {
    overlay.hidden = true;
    menu();
  };
  overlay.hidden = false;
}
$('newBtn').addEventListener('click', () => {
  saveGame();
  saveNet();
  G.pauseAt = performance.now();
  closePanel();
  menu();
});
$('buildBtn').addEventListener('click', openBuild);
$('mapBtn').addEventListener('click', toggleMap);
$('zoomBtn').addEventListener('click', () => {
  G.zoomAdj = G.zoomAdj >= 1 ? -1 : G.zoomAdj + 1;
  try {
    localStorage.setItem('wuehlwelt-zoom', G.zoomAdj);
  } catch {}
  resize();
  toast(G.zoomAdj > 0 ? 'Nah' : G.zoomAdj < 0 ? 'Weit' : 'Normal');
});
// one menu button instead of a row of small ones
$('menuBtn').addEventListener('click', openMenu);
$('miniThumb').addEventListener('click', toggleMap);
function openMenu() {
  if (G.state !== 'play') return;
  const p = openPanel('Menü');
  const l = sec(p, tr('Spiel') + ' · v' + __APP_VERSION__);
  const item = (title, sub, fn) => opt(l, { title: tr(title), sub: sub ? tr(sub) : '', short: true, onClick: fn });
  item('Karte', 'Die ganze Welt', () => {
    closePanel();
    toggleMap();
  });
  item('Zoom', G.zoomAdj > 0 ? 'Nah' : G.zoomAdj < 0 ? 'Weit' : 'Normal', () => {
    $('zoomBtn').click();
    openMenu();
  });
  item(G.muted ? 'Ton aus' : 'Ton an', 'Ton', () => {
    $('sndBtn').click();
    openMenu();
  });
  item(
    G.autoDig ? 'Automatisch graben an' : 'Automatisch graben aus',
    'Gegen Erde laufen gräbt. Aus: Graben- und Sprung-Knopf wie früher',
    () => {
      P.autodig = !G.autoDig;
      G.autoDig = P.autodig;
      saveProfile();
      openMenu();
    },
  );
  item(tr('Spieltempo: {t}', { t: tr(TEMPO_NAME[P.tempo || 'normal']) }), 'Gemütlich, Normal oder Schnell', () => {
    const ks = Object.keys(TEMPO);
    P.tempo = ks[(ks.indexOf(P.tempo || 'normal') + 1) % ks.length];
    G.speed = TEMPO[P.tempo];
    saveProfile();
    openMenu();
  });
  if (G.autoDig)
    item(
      G.jumpBtn ? 'Sprung-Knopf an' : 'Sprung-Knopf aus',
      'Eigener Knopf zum Springen, auch beim automatischen Graben',
      () => {
        P.jumpbtn = !G.jumpBtn;
        G.jumpBtn = P.jumpbtn;
        saveProfile();
        openMenu();
      },
    );
  item(G.res === 2 ? 'Grafik: fein' : 'Grafik: schnell', 'Schnell läuft flüssiger auf älteren Handys', () => {
    G.res = G.res === 2 ? 1 : 2;
    P.gfx = G.res === 2 ? 'high' : 'low';
    saveProfile();
    resize();
    openMenu();
  });
  item(G.lightFx ? 'Licht: an' : 'Licht: aus', 'Dämmerung unter Tage, Leuchten und Rahmen ums Bild', () => {
    P.lightfx = !G.lightFx;
    G.lightFx = P.lightfx;
    saveProfile();
    openMenu();
  });
  item(G.vibe ? 'Vibration: an' : 'Vibration: aus', 'Kurzes Rütteln beim Graben, bei Treffern und Sprengungen', () => {
    P.vibe = !G.vibe;
    G.vibe = P.vibe;
    saveProfile();
    openMenu();
  });
  item(G.climbOn ? 'Klettern an' : 'Klettern aus', 'An Wänden hochklettern und an Decken hängen', () => {
    P.climbing = !G.climbOn;
    G.climbOn = P.climbing;
    if (!G.climbOn) for (const c of crew) c.climb = c.hangle = false;
    saveProfile();
    openMenu();
  });
  item('Zurück zur Basis', 'Wenn du feststeckst: dein Wühler geht nach Hause', () => {
    closePanel();
    send('home');
  });
  item('Lobby', 'Spiel speichern und zur Lobby', () => $('newBtn').click());
}
// "back to base" when stuck
register('home', c => {
  if (c.dead) return;
  Object.assign(c, { x: G.base.x + 10, y: G.base.gy - 10, vx: 0, vy: 0, climb: false, hangle: false, tumble: false });
  if (c === sel_()) {
    resetCam();
    toast('{name} ist zurück in der Basis', { name: c.name });
  }
});
$('sndBtn').addEventListener('click', () => {
  G.muted = !G.muted;
  $('sndBtn').classList.toggle('off', G.muted);
  audioInit();
  if (G.AC && G.AC.state === 'suspended') G.AC.resume();
});
function respawn(c) {
  Object.assign(c, {
    dead: false,
    deadT: 0,
    energy: 100,
    breath: 100,
    burn: 0,
    hurt: 0,
    tumble: false,
    vx: 0,
    vy: 0,
    x: G.base.x + 10 + crew.indexOf(c) * 6,
    y: G.base.gy - 10,
  });
  G.crewKey = '';
  if (c === sel_()) toast('{name} ist wieder fit', { name: c.name });
}
function resetCam() {
  const s = sel_();
  if (!s) return;
  cam.x = clamp(s.x - G.VW / 2, 0, W - G.VW);
  cam.y = clamp(s.y - G.VH / 2, 0, H - G.VH);
}

function step() {
  readInput();
  // (a multiplayer game never pauses: the others keep playing)
  const paused = !panelEl.hidden && !G.net;
  if (G.state === 'play' && paused) updTutorial(true);
  if (G.netClient) {
    clientStep(paused);
    stepTail();
    return;
  }
  if (G.state === 'play' && !paused) {
    G.playTicks = (G.playTicks || 0) + 1;
    tapGotoInput(sel_());
    // players are steered by their input (yours from this device), helpers by their own AI
    crew.forEach((c, n) => {
      useTeam(teamOf(c)); // Versus: castle, cash and store of this Wühler's team
      const I = isPlayer(c) ? inputOf(c.pid) : c.dead ? NOIN : helperAI(c, n);
      updClonk(c, I);
      if (isPlayer(c)) playerVehicleTick(c);
      if (isPlayer(c) && !c.dead) {
        G.cmdPid = c.pid; // messages from these actions go to that player
        doThrow(c, I);
        if (I.actP) {
          const cx = context(c);
          if (cx.ui) {
            if (c.pid === G.myId) (cx.ui === 'base' ? openBase : openBuild)();
          } else if (cx.fn) cx.fn();
        }
        G.cmdPid = null;
      }
    });
    useMine();
    updVehicles();
    updBuilds();
    updBuildFx();
    updHazards();
    updBeams();
    updMissions();
    updResearch();
    if (G.frame % 30 === 0) updScenario();
    updEvents();
    updCombat();
    updArrows();
    updItems();
    for (const L of lorries) updLorry(L);
    for (let k = animals.length - 1; k >= 0; k--)
      if (!updAnimal(animals[k])) {
        killAnimal(animals[k]);
        animals.splice(k, 1);
      }
    updTrees();
    updFloats();
    // exhausted Wühler wake up again in the base after a short while
    for (const c of crew)
      if (c.dead && c.deadT > 200) {
        useTeam(teamOf(c));
        respawn(c);
      }
    useMine();
    updTutorial();
    if (G.frame % 15 === 0) updAmbience();
    if (G.frame % 30 === 0) updDecor();
    if (G.frame % 60 === 0) checkLessons();
    if (G.frame % 3600 === 0) G.net ? saveNet() : saveGame();
    checkGoal();
  }
  if (!paused) {
    updWeather();
    updParts();
    dryFresh();
    simulate();
    hostTick();
  }
  stepTail();
}
function stepTail() {
  {
    const s = sel_();
    const tv = !!(s && !s.dead && builds.some(b => b.type === 'tower' && b.done && insideB(s, b)));
    if (tv !== G.towerView) {
      G.towerView = tv;
      resize();
    }
  }
  if (G.toastT > 0 && --G.toastT === 0) toastEl.hidden = true;
}
G.last = performance.now();
G.acc = 0;
G.tick = 0;
// slow device: after a few seconds below ~40 fps switch to the lighter 1× canvas
let perfT = 0,
  perfN = 0,
  perfSlow = 0;
function perfGuard(dt) {
  if (G.res === 1 || G.state !== 'play' || P.gfx === 'high') return;
  perfT += Math.min(dt, 200);
  perfN++;
  if (perfT < 2000) return;
  perfSlow = perfT / perfN > 25 ? perfSlow + 1 : 0;
  perfT = perfN = 0;
  if (perfSlow >= 2) {
    G.res = 1;
    resize();
  }
}
function loop(t) {
  perfGuard(t - G.last);
  G.acc += Math.min(100, t - G.last);
  G.last = t;
  let n = 0;
  // game tempo: the whole simulation runs a bit slower or faster (setting "Spieltempo")
  const dt = 16.667 / (G.speed || 1);
  while (G.acc >= dt && n < 4) {
    step();
    G.acc -= dt;
    n++;
  }
  if (n === 4) G.acc = 0;
  if (lobbyOpen()) lobbyFrame();
  else render();
  {
    const s = sel_();
    updMusic(
      lobbyOpen() ? 'lobby' : s && s.y > surf[Math.max(0, Math.min(W - 1, Math.floor(s.x)))] + 30 ? 'cave' : 'game',
    );
  }
  G.tick++;
  if (G.tick % 5 === 0) {
    hud();
    tutHud();
    updEmoBtn();
  }
  if (G.tick % 10 === 0) drawMini(G.tick % 60 === 0);
  requestAnimationFrame(loop);
}
applyStatic();
gen();
resize();
resetCam();
hud();
overlay.hidden = true;
menu();
requestAnimationFrame(loop);

// Offline mode for the web version; the Android app ships its files itself
// (and not inside other sites like itch.io)
if (ownWeb() && 'serviceWorker' in navigator && !import.meta.env.DEV) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        const b = $('updateBtn');
        b.hidden = false;
        b.onclick = () => update(true);
      },
    });
  });
}
if (import.meta.env.DEV) import('./debug.js');

export { card, endScreen, loop, menu, overlay, resetCam, startGame, step };

initUiArt();
// every button gets a soft click
document.addEventListener(
  'click',
  e => {
    if (e.target.closest && e.target.closest('button')) sfx('click');
  },
  true,
);
