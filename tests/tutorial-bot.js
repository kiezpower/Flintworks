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
  const POLICY = {
    walk: () => bot.go(L.TUT.trees[0]),
    chop(c, k) {
      const t = w.trees.find(t => !t.fall && t.x < L.TUT.end);
      if (t && bot.go(t.x - 5) && k % 20 === 0 && !c.chop) w.edge.act = true;
    },
    wood(c) {
      const it = near(
        c,
        w.items.filter(i => i.t === 'wood'),
      );
      if (it) bot.go(it.x + 2);
    },
    blast(c, k) {
      if (!bot.go(L.TUT.rock.x0 - 22)) return;
      if (c.face < 0) w.keys.r = 1;
      else if (k % 150 === 0) w.edge.throw = true;
    },
    dig: () => bot.go(L.TUT.gold.x) && (w.keys.d = 1),
    gold(c) {
      const it = near(
        c,
        w.items.filter(i => i.t === 'nug'),
      );
      if (!it) return bot.go(L.TUT.gold.x) && (w.keys.d = 1);
      bot.go(it.x + 1);
      if (it.y > c.y + 8) w.keys.d = 1;
    },
    sell(c, k) {
      bot.go(90);
      if (Math.abs(c.vx) < 0.05 && k % 30 < 12) {
        w.edge.jump = true;
        w.keys.u = 1;
      }
    },
    hut(c, k) {
      if (w.builds.some(b => b.type === 'hut') || !bot.go(L.TUT.plot) || k % 60 !== 59) return;
      press(document.getElementById('buildBtn'));
      press(document.querySelector('[data-tut=b_hut]'));
    },
    crew(c, k) {
      if (k % 60 !== 30) return;
      w.hud();
      press(document.querySelector('#crew .cbtn:not(.sel)'));
      press(document.querySelector('[data-tut=f_wood]'));
    },
    map: (c, k) => (k === 10 || k === 40) && key('KeyM'),
  };
  window.bot = bot;
})();
