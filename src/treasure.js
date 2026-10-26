// Buried treasure chests: small caves deep underground, opened with the action button.
import { celebrate } from './effects.js';
import { spawnItem } from './entities.js';
import { addFloat } from './floats.js';
import { track } from './profile.js';
import { announce } from './announce.js';
import { addStat } from './stats.js';
import { TEAM } from './versus.js';
import { sfx } from './sound.js';
import { drawHi, sp } from './sprites.js';
import { G } from './state.js';
import { toast } from './ui.js';
import { AIR, GRANITE, H, ROCK, W, bg, mat, rnd, surf } from './world.js';

const CW = 8,
  CH = 6;
const wood = '#8b5e34',
  woodD = '#5a3a1e',
  band = '#c9a43a';
const CLOSED = sp(CW, CH, R => {
  R(0, 1, 8, 5, wood);
  R(0, 0, 8, 2, '#a8743e');
  R(0, 2, 8, 1, woodD);
  R(0, 0, 1, 6, band);
  R(7, 0, 1, 6, band);
  R(3, 2, 2, 2, '#f2c230');
  R(3, 3, 2, 1, '#2a1a10');
});
const OPEN = sp(CW, CH + 3, R => {
  R(0, 0, 8, 3, '#a8743e');
  R(0, 0, 1, 3, band);
  R(7, 0, 1, 3, band);
  R(1, 3, 6, 1, '#ffe066');
  R(0, 4, 8, 5, wood);
  R(0, 4, 1, 5, band);
  R(7, 4, 1, 5, band);
  R(1, 4, 6, 1, '#2a1a10');
});

// carve a little cave with a rock floor for each chest; called by gen() before the world is painted
function placeChests(n = 6) {
  G.chests = [];
  G.chestsFound = 0;
  for (let k = 0; k < n; k++) {
    const x = Math.floor(240 + (k + 0.2 + rnd() * 0.6) * ((W - 290) / n));
    const y = Math.min(H - 24, Math.floor(surf[x] + 55 + rnd() * (H - surf[x] - 85)));
    for (let yy = y - 9; yy < y; yy++)
      for (let xx = x - 8; xx <= x + 8; xx++) {
        const dx = (xx - x) / 9,
          dy = (yy - y + 1) / 9;
        if (dx * dx + dy * dy > 1) continue;
        const i = yy * W + xx;
        if (mat[i] === GRANITE) continue;
        mat[i] = AIR;
        bg[i] = 1;
      }
    for (let yy = y; yy < y + 3; yy++)
      for (let xx = x - 7; xx <= x + 7; xx++) if (mat[yy * W + xx] !== GRANITE) mat[yy * W + xx] = ROCK;
    G.chests.push({ x: x - CW / 2, y: y - CH, open: false });
  }
}

function chestNear(c) {
  if (!G.chests) return null;
  return G.chests.find(
    ch => !ch.open && c.x + 6 > ch.x - 3 && c.x < ch.x + CW + 3 && c.y + 10 > ch.y && c.y < ch.y + CH + 2,
  );
}
function openChest(ch) {
  ch.open = true;
  G.chestsFound = (G.chestsFound || 0) + 1;
  const loot = ['nug', 'nug', 'nug'];
  if (rnd() < 0.5) loot.push('nug');
  if (rnd() < 0.45) loot.push('gem');
  loot.push(rnd() < 0.5 ? 'tnt' : 'flint');
  loot.forEach((t, k) => spawnItem(t, ch.x + 3, ch.y - 2, (k - loot.length / 2) * 0.35, -1.6 - rnd(), 6));
  sfx('fanfare');
  celebrate(ch.x + CW / 2, ch.y, 36);
  sfx('coin', ch.x, ch.y);
  G.shake = Math.max(G.shake || 0, 2);
  addFloat(ch.x + CW / 2, ch.y - 4, '★', '#ffe066');
  toast('Schatztruhe geöffnet!');
  track('chest');
  // (G.cmdPid: the player whose action opened it)
  addStat(G.cmdPid, 'chests');
  if (G.teams) announce(`${TEAM[G.curTeam || 0]} hat eine Truhe geöffnet!`, null, 1 - (G.curTeam || 0));
}

function drawChests(ctx, cx, cy) {
  if (!G.chests) return;
  for (const ch of G.chests) {
    const sx = Math.round(ch.x - cx),
      sy = Math.round(ch.y - cy);
    if (sx < -12 || sy < -12 || sx > G.VW || sy > G.VH) continue;
    if (ch.open) drawHi(ctx, OPEN, sx, sy - 3);
    else {
      drawHi(ctx, CLOSED, sx, sy);
      // a glint now and then so chests are spotted in the dark
      if ((G.frame + ch.x * 7) % 120 < 8) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + 3, sy - 3, 1, 3);
        ctx.fillRect(sx + 2, sy - 2, 3, 1);
      }
    }
  }
}

export { chestNear, drawChests, openChest, placeChests };
