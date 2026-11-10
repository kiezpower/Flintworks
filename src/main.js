// (first: it reads an invitation in the address before anything else changes it)
import './applink.js';
import { ownWeb } from './platform.js';
import { tapGotoInput } from './tapgo.js';
import { calcTerr } from './render.js';
import { updHazards } from './hazards.js';
import { GAME_MODES, goalReached, mode, starsFor } from './modes.js';
import { updBuildFx } from './bfx.js';
import { updMusic } from './music.js';
import { updFloats } from './floats.js';
import { updDecor } from './decor.js';
import { updFort } from './fort.js';
import { checkUpdate, chosenBiome, hideLobby, lobbyFrame, lobbyOpen, showLobby } from './lobby.js';
import { P, finishGame, saveProfile, track } from './profile.js';
import { skinTag } from './skins.js';
import { addCrystals, applyStartBoosts, roundCrystals, setDigBoost } from './camp.js';
import { biome } from './biomes.js';
import { updAmbience } from './ambience.js';
import { endTutorial, resumeTutorial, setTutHooks, startTutorial, tutHud, updTutorial } from './tutorial.js';
import { applyStatic, tr } from './i18n.js';
import { chips, openPanel, opt, sec, setTab } from './ui.js';
import { onTrackerOpen, questBoard } from './questui.js';
import { DIFF, applyControls, applyHelpers, applyPatterns, diffOf, settingsSections } from './settings.js';
import { goHome } from './climb.js';
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import './style.css';
import './onboarding.css';
import './panels.css';
import { ev } from './analytics.js';
import { seasonLine, seasonResult, seasonRoll } from './season.js';
import { playStart, playStop, playing, recStart, recStop, replayAfter, replayTick, savedReplay, worldHash } from './replay.js';
import { closeVeil, openVeil, veilOpen } from './veil.js';
import { startCue, updCue } from './startcue.js';
import { updBuilds, updLorry } from './buildings.js';
import { NOIN, context, doThrow, updDigger } from './digger.js';
import { addDigger, insideB, sel_ } from './entities.js';
import { gen } from './gen.js';
import { cycleCrew, readInput } from './input.js';
import { helperAI } from './helpers.js';
import { botAI } from './bots.js';
import { updBeams } from './mine.js';
import { checkLessons } from './lessons.js';
import { updMissions } from './missions.js';
import { killAnimal, updAnimal, updItems, updParts, updTrees } from './objects.js';
import { updArrows, updCombat } from './combat.js';
import { updResearch } from './research.js';
import { updEvents } from './events.js';
import { ALL_IDS, nextLevel, recordCampaign, updScenario } from './scenarios.js';
import { cam, render, resize } from './render.js';
import { clearSave, hasSave, loadGame, saveGame, savedTut } from './save.js';
import { simulate } from './sim.js';
import { audioInit, sfx } from './sound.js';
import { initUiArt } from './uiart.js';
import { G, animals, builds, crew, lorries, esc, parts, vparts } from './state.js';
import { $, closePanel, drawMini, hud, openBase, openBuild, openUi, panelEl, toast, toastEl, toggleMap } from './ui.js';
import { register, send } from './commands.js';
import { NET, inRoom, onGameMsg, sendTo } from './net/room.js';
import { beginNet, endNet, resumeNet, startMessage } from './net/session.js';
import { clearNetSave, loadNetSave, saveNet } from './net/netsave.js';
import { clientStep } from './net/client.js';
import { hostEnd, hostTick } from './net/host.js';
import './net/countdown.js';
import { TEAM_COLS, teamOf, useMine, useTeam } from './teams.js';
import { updVehicles } from './vehicles/core.js';
import { playerVehicleTick } from './vehicles/index.js';
import { updEmoBtn } from './net/emotes.js';
import { updScoreBtn } from './scoreboard.js';
import { updWatch } from './net/watch.js';
import { localSetup, localTick } from './local.js';
import { updFire } from './fire.js';
import { bossTick } from './boss.js';
import { updFishing } from './fishing.js';
import { merchantMove, merchantTick } from './merchant.js';
import { updFarm } from './farm.js';
import { roamTick } from './nights.js';
import { villageMove, villageTick } from './villagers.js';
import './net/deeplink.js';
import { inputOf, isPlayer } from './players.js';
import { updWeather } from './weather.js';
import { seasonName } from './seasons.js';
import { guardTick, shrineTick } from './shrines.js';
import { zoneTick } from './zones.js';
import { potionTick } from './potions.js';
import { fogTick } from './fog.js';
import { tombTick } from './tombs.js';
import { stormTick } from './storms.js';
import { descendTick } from './descend.js';
import { torchTick } from './torches.js';
import { chestTick, updVersus, vsResult } from './versus.js';
import { updCoop } from './coop.js';
import { statsHtml } from './stats.js';
import { addButtonsHtml, wireAddButtons } from './lobbyfriends.js';
import { dayNo, endCard, shareAndTell } from './daily.js';
import { H, H0, W, W0, clamp, dryFresh, getSeed, setSeed, surf } from './world.js';

