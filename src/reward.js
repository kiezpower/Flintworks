// Rewards you can see: coins fly from where gold was sold to the money counter, which then counts
// up and bumps; big moments (research done, a task fulfilled) get a banner across the screen.
import { cam } from './render.js';
import { G } from './state.js';

// money still on its way to the counter (counted once the coins arrive)
let flying = 0,
  shown = null;
// what the counter shows: counts up towards the money, without what is still flying
function shownMoney() {
  const target = G.money - flying;
  if (shown === null || target < shown || G.tick - (G.shownT ?? -99) > 30) shown = target;
  else if (shown < target) shown += Math.max(1, Math.ceil((target - shown) * 0.25));
  G.shownT = G.tick;
  return shown;
}
// coins from a spot in the world (landscape units) to the money counter
function flyCoins(wx, wy, money) {
  if (!money || typeof document === 'undefined') return;
  const cv = document.getElementById('cv'),
    to = document.querySelector('#hud .money .coin');
  if (!cv || !to || !to.offsetParent) return;
  const r = cv.getBoundingClientRect(),
    t = to.getBoundingClientRect(),
    sx = r.left + ((wx - cam.x) / G.VW) * r.width,
    sy = r.top + ((wy - cam.y) / G.VH) * r.height;
  // not on screen: the counter just counts up
  if (sx < r.left || sx > r.right || sy < r.top || sy > r.bottom) return;
  const n = Math.min(8, Math.max(2, Math.ceil(money / 15)));
  flying += money;
  let left = n;
  for (let k = 0; k < n; k++) {
    const c = document.createElement('i');
    c.className = 'coin flycoin';
    const ox = (Math.random() - 0.5) * 24,
      oy = (Math.random() - 0.5) * 16;
    c.style.left = sx + ox + 'px';
    c.style.top = sy + oy + 'px';
    document.body.appendChild(c);
    const dx = t.left + t.width / 2 - (sx + ox),
      dy = t.top + t.height / 2 - (sy + oy);
    // a little hop first, then off to the counter
    const a = c.animate(
      [
        { transform: 'translate(0,0) scale(1.4)', opacity: 1 },
        { transform: `translate(${ox * 0.6}px,${-14 + oy * 0.4}px) scale(1.5)`, offset: 0.25 },
        { transform: `translate(${dx}px,${dy}px) scale(0.9)`, opacity: 1 },
      ],
      { duration: 650 + k * 55, easing: 'cubic-bezier(.4,0,.7,1)' },
    );
    a.onfinish = () => {
      c.remove();
      if (--left === 0) {
        flying = Math.max(0, flying - money);
        bump(to.parentElement);
      }
    };
  }
}
function bump(el) {
  if (!el || !el.animate) return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], {
    duration: 260,
    easing: 'ease-out',
  });
}
// a banner across the screen for a moment: a title and a line below it
function banner(title, sub = '') {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('game') || document.body;
  root.querySelector('.banner')?.remove();
  const b = document.createElement('div');
  b.className = 'banner';
  b.innerHTML = '<b></b><small></small>';
  b.firstChild.textContent = title;
  b.lastChild.textContent = sub;
  root.appendChild(b);
  const a = b.animate(
    [
      { transform: 'translate(-50%, -12px) scale(0.85)', opacity: 0 },
      { transform: 'translate(-50%, 0) scale(1.04)', opacity: 1, offset: 0.08 },
      { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 0.14 },
      { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 0.85 },
      { transform: 'translate(-50%, -8px) scale(1)', opacity: 0 },
    ],
    { duration: 3000, easing: 'ease-out' },
  );
  a.onfinish = () => b.remove();
}

export { banner, flyCoins, shownMoney };
