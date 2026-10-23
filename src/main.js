import './style.css';
import { updBuilds, updLorry } from './buildings.js';
import { NOIN, context, doThrow, updClonk } from './clonk.js';
import { addClonk, insideB, sel_ } from './entities.js';
import { gen } from './gen.js';
import { cycleCrew, followAI, inp, readInput } from './input.js';
import { killAnimal, updAnimal, updArrows, updItems, updParts, updTrees } from './objects.js';
import { cam, render, resize } from './render.js';
import { clearSave, hasSave, loadGame, saveGame } from './save.js';
import { simulate } from './sim.js';
import { audioInit } from './sound.js';
import { G, animals, builds, crew, lorries } from './state.js';
import {
  $,
  checkHints,
  closePanel,
  drawMini,
  hud,
  openBuild,
  panelEl,
  toast,
  toastEl,
  toggleMap,
} from './ui.js';
import { updWeather } from './weather.js';
import { GOAL, H, W, clamp } from './world.js';

// ---- Screens & loop ----
const overlay = $('overlay'),
  card = $('card');
function menu() {
  card.innerHTML = `<h1>Flintworks</h1>
  <p>Führe deine Crew: fällt Bäume, grabt nach Gold, baut Gebäude und verkauft alles an der Heimatbasis. Ziel sind ${GOAL} Taler.</p>
  <dl class="keys touchonly"><dt>Stick links</dt><dd>laufen, klettern, Grabrichtung; nach oben schnippen = springen</dd><dt>Graben</dt><dd>halten oder kurz tippen zum Dauergraben; gräbt gerade; Stick schräg runter/hoch gräbt schräg</dd><dt>Wurf</dt><dd>Stick hoch = Bogen, runter = ablegen</dd><dt>Aktion</dt><dd>Fällen, Basis, Lore, Brücke, Bauen</dd><dt>Oben links</dt><dd>Wühler wechseln</dd></dl>
  <dl class="keys keyonly"><dt>Pfeile / WASD</dt><dd>laufen, klettern, hangeln, schwimmen</dd><dt>Leertaste</dt><dd>springen</dd><dt>Shift / X</dt><dd>graben: gerade, mit ↓/↑ schräg</dd><dt>E</dt><dd>werfen (Q wechselt, 1–5 wählt)</dd><dt>F</dt><dd>Aktion: Fällen, Basis, Lore, Brücke</dd><dt>B · Tab · M</dt><dd>Bauen · Wühler wechseln · Karte</dd></dl>
  <p class="hint">Baue eine Produktionskette: Holz → Bretter, Erz + Kohle → Metall, Windräder für Strom. Feuersteine sprengen Fels. Lehm baut Brücken. Lava und Säure meiden, Monster lauern in der Tiefe.</p>
  <p class="hint touchonly">Im Querformat spielt es sich am besten.</p>
  <div class="btnrow">${hasSave() ? '<button class="go" id="contBtn">Weiterspielen</button><button class="ghost" id="goBtn">Neue Welt</button>' : '<button class="go" id="goBtn">Losgraben</button>'}</div>
  <p class="hint">Der Spielstand wird in diesem Browser gespeichert.</p>`;
  $('goBtn').onclick = () => {
    if (hasSave()) {
      if (performance.now() - G.newArmed > 3000) {
        G.newArmed = performance.now();
        $('goBtn').textContent = 'Sicher? Nochmal tippen';
        return;
      }
      clearSave();
      gen();
      resetCam();
    }
    startGame();
  };
  if ($('contBtn'))
    $('contBtn').onclick = () => {
      if (loadGame()) {
        resetCam();
        G.crewKey = '';
        G.invKey = '';
      }
      startGame();
    };
  overlay.hidden = false;
}
function startGame() {
  audioInit();
  if (G.AC && G.AC.state === 'suspended') G.AC.resume();
  if (G.state === 'won' || G.state === 'lost') {
    gen();
    resetCam();
  }
  G.state = 'play';
  overlay.hidden = true;
  G.startT = performance.now();
}
function endScreen(won) {
  G.state = won ? 'won' : 'lost';
  closePanel();
  clearSave();
  const s = Math.round((performance.now() - G.startT) / 1000);
  card.innerHTML = won
    ? `<h1>Geschafft</h1><p>${GOAL} Taler in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} Minuten.</p><button class="go" id="goBtn">Neue Welt</button>`
    : `<h1>Crew verloren</h1><p>Alle Wühler sind erschöpft und die Kasse reicht für keinen neuen.</p><button class="go" id="goBtn">Neue Welt</button>`;
  $('goBtn').onclick = startGame;
  overlay.hidden = false;
}
G.newArmed = 0;
$('newBtn').addEventListener('click', () => {
  if (performance.now() - G.newArmed > 3000) {
    G.newArmed = performance.now();
    toast('Nochmal tippen: neue Welt starten, Fortschritt geht verloren');
    return;
  }
  G.newArmed = 0;
  clearSave();
  gen();
  G.state = 'play';
  overlay.hidden = true;
  G.startT = performance.now();
  resetCam();
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
$('grpBtn').addEventListener('click', () => {
  G.follow = !G.follow;
  $('grpBtn').classList.toggle('off', !G.follow);
  toast(G.follow ? 'Die Crew folgt' : 'Die Crew bleibt stehen');
});
$('sndBtn').addEventListener('click', () => {
  G.muted = !G.muted;
  $('sndBtn').classList.toggle('off', G.muted);
  audioInit();
  if (G.AC && G.AC.state === 'suspended') G.AC.resume();
});
function resetCam() {
  const s = crew[0];
  cam.x = clamp(s.x - G.VW / 2, 0, W - G.VW);
  cam.y = clamp(s.y - G.VH / 2, 0, H - G.VH);
}

function step() {
  readInput();
  const paused = !panelEl.hidden;
  if (G.state === 'play' && !paused) {
    const s = sel_();
    if (s && s.dead) cycleCrew();
    crew.forEach((c, n) => {
      let I = n === G.sel ? inp : NOIN;
      if (n !== G.sel && G.follow && !c.dead) I = followAI(c, n);
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
    updArrows();
    updItems();
    for (const L of lorries) updLorry(L);
    for (let k = animals.length - 1; k >= 0; k--)
      if (!updAnimal(animals[k])) {
        killAnimal(animals[k]);
        animals.splice(k, 1);
      }
    updTrees();
    for (let k = crew.length - 1; k >= 0; k--)
      if (crew[k].dead && crew[k].deadT > 620) {
        crew.splice(k, 1);
        if (G.sel >= k && G.sel > 0) G.sel--;
        G.crewKey = '';
      }
    if (G.frame % 60 === 0) checkHints();
    if (G.frame % 3600 === 0) saveGame();
    if (G.money >= GOAL) endScreen(true);
    else if (!crew.some(c => !c.dead)) {
      if (G.money >= 60) {
        G.money -= 60;
        const n = addClonk(G.base.x + 15, G.base.gy - 10);
        G.sel = crew.indexOf(n);
        toast(`${n.name} kommt aus der Basis (−60 Taler)`);
        G.crewKey = '';
      } else endScreen(false);
    }
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
  render();
  G.tick++;
  if (G.tick % 5 === 0) hud();
  if (G.tick % 10 === 0) drawMini(G.tick % 60 === 0);
  requestAnimationFrame(loop);
}
gen();
resize();
resetCam();
hud();
menu();
requestAnimationFrame(loop);

// Offline mode for the web version; the Android app ships its files itself
if (!window.Capacitor && 'serviceWorker' in navigator && !import.meta.env.DEV) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
if (import.meta.env.DEV) import('./debug.js');

export { card, endScreen, loop, menu, overlay, resetCam, startGame, step };