// ---- Screens & loop ----
const overlay = $('overlay'),
  card = $('card');
const TOUCH_KEYS = [
  ['Stick links', 'laufen, klettern, nach oben schnippen = springen; gegen Erde laufen oder runter drücken = graben'],
  ['Tippen rechts', 'dein Wühler läuft dorthin'],
  ['Aktion', 'Fällen, Burg (Laden), Truhe, Brücke, Bauen'],
  ['Wurf', 'erscheint mit etwas in der Hand; tippen wirft (Stick hoch = Bogen, runter = ablegen), Knopf ziehen zielt'],
  ['Haken', 'mit dem Enterhaken (Burg oder für immer im Heimatbergwerk): wirft ihn in Stick-Richtung, sonst an die nächste Kante'],
];
const DESK_KEYS = [
  ['Pfeile / WASD', 'laufen, klettern, hangeln, schwimmen'],
  ['Leertaste', 'springen'],
  ['Shift / X', 'graben: gerade, mit ↓/↑ schräg'],
  ['E', 'werfen (Q wechselt, 1–9 wählt)'],
  ['F', 'Aktion: Fällen, Burg (Laden), Lore, Brücke'],
  ['I', 'Tasche öffnen'],
  ['G', 'Enterhaken: G halten zielt zum Mauszeiger, loslassen wirft (oder Pfeiltaste + G; Burg oder für immer im Heimatbergwerk)'],
  ['B · Tab · M', 'Bauen · Wühler wechseln · Karte'],
  ['Esc', 'Menü'],
];
const keyList = (cls, rows) =>
  `<dl class="keys ${cls}">${rows.map(([k, v]) => `<dt>${tr(k)}</dt><dd>${tr(v)}</dd>`).join('')}</dl>`;
