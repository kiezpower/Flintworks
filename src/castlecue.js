// The castle shows itself as the place to shop: a small sign over the gate while your Wühler is
// close ("Burg · Laden"), inside it says which button opens the castle panel, and with a full bag
// the yellow arrow points home. Only pictures; the glowing action button and the first-time hint
// are in ui.js (hud). Not in the tutorial, which shows the castle in its own beats.
import { drawArrow } from './arrow.js';
import { insideB, sel_ } from './entities.js';
import { tr } from './i18n.js';
import { G, INV_MAX } from './state.js';

function sign(ctx, text, x, y) {
  ctx.font = '5px monospace';
  const w = Math.ceil(ctx.measureText(text).width) + 6;
  const l = Math.round(x - w / 2);
  ctx.fillStyle = '#24160c';
  ctx.fillRect(l - 1, y - 9, w + 2, 9);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(l, y - 8, w, 7);
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(l, y - 8, w, 1);
  ctx.fillStyle = '#fbf3dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x + 0.5, y - 2.5);
}

function drawCastleCue(ctx, cx, cy) {
  const b = G.base,
    c = sel_();
  if (!b || !c || c.dead || G.tut || G.state !== 'play' || c.ride != null) return;
  const gx = b.x + b.w / 2,
    top = b.gy - b.h;
  const inside = insideB(c, b),
    near = Math.abs(c.x + 3 - gx) < b.w / 2 + 70 && c.y > top - 70 && c.y < b.gy + 30;
  if (inside) {
    const how =
      G.inputKind === 'touch'
        ? tr('Tippe „Burg“: Laden')
        : G.padUsed && G.padLabels
          ? tr('{b}: Laden öffnen', { b: G.padLabels().B })
          : tr('F: Laden öffnen');
    sign(ctx, how, Math.round(gx - cx), Math.round(top - cy) - 3);
  } else if (near) {
    const bob = G.reduceMotion ? 0 : Math.round(Math.sin(G.frame * 0.12) * 1.5);
    sign(ctx, tr('Burg · Laden'), Math.round(gx - cx), Math.round(top - cy) - 8 + bob);
    // a small arrow down to the gate
    drawArrow(ctx, Math.round(gx - cx), Math.round(top - cy) + 4);
  } else if (c.inv.length >= INV_MAX) {
    // a full bag: home is where it empties
    drawArrow(ctx, gx - cx, top - cy);
  }
}

export { drawCastleCue };
