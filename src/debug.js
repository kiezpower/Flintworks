// Dev-only hooks for the browser tests (never part of the production build).
import { G, animals, builds, crew, items, lorries, parts, trees, vehicles } from './state.js';
import { explode, ignite } from './objects.js';
import { tryBuild, terrOK } from './buildings.js';
import { calcTerr } from './render.js';
import { hud, openBase } from './ui.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { lightning } from './weather.js';
import { step } from './main.js';
import { edge, inp, joy, keys } from './input.js';
import { audioInit, sfx } from './sound.js';
import { startCaveIn, onDig } from './hazards.js';
import { chestNear, openChest } from './treasure.js';
import { setGoal } from './tapgo.js';
import { foundation } from './buildings.js';
import * as world from './world.js';
import { gen } from './gen.js';
import { addClonk } from './entities.js';
import * as helpers from './helpers.js';
import { send } from './commands.js';
import { digZone, wantsDig } from './clonk.js';
import { LIQ, matAt, solid } from './world.js';

import * as events from './events.js';
import * as effects from './effects.js';
import * as combat from './combat.js';
import * as room from './net/room.js';
import * as modes from './modes.js';
import * as versus from './versus.js';
import * as bots from './bots.js';
import { TUT, ground, rockOpen } from './tutlevel.js';
import { STEPS } from './tutsteps.js';

window.__ww = {
  room,
  bots,
  modes,
  versus,
  effects,
  events,
  combat,
  send,
  helpers,
  addClonk,
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
  tutLevel: { TUT, ground, rockOpen, steps: () => STEPS.map(s => s.id) },
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