const keysHtml = () => `${keyList('touchonly', TOUCH_KEYS)}${keyList('keyonly', DESK_KEYS)}`;
// A run is in progress when a world is loaded or a save is waiting
const hasRun = () => G.inRun || hasSave();
function play(withTutorial, level = null, veil = false) {
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
    // (a quick play room plays its mode of the hour)
    const d = startMessage(
      NET.auto ? NET.auto.gmode : GAME_MODES[P.gmode] && !GAME_MODES[P.gmode].campaign ? P.gmode : 'gold',
    );
    d.biome = chosenBiome() || ['meadow', 'desert', 'winter'][Math.floor(Math.random() * 3)];
    d.diff = P.diff || 'adventure';
    sendTo('all', d);
    playNet(d);
    return;
  }
  if (withTutorial) {
    clearSave();
    G.inRun = false;
  }
  let bonus = 0,
    boost = 0;
  if (!G.inRun) {
    if (hasSave() && loadGame()) {
      G.crewKey = G.invKey = '';
      if (G.tut) withTutorial = 'loaded'; // a saved tutorial goes on where it was
    } else {
      // the very first game is the tutorial in its own small world (also when asked for)
      if (!P.tutorialDone && !level) withTutorial = true;
      if (withTutorial) level = 'tut';
      const L = level && GAME_MODES[level];
      // a campaign level stays chosen in the lobby for next time
      if (ALL_IDS.includes(level) && P.gmode !== level) {
        P.gmode = level;
        saveProfile();
      }
      // start money earned in the tutorial, for the next free game
      bonus = !withTutorial && !L && P.tutBonus ? P.tutBonus : 0;
      G.nextBiome = L ? L.biome : chosenBiome();
      G.nextMode = L ? level : GAME_MODES[P.gmode] ? P.gmode : 'gold';
      G.nextDiff = L ? L.diff || 'adventure' : P.diff || 'adventure';
      G.nextSeed = L ? L.seed : null;
      // tutorial and levels have their own size; free play is 1400 × 400 (or ?size= when developing)
      G.nextSize = L ? L.size || [W0, H0] : null;
      G.nextVersus = false;
      // (two at one device: the goals grow as for two in Koop, local.js)
      G.nextNp = G.local && !withTutorial && !L ? 2 : 1;
      gen();
      G.nextSeed = G.nextSize = null;
      // Heimatbergwerk upgrades (free play alone only, camp.js)
      if (!withTutorial) boost = applyStartBoosts();
      if (bonus) {
        G.money += bonus;
        P.tutBonus = 0;
        saveProfile();
      }
    }
    resetCam();
    G.inRun = true;
    // first launch: the world waits behind the start screen for the first key or tap
    if (veil) {
      const go = withTutorial;
      G.tutEntry = 'first_launch';
      hideLobby();
      overlay.hidden = true;
      openVeil(() => startGame(go), go === 'loaded');
      return;
    }
    startGame(withTutorial);
    if (bonus) toast('Startgeld aus dem Tutorial: +{n} Taler', { n: bonus });
    else if (boost) toast('Startkasse aus dem Heimatbergwerk: +{n} Taler', { n: boost });
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
  G.nextFfa = d.ffa || 0;
  G.nextVsMin = d.vsMin || null;
  G.nextNp = d.np || (d.players && d.players.length) || 1;
  G.nextSize = d.size || [W0, H0];
  gen();
  G.nextSeed = G.nextSize = G.nextVsMin = null;
  G.nextVersus = false;
  G.nextFfa = 0;
  beginNet(d);
  resetCam();
  G.inRun = true;
  startGame(false);
}
// the countdown of a quick play room is over (net/countdown.js): the host starts the round
G.autoPlay = () => {
  if (G.inRun && G.net) return;
  G.inRun = false;
  overlay.hidden = true;
  closePanel();
  play(false);
};
onGameMsg('start', d => {
  if (!NET.host) playNet(d);
});
function discard() {
  clearSave();
  endNet();
  G.inRun = false;
}
const lobbyHooks = { play, discard, hasRun, keysHtml };
setTutHooks({ play, menu, discard, save: saveGame });
function menu() {
  // leaving a running real round for the lobby (analytics: where rounds are given up)
  if (G.state === 'play' && G.inRun && !G.tut)
    ev('round_quit', { mode: String(G.mode), sec: Math.round((G.playTicks || 0) / 60), earned: G.earned || 0 });
  // (a new version waited for the round to end: the game is saved, load it now)
  if (G.updateReady) return G.updateReady();
  showLobby(lobbyHooks);
}
function startGame(withTutorial = false) {
  if (withTutorial === true) startTutorial(G.tutEntry || 'replay');
  else if (withTutorial === 'resume' || withTutorial === 'loaded') resumeTutorial();
  else endTutorial();
  G.tutEntry = null;
  // a new real round (the first one after the tutorial is marked)
  if (!withTutorial && !G.tut) {
    ev('core_round_start', { mode: String(G.mode), after_onb: !!G.afterOnb });
    G.afterOnb = false;
    // the goal as a banner, an arrow to the nearest gold (startcue.js)
    G.cueNext = true;
    G.castleSeen = false;
    // the Tagesschicht is written down to watch it again (replay.js); a playback is not
    if (G.mode === 'daily' && !G.net && !playing()) recStart(G.daily?.n ?? dayNo());
    if (playing()) toast('Wiederholung – deine Eingaben zählen hier nicht');
  }
  audioInit();
  if (G.AC && G.AC.state === 'suspended') G.AC.resume();
  const mine = sel_();
  if (mine) Object.assign(mine, { hat: P.hat, cap: P.cap, skin: skinTag(P.outfit, P.bstyle, P.gear), name: P.name || mine.name });
  // your castle in your building style (alone; in a room the host sets it, net/session.js)
  if (!G.net && G.base && !G.tut) G.base.skin = P.bstyle;
  setDigBoost();
  applyHelpers();
  applyControls();
  G.lightFx = P.lightfx !== false;
  G.vibe = P.vibe !== false;
  applyPatterns();
  G.speed = DIFF[diffOf(P.diff)].speed;
  const res = P.gfx === 'low' || new URLSearchParams(location.search).get('res') === '1' ? 1 : 2;
  if (res !== G.res) {
    G.res = res;
    resize();
  }
  // building areas are a rule of the mode (Siedler and levels that ask for them), the same for everyone
  G.territory = !!mode().territory;
  calcTerr();
  G.crewKey = '';
  G.state = 'play';
  localSetup();
  hideLobby();
  overlay.hidden = true;
  if (withTutorial !== 'resume') {
    G.startT = performance.now();
    G.playTicks = 0;
  }
  if (!G.tut && withTutorial !== 'resume') toast('Welt: {name}', { name: tr(biome().name) + (seasonName() ? ' · ' + tr(seasonName()) : '') });
}
// a client hears from the host that the round is over (Versus: which team won, -2 a draw)
G.onNetEnd = (won, winner, why, stats) => {
  if (G.state !== 'play') return;
  if (G.mp && stats) G.mp.stats = stats;
  endScreen(winner == null ? won : winner === G.myTeam, why, winner);
};
// a hand-built level ends early: won by a trigger, or lost (crew gone, time up) with a reason
G.onLevelEnd = (won, why) => G.state === 'play' && endScreen(won, why);
// the goal: in Versus the first team to reach it wins, or the one that storms the other
// castle, or the one further ahead when the clock runs out (versus.js)
function checkGoal() {
  if (!G.teams) {
    if (goalReached()) endScreen(true);
    return;
  }
  G.vs = [];
  for (let t = 0; t < G.teams.length; t++) {
    useTeam(t);
    G.vs[t] = mode().prog();
  }
  useMine();
  const r = vsResult();
  if (r) {
    hostEnd(r.winner === G.myTeam, r.winner, r.why, G.mp.stats);
    endScreen(r.winner === G.myTeam, r.why, r.winner);
  }
}
// winner: in Versus the team that won (-2: a draw)
// the end of a playback (replay.js): nothing counts, the card says how it ended
function replayEnd() {
  const p = playStop(),
    same = !!p && (G.earned || 0) === p.earned && worldHash() === p.hash;
  G.state = 'won';
  closePanel();
  clearSave();
  G.inRun = false;
  card.innerHTML = `<h1>${tr('Wiederholung zu Ende')}</h1>
    <p class="dl-big">${tr('{n} Taler', { n: G.earned || 0 })}</p>
    <p class="hint">${tr(same ? 'Genau wie in deiner Runde' : 'Diese Wiederholung weicht von deiner Runde ab')}</p>
    <button class="go" id="replayAgain">${tr('Nochmal ansehen')}</button>`;
  overlay.hidden = false;
  card.dataset.replay = same ? 'same' : 'differs';
  $('replayAgain').onclick = () => watchReplay();
}
// watch the kept run of the Tagesschicht (end card, daily panel)
function watchReplay() {
  const d = savedReplay();
  if (!d) return toast('Keine Wiederholung gespeichert');
  discard();
  overlay.hidden = true;
  playStart(d);
  G.daily = { n: d.day };
  play(false, 'daily');
}
G.watchReplay = watchReplay;
G.hasReplay = n => {
  const d = savedReplay();
  return !!d && (n == null || d.day === n);
};
function endScreen(won, why, winner = null) {
  if (G.replaying) return replayEnd();
  if (!G.teams) hostEnd(won, null, why, G.mp && G.mp.stats);
  if (G.netHost) clearNetSave();
  G.state = won ? 'won' : 'lost';
  if (won) sfx('fanfare');
  closePanel();
  clearSave();
  G.inRun = false;
  // counted in game ticks: a slower tempo or a pause does not cost stars
  const s = Math.round((G.playTicks || 0) / 60);
  const M = mode();
  // the Tagesschicht: medals instead of stars, the result kept for today (daily.js); the run is
  // kept to watch it again (replay.js)
  const D = M.daily ? endCard() : null;
  const kept = M.daily && recStop();
  const stars = D ? D.stars : won ? starsFor(s) : 0;
  if (won) recordCampaign(stars, s);
  if (won && stars === 3 && !G.net) track('stars3');
  const tro = finishGame(won, G.earned || 0, stars);
  ev('round_end', { mode: String(G.mode), won: !!won, sec: s, earned: G.earned || 0, games: P.games || 0, net: !!G.net });
  // crystals for the Heimatbergwerk: in every mode (Tagesschicht: the medal counts, not the win)
  const kri = addCrystals(roundCrystals(G.earned, D ? false : won, D ? D.stars : 0));
  const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (D) card.innerHTML = D.html;
  else if (G.teams || winner != null) {
    // Versus: victory, defeat or a draw, with the reason
    const draw = winner === -2;
    card.innerHTML = `<h1>${tr(draw ? 'Unentschieden' : won ? 'Sieg!' : 'Niederlage')}</h1>
      <p>${esc(tr(why || ''))}</p><p class="hint">${tr(M.name)} · ${tr('Zeit {time}', { time })}</p>`;
    // the season of the month: points and rank (season.js; with bots or with people alike)
    if (G.teams) card.innerHTML += `<p class="season-gain">${esc(seasonLine(seasonResult(draw ? 'draw' : won ? 'win' : 'loss')))}</p>`;
  } else
    card.innerHTML = won
      ? `<h1>${tr('Geschafft')}</h1><p class="stars">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span></p>
       <p>${tr(M.name)} · ${tr(M.desc, { goal: M.goal })} · ${tr('Zeit {time}', { time })}</p>
       <p class="hint">${tr('3 Sterne unter {a} Min., 2 Sterne unter {b} Min.', { a: M.stars[0], b: M.stars[1] })}</p>`
      : `<h1>${tr(why ? 'Level verloren' : 'Crew verloren')}</h1><p>${esc(tr(why || 'Alle Wühler sind erschöpft und die Kasse reicht für keinen neuen.'))}</p>`;
  // multiplayer: who did what, with awards
  if (G.net) card.innerHTML += statsHtml(G.mp && G.mp.stats, G.teams ? TEAM_COLS : null) + addButtonsHtml();
  // after a won campaign level: straight on to the next one
  const next = won && !G.net && nextLevel(G.mode);
  card.innerHTML += `<p class="trophy-gain">${tr('{n} Trophäen', { n: (tro >= 0 ? '+' : '') + tro })}</p>`;
  if (kri) card.innerHTML += `<p class="crystal-gain">${tr('+{n} Kristalle', { n: kri })}</p>`;
  if (D) card.innerHTML += `<button class="go" id="shareBtn">${tr('Ergebnis teilen')}</button>`;
  if (kept) card.innerHTML += `<button class="go" id="watchBtn">${tr('Wiederholung ansehen')}</button>`;
  if (next) card.innerHTML += `<button class="go" id="nextBtn">${tr('Nächstes Level: {name}', { name: tr(GAME_MODES[next].name) })}</button>`;
  // multiplayer: the host starts the next round for everybody with the same settings
  const again = G.net && inRoom();
  if (again && NET.host) card.innerHTML += `<button class="go" id="againBtn">${tr('Revanche!')}</button>`;
  else if (again) card.innerHTML += `<p class="hint">${tr('Der Host kann gleich eine Revanche starten')}</p>`;
  // free play alone: straight into a new round is the main way on, the lobby the quiet one
  const solo = !G.net && !M.campaign && !M.daily;
  if (solo) card.innerHTML += `<button class="go" id="soloBtn">${tr(won ? 'Neue Runde' : 'Nochmal')}</button>`;
  card.innerHTML += `<button class="go${next || D || solo || (again && NET.host) ? ' alt' : ''}" id="goBtn">${tr('Zur Lobby')}</button>`;
  $('goBtn').onclick = () => {
    overlay.hidden = true;
    menu();
  };
  wireAddButtons(card);
  if (again && NET.host)
    $('againBtn').onclick = () => {
      overlay.hidden = true;
      play(false);
    };
  if (solo)
    $('soloBtn').onclick = () => {
      overlay.hidden = true;
      play(false);
    };
  if (D) $('shareBtn').onclick = () => shareAndTell(G.daily?.n ?? dayNo());
  if (kept) $('watchBtn').onclick = () => watchReplay();
  if (next)
    $('nextBtn').onclick = () => {
      overlay.hidden = true;
      play(false, next);
    };
  overlay.hidden = false;
  // the first button has the focus: Enter goes on
  card.querySelector('button')?.focus({ preventScroll: true });
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
  // what to do in this round first, then the same settings as in the lobby
  // (the map opens from the small map in the corner, or M)
  const l = sec(p, tr('Spiel') + ' · v' + __APP_VERSION__);
  // in the tutorial the menu is counted (opened, and what was chosen) to see where players leave
  const tut = !!G.tut;
  if (tut) ev('onb_menu', { action: 'open' });
  const item = (title, sub, fn, id) =>
    opt(l, {
      title: tr(title),
      sub: sub ? tr(sub) : '',
      short: true,
      onClick: () => {
        if (tut && id) ev('onb_menu', { action: id });
        fn();
      },
    });
  // the keyboard way to skip the tutorial (Esc opens this menu)
  if (tut)
    item('Tutorial überspringen', 'Direkt ins Spiel – die Tipps erklären den Rest', () => {
      closePanel();
      endTutorial('skip', 'menu');
    }, 'skip');
  item('Lobby', 'Spiel speichern und zur Lobby', () => $('newBtn').click(), 'lobby');
  item('Zurück zur Basis', 'Wenn du feststeckst: dein Wühler geht nach Hause', () => {
    closePanel();
    send('home');
  }, 'home');
  item('Zoom', G.zoomAdj > 0 ? 'Nah' : G.zoomAdj < 0 ? 'Weit' : 'Normal', () => {
    $('zoomBtn').click();
    openMenu();
  });
  settingsSections(p, openMenu, { game: l });
  // the task board (also opened by a tap on the task tracker under the money), not in the tutorial
  if (!tut) {
    const q = sec(p, 'Aufgaben');
    q.className = 'qwrap';
    questBoard(q, openMenu);
    // (the board comes right after the game section)
    l.after(q.previousElementSibling, q);
    chips(p);
  }
}
onTrackerOpen(() => {
  if (G.state !== 'play' || G.tut) return;
  setTab('Menü', 'Aufgaben');
  openMenu();
});
// "back to base" when stuck
register('home', c => {
  if (c.dead) return;
  goHome(c);
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
  // (a panel the second player at one device opened acts for him until it is closed: what was
  // picked in it has run by now, commands.js)
  if (panelEl.hidden) G.panelPid = null;
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
    // a Tagesschicht run is written down, or played back (replay.js)
    replayTick();
    // players are steered by their input (yours from this device), bots by their own mind,
    // helpers by their AI
    crew.forEach((c, n) => {
      useTeam(teamOf(c)); // Versus: castle, cash and store of this Wühler's team
      const I = c.dead ? (isPlayer(c) ? inputOf(c.pid) : NOIN) : c.bot ? botAI(c, n) : isPlayer(c) ? inputOf(c.pid) : helperAI(c, n);
      updDigger(c, I);
      if (isPlayer(c)) playerVehicleTick(c);
      if (isPlayer(c) && !c.dead) {
        G.cmdPid = c.pid; // messages from these actions go to that player
        doThrow(c, I);
        if (I.actP) {
          const cx = context(c);
          if (cx.ui) {
            // (two at one device: the second player opens the castle or the build menu for
            // himself, local.js; what he picks there is his)
            if (c.pid === G.myId || (G.local && !G.net && c.pid === 1)) {
              G.panelPid = c.pid === G.myId ? null : c.pid;
              openUi(cx.ui);
            }
          } else if (cx.fn) cx.fn();
        }
        G.cmdPid = null;
      }
    });
    useMine();
    localTick();
    updVehicles();
    updBuilds();
    updFort();
    updFishing();
    shrineTick();
    guardTick(); // (the shrines' guardians keep to their halls)
    if (G.frame % 30 === 0) zoneTick(); // (the cave biomes, zones.js)
    potionTick();
    merchantMove();
    updFarm();
    villageMove();
    updBuildFx();
    updHazards();
    updBeams();
    updMissions();
    updResearch();
    if (G.frame % 30 === 0) updScenario();
    if (G.frame % 30 === 0) bossTick();
    if (G.frame % 30 === 0) merchantTick();
    if (G.frame % 30 === 0) roamTick();
    if (G.frame % 30 === 0) villageTick();
    // how deep the own Wühler has been, for an achievement (achievements.js)
    if (G.frame % 60 === 0) {
      const me = sel_();
      if (me && !me.dead && !G.tut) track('deep', Math.round((me.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.round(me.x + 3)))]) / 4), true);
    }
    updEvents();
    updCombat();
    updArrows();
    updVersus();
    updCoop();
    if (G.frame % 30 === 0) chestTick();
    updItems();
    for (const L of lorries) updLorry(L);
    for (let k = animals.length - 1; k >= 0; k--)
      if (!updAnimal(animals[k])) {
        killAnimal(animals[k]);
        animals.splice(k, 1);
      }
    updTrees();
    updFloats();
    if (G.frame % 30 === 0) tombTick(); // (gravestones, tombs.js)
    if (G.frame % 30 === 0) descendTick(); // (the last digging spot, descend.js)
    if (G.frame % 30 === 0) torchTick(); // (torches whose wall is gone fall off)
    // exhausted Wühler wake up again in the base after a short while
    for (const c of crew)
      if (c.dead && c.deadT > 200) {
        useTeam(teamOf(c));
        respawn(c);
      }
    useMine();
    updTutorial();
    // (the start cue begins on the first tick, when the camera and the HUD are in place)
    if (G.cueNext) {
      G.cueNext = false;
      startCue();
    }
    updCue();
    if (G.frame % 15 === 0) updAmbience();
    if (G.frame % 30 === 0) updDecor();
    if (G.frame % 60 === 0) checkLessons();
    if (G.frame % 3600 === 0) G.net ? saveNet() : saveGame();
    checkGoal();
  }
  if (!paused) {
    updWeather();
    stormTick(cam); // (sand and snow storms, storms.js)
    updParts();
    dryFresh();
    simulate();
    updFire();
    hostTick();
  }
  replayAfter();
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
// slow device: after several seconds of choppy frames switch to the lighter 1× canvas. Only
// when the device really cannot keep up: a stall (app or tab in the background, loading a world,
// garbage collection) is skipped, and a screen or battery saver that hands out only 30 frames a
// second (iOS Low Power Mode, Android power saving) is no reason as long as each frame's own work
// is quick – otherwise the Wühler suddenly turned coarse in the middle of a round.
let perfT = 0,
  perfN = 0,
  perfW = 0,
  perfSlow = 0,
  workMs = 0;
