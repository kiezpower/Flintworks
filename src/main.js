import { tapGotoInput } from './tapgo.js';
import { calcTerr } from './render.js';
import { updHazards } from './hazards.js';
import { goalReached, mode, starsFor } from './modes.js';
import { updBuildFx } from './bfx.js';
import { updMusic } from './music.js';
import { updFloats } from './floats.js';
import { updDecor } from './decor.js';
import { chosenBiome, hideLobby, lobbyFrame, lobbyOpen, showLobby } from './lobby.js';
import { P, finishGame, saveProfile } from './profile.js';
import { biome } from './biomes.js';
import { updAmbience } from './ambience.js';
import { endTutorial, startTutorial, updTutorial } from './tutorial.js';
import { applyStatic, tr } from './i18n.js';
import { openPanel, opt, sec } from './ui.js';
import './style.css';
import { updBuilds, updLorry } from './buildings.js';
import { NOIN, context, doThrow, updClonk } from './clonk.js';
import { addClonk, insideB, sel_ } from './entities.js';
import { gen } from './gen.js';
import { cycleCrew, inp, readInput } from './input.js';
import { helperAI } from './helpers.js';
import { killAnimal, updAnimal, updArrows, updItems, updParts, updTrees } from './objects.js';
import { cam, render, resize } from './render.js';
import { clearSave, hasSave, loadGame, saveGame } from './save.js';
import { simulate } from './sim.js';
import { audioInit } from './sound.js';
import { G, animals, builds, crew, lorries } from './state.js';
import { $, checkHints, closePanel, drawMini, hud, openBuild, panelEl, toast, toastEl, toggleMap } from './ui.js';
import { updWeather } from './weather.js';
import { H, W, clamp, surf } from './world.js';

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
function play(withTutorial) {
  if (withTutorial) {
    clearSave();
    G.inRun = false;
  }
  if (!G.inRun) {
    if (hasSave() && loadGame()) {
      G.crewKey = G.invKey = '';
    } else {
      G.nextBiome = chosenBiome();
      G.nextMode = P.gmode || 'gold';
      G.nextDiff = P.diff || 'adventure';
      gen();
      if (!P.tutorialDone) withTutorial = true;
    }
    resetCam();
    G.inRun = true;
    startGame(withTutorial);
    return;
  }
  G.startT += performance.now() - (G.pauseAt || performance.now());
  startGame('resume');
}
function discard() {
  clearSave();
  G.inRun = false;
}
const lobbyHooks = { play, discard, hasRun, keysHtml };
function menu() {
  showLobby(lobbyHooks);
}
function startGame(withTutorial = false) {
  if (withTutorial === true) startTutorial();
  else if (withTutorial !== 'resume') endTutorial(false);
  audioInit();
  if (G.AC && G.AC.state === 'suspended') G.AC.resume();
  crew[0] && Object.assign(crew[0], { hat: P.hat, cap: P.cap });
  G.autoDig = P.autodig !== false;
  G.sel = 0;
  G.territory = !!P.territory;
  calcTerr();
  G.crewKey = '';
  G.state = 'play';
  hideLobby();
  overlay.hidden = true;
  if (withTutorial !== 'resume') G.startT = performance.now();
  if (!G.tut && withTutorial !== 'resume') toast('Welt: {name}', { name: tr(biome().name) });
}
function endScreen(won) {
  G.state = won ? 'won' : 'lost';
  closePanel();
  clearSave();
  G.inRun = false;
  const s = Math.round((performance.now() - G.startT) / 1000);
  const stars = won ? starsFor(s) : 0;
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
  const l = sec(p, 'Spiel');
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
  item('Lobby', 'Spiel speichern und zur Lobby', () => $('newBtn').click());
}
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
  if (c === crew[0]) toast('{name} ist wieder fit', { name: c.name });
}
function resetCam() {
  const s = crew[0];
  cam.x = clamp(s.x - G.VW / 2, 0, W - G.VW);
  cam.y = clamp(s.y - G.VH / 2, 0, H - G.VH);
}

function step() {
  readInput();
  const paused = !panelEl.hidden;
  if (G.state === 'play' && !paused) {
    G.sel = 0; // you always play your own Wühler; the others work by themselves
    tapGotoInput(crew[0]);
    crew.forEach((c, n) => {
      let I = n === G.sel ? inp : NOIN;
      if (n !== G.sel && !c.dead) I = helperAI(c, n);
      updClonk(c, I);
      if (n === G.sel && !c.dead) {
        doThrow(c, I);
        if (I.actP) {
          const cx = context(c);
          if (cx.fn) cx.fn();
        }
      }
    });
    updBuilds();
    updBuildFx();
    updHazards();
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
    for (const c of crew) if (c.dead && c.deadT > 200) respawn(c);
    updTutorial();
    if (G.frame % 15 === 0) updAmbience();
    if (G.frame % 30 === 0) updDecor();
    if (G.frame % 60 === 0) checkHints();
    if (G.frame % 3600 === 0) saveGame();
    if (goalReached()) endScreen(true);
  }
  if (!paused) {
    updWeather();
    updParts();
    simulate();
  }
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
function loop(t) {
  G.acc += Math.min(100, t - G.last);
  G.last = t;
  let n = 0;
  while (G.acc >= 16.667 && n < 4) {
    step();
    G.acc -= 16.667;
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
  if (G.tick % 5 === 0) hud();
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
if (!window.Capacitor && 'serviceWorker' in navigator && !import.meta.env.DEV) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
if (import.meta.env.DEV) import('./debug.js');

export { card, endScreen, loop, menu, overlay, resetCam, startGame, step };
