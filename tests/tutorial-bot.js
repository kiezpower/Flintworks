// Plays the tutorial inside the page like a player with a keyboard. Needs the dev build
// (window.__ww from src/debug.js). bot.run(n) plays the current step for up to n ticks.
(() => {
  const w = window.__ww;
  const L = w.tutLevel;
  const ids = L.steps();
  const panel = document.getElementById('panel');
  const near = (c, list) =>
    list.reduce((b, p) => (!b || Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(b.x - c.x, b.y - c.y) ? p : b), null);
  const key = code => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
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
    // walk towards x; jumps when blocked; true when there
    go(tx) {
      const c = bot.me();
      w.keys.l = w.keys.r = 0;
      if (c.x + 3 < tx - 2) w.keys.r = 1;
      else if (c.x + 3 > tx + 2) w.keys.l = 1;
      const there = Math.abs(c.x + 3 - tx) <= 2;
      if (!there && Math.abs(c.vx) < 0.05 && ++bot.stuck % 20 === 19) w.edge.jump = true;
      return there;
    },
    run(max) {
      const start = w.tut ? w.tut.i : -1;
      for (let k = 0; k < max && w.tut && w.tut.i === start; k++) {
        bot.release();
        const id = ids[w.tut.i];
        if (!panel.hidden && id !== 'hut' && id !== 'crew') press(document.getElementById('pClose'));
        POLICY[id](bot.me(), k);
        w.step(1);
      }
      bot.release();
      return w.tut ? ids[w.tut.i] : 'end';
    },
  };
  // jumps when it stands in front of the bump (or anything else) and gets nowhere
  const hop = c => {
    if (Math.abs(c.vx) < 0.05 && ++bot.stuck % 12 === 11) w.edge.jump = true;
  };
  const POLICY = {
    walk: c => {
      bot.go(L.TUT.gold.x);
      hop(c);
    },
    dig(c) {
      const it = near(
        c,
        w.items.filter(i => i.t === 'nug'),
      );
      if (it) return bot.go(it.x + 1);
      if (bot.go(L.TUT.gold.x)) w.keys.d = 1;
      if (!w.G.autoDig && Math.abs(c.x + 3 - L.TUT.gold.x) <= 2) w.keys.dig = 1;
    },
    sell(c, k) {
      bot.go(90);
      if (Math.abs(c.vx) < 0.05 && k % 30 < 12) {
        w.edge.jump = true;
        w.keys.u = 1;
      }
    },
  };
  window.bot = bot;
})();