function perfGuard(dt) {
  if (G.res === 1 || G.state !== 'play' || P.gfx === 'high' || document.hidden) return;
  if (dt > 120) return;
  perfT += dt;
  perfW += workMs;
  perfN++;
  if (perfT < 2000) return;
  const frame = perfT / perfN,
    work = perfW / perfN;
  perfSlow = frame > 45 || (frame > 25 && work > 14) ? perfSlow + 1 : 0;
  perfT = perfN = perfW = 0;
  if (perfSlow >= 3) {
    perfSlow = 0;
    G.res = 1;
    resize();
    toast('Grafik auf „schnell“ gestellt, damit es flüssig läuft (Einstellungen)');
  }
}
// what a frame costs, averaged over half a second: frames per second, the time of one game step
// and of drawing (G.perf; ?fps shows it in a corner, the browser tests and the profile read it)
let perfLast = performance.now(),
  pm = { n: 0, frame: 0, step: 0, draw: 0 };
G.perf = { fps: 0, step: 0, draw: 0, frame: 0 };
const fpsEl = new URLSearchParams(location.search).has('fps') ? document.createElement('div') : null;
if (fpsEl) {
  fpsEl.style.cssText =
    'position:fixed;left:4px;bottom:4px;z-index:99;font:11px monospace;color:#fff;background:#0009;padding:2px 5px;pointer-events:none';
  document.body.appendChild(fpsEl);
}
function perfMeter(frame, step, draw) {
  if (frame > 250) return;
  pm.n++;
  pm.frame += frame;
  pm.step += step;
  pm.draw += draw;
  if (pm.frame < 500) return;
  const r = v => Math.round((v / pm.n) * 10) / 10;
  G.perf = { fps: Math.round((1000 * pm.n) / pm.frame), frame: r(pm.frame), step: r(pm.step), draw: r(pm.draw) };
  pm = { n: 0, frame: 0, step: 0, draw: 0 };
  if (fpsEl) fpsEl.textContent = `${G.perf.fps} fps · Schritt ${G.perf.step} ms · Bild ${G.perf.draw} ms`;
}
function loop(t) {
  perfGuard(t - G.last);
  const t0 = performance.now();
  G.acc += Math.min(100, t - G.last);
  G.last = t;
  let n = 0;
  // game tempo: the whole simulation runs a bit slower or faster (the difficulty, settings.js DIFF)
  const dt = 16.667 / (G.speed || 1);
  while (G.acc >= dt && n < 4) {
    step();
    G.acc -= dt;
    n++;
  }
  if (n === 4) G.acc = 0;
  const t1 = performance.now();
  // Drawing and the HUD come after the ticks and must not change the game: the random numbers
  // they draw are given back afterwards, and the particles they make go to their own list,
  // moved once per picture (vparts). So a device that draws more or fewer pictures still plays
  // the same game (replay.js).
  const seed0 = getSeed(),
    nParts = parts.length;
  // (G.drawEvery: the browser tests draw only every few frames, debug.js – the game itself
  // still runs at full pace)
  if (G.drawEvery > 1 && G.tick % G.drawEvery) {
    // skip this picture
  } else if (lobbyOpen()) lobbyFrame();
  else render();
  perfMeter(t - perfLast, (t1 - t0) / Math.max(1, n), performance.now() - t1);
  perfLast = t;
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
    updScoreBtn();
    updWatch();
  }
  if (G.tick % 10 === 0) {
    if (G.state === 'play') fogTick(); // (what the map knows, fog.js)
    drawMini(G.tick % 60 === 0);
  }
  if (parts.length > nParts) vparts.push(...parts.splice(nParts));
  if (vparts.length > 1500) vparts.splice(0, vparts.length - 1500);
  updParts(vparts, true);
  setSeed(seed0);
  workMs = performance.now() - t0;
  requestAnimationFrame(loop);
}
G.openMenu = openMenu;
applyStatic();
// a new month: the last season's rank pays crystals (season.js)
{
  const paid = seasonRoll();
  if (paid) setTimeout(() => toast('Saison vorbei: {rank} – +{n} Kristalle', { rank: tr(paid.rank), n: paid.kri }), 1500);
}
gen();
resize();
resetCam();
hud();
overlay.hidden = true;
// a brand-new player starts in the tutorial world, not in the lobby (veil.js); links to the
// Tagesschicht, a room or a level draft, and players who already played, get the lobby
const linked = ['daily', 'room', 'draft', 'lvl'].some(k => new URLSearchParams(location.search).has(k));
// (a tutorial saved before v1.52.0 has another world and other steps: it starts afresh)
const oldTut = savedTut();
if (oldTut && !oldTut.run) clearSave();
if (!P.tutorialDone && !(P.games > 0) && !linked && (!hasSave() || savedTut())) play(false, null, true);
else menu();
// an invitation that opens the app while the start screen waits: to the lobby and the room
// (also on the start screen, which skips the lobby: an old offline copy updates itself)
checkUpdate();
G.onInvited = () => {
  if (!veilOpen()) return;
  closeVeil();
  discard();
  menu();
};
requestAnimationFrame(loop);

