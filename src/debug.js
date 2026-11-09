// Dev-only hooks for the browser tests (never part of the production build).
import { G, animals, builds, crew, items, lorries, parts, trees, vehicles } from './state.js';
import { explode, ignite } from './objects.js';
import { tryBuild, terrOK } from './buildings.js';
import { calcTerr, cam } from './render.js';
import { hud, openBase } from './ui.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { lightning } from './weather.js';
import { step } from './main.js';
import { buzz, edge, inp, joy, keys } from './input.js';
import { audioInit, sfx } from './sound.js';
import { startCaveIn, onDig } from './hazards.js';
import { chestNear, openChest } from './treasure.js';
import { setGoal } from './tapgo.js';
import { foundation } from './buildings.js';
import * as world from './world.js';
import { gen } from './gen.js';
import { addDigger, mkAnimal } from './entities.js';
import { arrows } from './buildings.js';
import * as helpers from './helpers.js';
import { send } from './commands.js';
import { digZone, wantsDig } from './digger.js';
import { LIQ, matAt, solid } from './world.js';

import * as events from './events.js';
import * as effects from './effects.js';
import * as combat from './combat.js';
import * as room from './net/room.js';
import * as modes from './modes.js';
import * as versus from './versus.js';
import * as bots from './bots.js';
import * as climb from './climb.js';
import { context } from './digger.js';
import { TUT, ground } from './tutlevel.js';
import * as analytics from './analytics.js';
import { STEPS } from './tutsteps.js';
import { endTutorial } from './tutorial.js';

// Under test automation (Playwright sets navigator.webdriver) the game draws only every third
// frame: drawing is half of what a frame costs, and dozens of test pages share a few cores. The
// simulation keeps its pace. ?draw in the address draws every frame again (for screenshots).
if (navigator.webdriver && !new URLSearchParams(location.search).has('draw')) G.drawEvery = 3;
// and a panel takes a tap at once (in the game it ignores taps for 450 ms after it opens,
// against double taps): the tests need not wait before each click. ?guard keeps the 450 ms.
if (navigator.webdriver && !new URLSearchParams(location.search).has('guard')) G.tapGuard = 0;

window.__ww = {
  climb,
  context,
  room,
  bots,
  modes,
  versus,
  effects,
  events,
  combat,
  send,
  buzz,
  cam,
  helpers,
  addDigger,
  mkAnimal,
  arrows: () => arrows,
  step: n => {
    for (let i = 0; i < n; i++) step();
  },
  solidAt: (x, y) => solid(x, y) || LIQ[matAt(x, y)] === 1,
  power: () => G.power,
  get base() {
    return G.base;
  },
  get crew() {
    return crew;
  },
  get vehicles() {
    return vehicles;
  },
  get items() {
    return items;
  },
  get builds() {
    return builds;
  },
  get trees() {
    return trees;
  },
  get animals() {
    return animals;
  },
  get lorries() {
    return lorries;
  },
  get money() {
    return G.money;
  },
  set money(v) {
    G.money = v;
  },
  get tut() {
    return G.tut;
  },
  tutLevel: { TUT, ground, steps: () => STEPS.map(s => s.id) },
  analytics,
  endTutorial: () => endTutorial(),
  matAt,
  get state() {
    return G.state;
  },
  frame: () => G.frame,
  setDay: v => {
    G.dayT = v;
  },
  rain: () => {
    G.rainT = 600;
  },
  bolt: () => lightning(),
  meteor: () => {
    G.meteorNext = 1;
  },
  save: () => saveGame(),
  load: () => loadGame(),
  hasSave,
  ignite,
  explode,
  tryBuild,
  openBase,
  hud,
  calcTerr,
  terrOK,
  inp,
  keys,
  joy,
  edge,
  G,
  startCaveIn,
  onDig,
  chestNear,
  openChest,
  setGoal,
  foundation,
  world,
  gen,
  wantsDig,
  digZone,
  audioInit,
  sfx,
  parts: () => parts,
};

// ?ev: the analytics events of this session as they come, in a corner (development only)
if (new URLSearchParams(location.search).has('ev')) {
  const box = document.createElement('pre');
  box.id = 'evLog';
  box.style.cssText =
    'position:fixed;left:4px;bottom:4px;z-index:99;max-height:40vh;overflow:auto;margin:0;padding:4px 6px;' +
    'font:10px/1.3 monospace;color:#9f9;background:rgba(0,0,0,.75);pointer-events:none;white-space:pre';
  document.body.appendChild(box);
  const show = () => {
    box.textContent = analytics
      .sessionEvents()
      .slice(-14)
      .map(({ e, seq, t, sid, v, plat, lang, ...f }) => `${seq} ${(t / 1000).toFixed(1)}s ${e} ${JSON.stringify(f)}`)
      .join('\n');
  };
  G.onEvent = show;
  show();
}
