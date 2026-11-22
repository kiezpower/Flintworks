// Plays the tutorial "Der Glutstein" inside the page like a player with a keyboard. Needs the dev
// build (window.__ww from src/debug.js). bot.run(n) plays the current step for up to n ticks.
// Steps (src/tutsteps.js): walk to the well, dig down by it, mine flint and ore, build the
// bridge over the abyss, run through the cave-in, carry the Glutstein home to the hearth.
(() => {
  const w = window.__ww;
  const L = w.tutLevel;
  const T = L.TUT;
  const ids = L.steps();
  const panel = document.getElementById('panel');
  const mid = c => c.x + 3;
  const feet = c => c.y + 10;
  const near = (c, list) =>
    list.reduce((b, p) => (!b || Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(b.x - c.x, b.y - c.y) ? p : b), null);
  const lying = t => w.items.filter(i => i.t === t);
  const has = (c, t) => c.inv.includes(t);
  // a click on a panel button: the game ignores clicks right after a panel opened
  const press = el => {
    w.G.panelT = 0;
    el.click();
  };
  const bot = {
    stuck: 0,
    me: () => w.crew[0],
    release() {
      for (const k in w.keys) w.keys[k] = 0;
    },
    // walk towards x; jumps when it gets nowhere; true when there
    go(tx) {
      const c = bot.me();
      w.keys.l = w.keys.r = 0;
      if (mid(c) < tx - 2) w.keys.r = 1;
      else if (mid(c) > tx + 2) w.keys.l = 1;
      const there = Math.abs(mid(c) - tx) <= 2;
      if (!there && Math.abs(c.vx) < 0.05 && ++bot.stuck % 14 === 13) w.edge.jump = true;
      return there;
    },
    run(max) {
      const start = w.tut ? w.tut.i : -1;
      for (let k = 0; k < max && w.tut && w.tut.i === start; k++) {
        bot.release();
        if (!panel.hidden) press(document.getElementById('pClose'));
        POLICY[ids[w.tut.i]](bot.me(), k);
        w.step(1);
      }
      bot.release();
      return w.tut ? ids[w.tut.i] : 'end';
    },
  };
  // classic controls: the dig button has to be held
  const dig = () => {
    if (!w.G.autoDig) w.keys.dig = 1;
  };
  const POLICY = {
    walk: () => bot.go(T.well.x),
    dig: () => {
      if (bot.go(T.shaft.x)) {
        w.keys.d = 1;
        dig();
      }
    },
    mine: c => {
      // pick up what came off the walls, else hack on to the right
      const loose = near(c, lying('flint').concat(lying('ore')));
      if (loose && Math.abs(loose.x - c.x) < 40) return bot.go(loose.x + 1);
      w.keys.r = 1;
      dig();
    },
    bridge: (c, k) => {
      const s = w.tut.s;
      if (s.built || c.bridge) return void (w.keys.r = 1);
      if (!has(c, 'wood')) {
        const beam = near(c, lying('wood'));
        return beam && bot.go(beam.x + 3);
      }
      if (bot.go(T.gap.x0 - 6) && k % 10 === 0) w.edge.act = true;
    },
    danger: c => {
      w.keys.r = 1;
      if (Math.abs(c.vx) < 0.05 && ++bot.stuck % 10 === 9) w.edge.jump = true;
    },
    glut: (c, k) => {
      const g = w.G.tut.run.glut;
      if (g === 'placed') return;
      if (g !== 'carried') return bot.go(T.glut.x);
      // up the ramp; at its top the tunnel is open: jump left over the opening onto the road
      if (mid(c) > T.ramp.x1 - 28 && feet(c) <= L.ground() + 4) {
        w.keys.l = 1;
        if (!c.vy) w.edge.jump = true;
        return;
      }
      if (mid(c) > T.room.x0 - 2 && feet(c) > L.ground() + 4) return bot.go(T.ramp.x1);
      // then left along the village road to the hearth
      if (bot.go(T.hearth.x) && k % 10 === 0) w.edge.act = true;
    },
  };
  // one tick of the bot's play for the current step (without stepping the game)
  bot.act = k => POLICY[ids[w.tut.i]](bot.me(), k);
  window.bot = bot;
})();