// Offline mode for the web version; the Android app ships its files itself
// (and not inside other sites like itch.io)
if (ownWeb() && 'serviceWorker' in navigator && !import.meta.env.DEV) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    // a new version is ready: outside a running round it is loaded at once (start screen, lobby,
    // end card), in a round the button offers it and the next visit to the lobby loads it – so
    // nobody keeps playing an old offline copy without noticing
    const update = registerSW({
      immediate: true,
      // look for a new version right away and then every hour (an installed web app on a phone
      // is rarely reloaded, so the browser's own check is not enough)
      onRegisteredSW(url, r) {
        if (!r) return;
        r.update().catch(() => {});
        setInterval(() => r.update().catch(() => {}), 3600 * 1000);
      },
      onNeedRefresh() {
        if (G.state !== 'play') return update(true);
        G.updateReady = () => update(true);
        const b = $('updateBtn');
        b.hidden = false;
        b.onclick = () => update(true);
      },
    });
  });
}
if (import.meta.env.DEV) import('./debug.js');
// a level from the editor (its "Probespielen" button opens ?draft=1) or from a link (?lvl=…),
// checked before it is played (levels/share.js)
{
  const q = new URLSearchParams(location.search);
  if (q.has('draft')) import('./levels/draft.js').then(m => m.playDraft(lobbyHooks));
  else if (q.get('lvl')) import('./levels/draft.js').then(m => m.playShared(q.get('lvl'), lobbyHooks));
}

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
