import { arrows } from './buildings.js';
import { hurt, startTumble } from './clonk.js';
import { midMat, moveBody, overlap, spawnItem, unstuck } from './entities.js';
import { canPlantAt, plantTree } from './gen.js';
import { sfx } from './sound.js';
import { treeSprite } from './sprites.js';
import { G, animals, crew, flashes, items, lorries, parts, trees } from './state.js';
import { toast } from './ui.js';
import {
  ACID,
  AIR,
  BLAST,
  COAL,
  EARTH,
  GOLD,
  H,
  LAVA,
  LIQ,
  LOAM,
  ORE,
  PLANK,
  ROCK,
  SAND,
  W,
  WATER,
  bg,
  free,
  mat,
  matAt,
  paint,
  ri,
  rnd,
  setMat,
  solid,
} from './world.js';

// ---- Items, trees, animals, explosions, particles ----
function updArrows() {
  for (let k = arrows.length - 1; k >= 0; k--) {
    const a = arrows[k];
    a.vy += 0.06;
    a.x += a.vx;
    a.y += a.vy;
    let hit = false;
    for (const m of animals) {
      if (m.kind !== 'monster') continue;
      if (a.x > m.x && a.x < m.x + m.w && a.y > m.y && a.y < m.y + m.h) {
        m.hp -= 20;
        m.hurt = 12;
        m.vx += Math.sign(a.vx) * 0.8;
        hit = true;
        sfx('clack', a.x, a.y);
        break;
      }
    }
    if (hit || solid(Math.floor(a.x), Math.floor(a.y)) || --a.l <= 0) arrows.splice(k, 1);
  }
}
function updItems() {
  for (let k = items.length - 1; k >= 0; k--) {
    const it = items[k];
    if (it.pd > 0) it.pd--;
    if (it.fuse > 0) {
      if (it.t === 'tnt' && G.frame % 3 === 0)
        parts.push({
          x: it.x + 1,
          y: it.y - 1,
          vx: (rnd() - 0.5) * 0.6,
          vy: -rnd() * 0.8,
          l: 8,
          c: rnd() < 0.5 ? '#ffe066' : '#ff7a2f',
        });
      if (--it.fuse === 0) {
        items.splice(k, 1);
        explode(it.x + 1, it.y + 1, it.t === 'tnt' ? 19 : 11);
        continue;
      }
    }
    const inL = midMat(it, 0.5);
    if (inL === LAVA && (it.t === 'wood' || it.t === 'loam')) {
      items.splice(k, 1);
      for (let q = 0; q < 6; q++)
        parts.push({ x: it.x, y: it.y, vx: rnd() - 0.5, vy: -rnd(), l: 20, c: '#ffb03a', g: -0.02 });
      continue;
    }
    if (inL === LAVA && (it.t === 'flint' || it.t === 'tnt')) {
      items.splice(k, 1);
      explode(it.x + 1, it.y + 1, it.t === 'tnt' ? 19 : 11);
      continue;
    }
    const inW = LIQ[inL];
    const floats = it.t === 'wood';
    if (inW && floats) {
      it.vy -= 0.08;
      it.vy *= 0.85;
      it.vx *= 0.95;
    }
    it.vy += inW ? 0.04 : 0.15;
    if (inW) {
      it.vx *= 0.92;
      it.vy *= 0.92;
    }
    unstuck(it);
    let impact = 0;
    const vx0 = it.vx,
      vy0 = it.vy;
    const [bx] = moveBody(it, it.vx, 0, 0);
    if (bx) {
      impact = Math.abs(vx0);
      it.vx = -vx0 * 0.35;
    }
    const [, by2] = moveBody(it, 0, it.vy, 0);
    let onG = false;
    if (by2) {
      impact = Math.max(impact, Math.abs(vy0));
      onG = vy0 >= 0;
      it.vy = -vy0 * 0.3;
      it.vx *= 0.75;
      if (Math.abs(it.vy) < 0.5) it.vy = 0;
      if (impact > 1.8 && !inW) sfx('clack', it.x, it.y, impact / 4);
    }
    if (!onG) onG = !free(it.x, it.y + 1, it.w, it.h);
    // roll down slopes
    if (onG && (it.t === 'rock' || it.t === 'flint' || it.t === 'nug')) {
      const l = free(it.x - 1, it.y + 1, it.w, it.h),
        r = free(it.x + 1, it.y + 1, it.w, it.h);
      if (l && !r) it.vx -= 0.06;
      else if (r && !l) it.vx += 0.06;
      else it.vx *= 0.9;
    } else if (onG) it.vx *= 0.85;
    if (Math.abs(it.vx) < 0.03) it.vx = 0;
    if (it.armed && impact > 0.8 && it.pd < 34) {
      items.splice(k, 1);
      explode(it.x + 1, it.y + 1, 11);
      continue;
    }
    // hits
    const sp = Math.hypot(it.vx, it.vy);
    if (sp > 2 && it.t !== 'nug') {
      for (const e of [...crew, ...animals]) {
        if (e.dead || (e === it.thrower && it.pd > 0) || !overlap(it, e, 0)) continue;
        if (it.armed) {
          items.splice(k, 1);
          explode(it.x + 1, it.y + 1, 11);
          break;
        }
        if (e.kind === 'clonk') {
          hurt(e, sp * 3);
          if (sp > 3.2) startTumble(e, it.vx * 0.6, -1);
        } else {
          e.hp -= sp * 4;
          e.hurt = 10;
        }
        it.vx *= -0.3;
        it.vy = -1;
        sfx('clack', it.x, it.y);
        break;
      }
      if (items[k] !== it) continue;
    }
    // pickup
    if (it.pd <= 0 && sp < 1.5 && it.fuse < 0) {
      for (const c of crew) {
        if (c.dead || c.tumble || c.inv.length >= 5 || !overlap(it, c, 1)) continue;
        items.splice(k, 1);
        c.inv.push(it.t);
        sfx('pick', c.x, c.y);
        break;
      }
    }
    if (it.y > H + 10) items.splice(k, 1);
  }
}
function updTrees() {
  for (let k = trees.length - 1; k >= 0; k--) {
    const t = trees[k];
    if (t.burn > 0) {
      t.burn -= G.rainT > 0 ? 3 : 1;
      const h = t.spr.height;
      for (let q = 0; q < 2; q++)
        parts.push({
          x: t.x + (rnd() - 0.5) * t.spr.width * 0.8,
          y: t.gy - h * 0.3 - rnd() * h * 0.6,
          vx: (rnd() - 0.5) * 0.3,
          vy: -0.4 - rnd() * 0.6,
          l: 14 + rnd() * 10,
          c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f',
          g: -0.012,
        });
      if (rnd() < 0.15)
        parts.push({
          x: t.x + (rnd() - 0.5) * 4,
          y: t.gy - h,
          vx: (rnd() - 0.5) * 0.2,
          vy: -0.3,
          l: 60,
          c: '#4a4540',
          g: -0.003,
        });
      if (G.frame % 20 === k % 20)
        for (const o of trees)
          if (o !== t && !o.burn && !o.fall && Math.abs(o.x - t.x) < 16 && rnd() < 0.22) ignite(o);
      for (const c of crew)
        if (
          !c.dead &&
          !c.burn &&
          Math.abs(c.x + 3 - t.x) < t.spr.width / 2 &&
          c.y + 10 > t.gy - h &&
          c.y < t.gy &&
          rnd() < 0.01
        )
          c.burn = 200;
      if (G.frame % 45 === 0) sfx('crackle', t.x, t.gy);
      if (t.burn <= 0) {
        for (let q = 0; q < 20; q++)
          parts.push({
            x: t.x + (rnd() - 0.5) * t.spr.width,
            y: t.gy - rnd() * h,
            vx: rnd() - 0.5,
            vy: -rnd(),
            l: 40,
            c: rnd() < 0.5 ? '#3a3530' : '#5d5852',
          });
        spawnItem('wood', t.x - 3, t.gy - 6, 0, -0.5, 15);
        sfx('thud', t.x, t.gy);
        trees.splice(k, 1);
      }
      continue;
    }
    if (!t.fall) {
      if (G.frame % 30 === k % 30 && !solid(t.x, t.gy) && !solid(t.x - 1, t.gy) && !solid(t.x + 1, t.gy))
        t.fall = rnd() < 0.5 ? -1 : 1;
      if (t.stage < 4 && ++t.grow > 2600) {
        t.grow = 0;
        t.stage++;
        t.hp = 40 + t.stage * 25;
        t.spr = treeSprite(t.type, t.stage);
      }
      continue;
    }
    t.ang += (0.012 + Math.abs(t.ang) * 0.09) * Math.sign(t.fall);
    if (Math.abs(t.ang) >= Math.PI / 2 - 0.05) {
      const n = t.stage + 1,
        len = t.spr.height;
      for (let q = 0; q < n; q++) {
        const d = 4 + (q * (len - 6)) / n,
          x = t.x + t.fall * d;
        spawnItem('wood', x - 3, t.gy - 8, t.fall * 0.3, -0.5, 15);
      }
      for (let q = 0; q < 14; q++)
        parts.push({
          x: t.x + t.fall * rnd() * len,
          y: t.gy - 2,
          vx: rnd() - 0.5,
          vy: -rnd() * 1.5,
          l: 30,
          c: t.type === 'pine' ? '#2f6b3a' : '#4f9a3c',
        });
      sfx('thud', t.x, t.gy);
      G.shake = Math.max(G.shake, 2);
      trees.splice(k, 1);
    }
  }
  if (G.frame % 900 === 0 && trees.length < 26) {
    for (let tr = 0; tr < 30; tr++) {
      const x = ri(10, W - 10);
      if (canPlantAt(x)) {
        plantTree(x, 1);
        break;
      }
    }
  }
}
function ignite(t) {
  if (t.burn || t.fall) return;
  t.burn = 700;
  const s = t.spr,
    c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  const g = c.getContext('2d');
  g.drawImage(s, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#2a201a';
  g.fillRect(0, 0, c.width, c.height);
  t.char = c;
}
function updAnimal(a) {
  if (a.hurt > 0) a.hurt--;
  const m = midMat(a, 0.5),
    inL = LIQ[m];
  if (m === LAVA || m === ACID) a.hp -= m === LAVA ? 2 : 0.3;
  if (a.hp <= 0) return false;
  if (a.kind === 'fish') {
    if (m === WATER) {
      a.dry = 0;
      if (--a.t <= 0) {
        a.t = ri(30, 120);
        a.vx = (rnd() - 0.5) * 0.8;
        a.vy = (rnd() - 0.5) * 0.3;
      }
      if (a.vx) a.face = Math.sign(a.vx);
      const nx = a.x + a.vx,
        ny = a.y + a.vy;
      if (
        matAt(Math.floor(nx + a.w / 2 + a.face * 2), Math.floor(ny + 1)) === WATER &&
        matAt(Math.floor(nx + a.w / 2), Math.floor(ny)) === WATER
      ) {
        a.x = nx;
        a.y = ny;
      } else {
        a.vx *= -1;
        a.vy *= -1;
      }
      a.anim += 0.2;
    } else {
      a.dry++;
      a.vy = Math.min(a.vy + 0.15, 4);
      const [, by] = moveBody(a, a.vx, a.vy, 0);
      if (by) {
        a.vy = rnd() < 0.1 ? -1.5 : 0;
        a.vx = rnd() - 0.5;
      }
      if (a.dry > 400) a.hp = 0;
    }
    return a.hp > 0;
  }
  a.vy = Math.min(a.vy + (inL ? 0.03 : 0.17), 4);
  if (inL) {
    a.vy *= 0.9;
    if (LIQ[midMat(a, 0.1)]) a.vy -= 0.1;
  }
  const onG = !free(a.x, a.y + 1, a.w, a.h);
  if (a.kind === 'wipf') {
    if (--a.t <= 0) {
      a.t = ri(30, 160);
      a.tvx = rnd() < 0.35 ? 0 : (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 0.4);
      if (onG && rnd() < 0.3) a.vy = -2;
    }
    let near = null;
    for (const c of crew) if (!c.dead && Math.abs(c.x - a.x) < 14 && Math.abs(c.y - a.y) < 10) near = c;
    if (near) a.tvx = Math.sign(a.x - near.x) * 0.8;
    for (const o of animals)
      if (o.kind === 'monster' && Math.abs(o.x - a.x) < 40 && Math.abs(o.y - a.y) < 20)
        a.tvx = Math.sign(a.x - o.x) * 0.9;
    a.vx += ((a.tvx || 0) - a.vx) * 0.2;
  } else {
    let tgt = null,
      bd = 110;
    for (const c of crew) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      if (d < bd && Math.abs(c.y - a.y) < 45) {
        bd = d;
        tgt = c;
      }
    }
    if (tgt) {
      a.tvx = Math.sign(tgt.x + 3 - (a.x + 6)) * 0.5;
      if (G.frame % 180 === 0) sfx('growl', a.x, a.y);
    } else if (--a.t <= 0) {
      a.t = ri(60, 200);
      a.tvx = rnd() < 0.4 ? 0 : (rnd() < 0.5 ? -1 : 1) * 0.3;
    }
    a.vx += ((a.tvx || 0) - a.vx) * 0.08;
    if (a.atk > 0) a.atk--;
    for (const c of crew) {
      if (c.dead || !overlap(a, c, 0)) continue;
      hurt(c, 0.12, true);
      if (a.atk <= 0) {
        a.atk = 70;
        startTumble(c, Math.sign(c.x - a.x || 1) * 2.2, -1.6);
        hurt(c, 7);
        sfx('growl', a.x, a.y);
      }
    }
  }
  if (Math.abs(a.vx) > 0.05) a.face = Math.sign(a.vx);
  const [bx, by] = moveBody(a, a.vx, a.vy, a.kind === 'monster' ? 3 : 2);
  if (by) a.vy = 0;
  if (bx) {
    if (onG) a.vy = a.kind === 'monster' ? -2.4 : -2;
    else a.vx *= -0.5;
  }
  if (onG) a.anim += Math.abs(a.vx) * 0.4;
  return true;
}
function killAnimal(a) {
  const col = a.kind === 'monster' ? '#5a56a0' : a.kind === 'wipf' ? '#f2e6d0' : '#e0a13a';
  for (let q = 0; q < 14; q++)
    parts.push({ x: a.x + a.w / 2, y: a.y + a.h / 2, vx: (rnd() - 0.5) * 2, vy: -rnd() * 2, l: 30, c: col });
  if (a.kind === 'monster') {
    spawnItem('nug', a.x + 3, a.y, -0.6, -1.5, 10);
    spawnItem('nug', a.x + 6, a.y, 0.6, -1.5, 10);
    toast('Monster besiegt');
    sfx('growl', a.x, a.y);
  }
}
const DEBRIS = {
  [EARTH]: EARTH,
  [ROCK]: ROCK,
  [SAND]: SAND,
  [LOAM]: LOAM,
  [ORE]: ORE,
  [COAL]: COAL,
  [PLANK]: PLANK,
};
const DEBCOL = {
  [EARTH]: '#7d5230',
  [ROCK]: '#7b766f',
  [SAND]: '#d9b56a',
  [LOAM]: '#b07a45',
  [ORE]: '#9a5a46',
  [COAL]: '#2a2626',
  [PLANK]: '#a0703f',
};
function explode(cx, cy, r) {
  let gc = 0;
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      if (x < 0 || x >= W) continue;
      const dx = x - cx,
        dy = y - cy,
        rr = r + (rnd() * 2 - 1);
      if (dx * dx + dy * dy > rr * rr) continue;
      const i = y * W + x,
        m = mat[i];
      if (BLAST[m]) {
        if (m === GOLD) gc++;
        else if (rnd() < 0.16) {
          const d = Math.hypot(dx, dy) || 1,
            s = 1.2 + rnd() * 2.2;
          parts.push({
            x: x + 0.5,
            y: y + 0.5,
            vx: (dx / d) * s,
            vy: (dy / d) * s - 1.3,
            l: 300,
            c: DEBCOL[m],
            m: DEBRIS[m],
          });
        }
        mat[i] = AIR;
        bg[i] = 1;
        paint(i);
      }
    }
  }
  for (let q = 0; q < Math.floor(gc / 12) + (gc > 3 ? 1 : 0); q++)
    spawnItem('nug', cx, cy, (rnd() - 0.5) * 2.4, -1.5 - rnd(), 8);
  for (let q = 0; q < 26; q++) {
    const a = rnd() * Math.PI * 2,
      v = rnd() * 2.4;
    parts.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 0.6,
      l: 14 + rnd() * 14,
      c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f',
    });
  }
  for (let q = 0; q < 8; q++)
    parts.push({
      x: cx + (rnd() - 0.5) * r,
      y: cy + (rnd() - 0.5) * r,
      vx: (rnd() - 0.5) * 0.3,
      vy: -0.3 - rnd() * 0.3,
      l: 60,
      c: '#5d5852',
      g: -0.003,
    });
  flashes.push({ x: cx, y: cy, r: r + 4, l: 7 });
  G.shake = Math.max(G.shake, r > 15 ? 9 : 5);
  sfx('boom', cx, cy, r > 15 ? 1.4 : 1);
  for (const c of crew) {
    if (c.dead) continue;
    const dx = c.x + 3 - cx,
      dy = c.y + 5 - cy,
      d = Math.hypot(dx, dy) || 1;
    if (d < r + 9) {
      hurt(c, (r + 9 - d) * 2.1);
      startTumble(c, (dx / d) * 2.6, -2.2 + dy / d);
    }
  }
  for (const a of animals) {
    const dx = a.x + a.w / 2 - cx,
      dy = a.y + a.h / 2 - cy,
      d = Math.hypot(dx, dy) || 1;
    if (d < r + 10) {
      a.hp -= (r + 10 - d) * 4;
      a.hurt = 12;
      a.vx += (dx / d) * 2;
      a.vy -= 2;
    }
  }
  for (const it of items) {
    const dx = it.x - cx,
      dy = it.y - cy,
      d = Math.hypot(dx, dy) || 1;
    if (d < r + 7) {
      it.vx += (dx / d) * 2.5;
      it.vy -= 2.2;
      if ((it.t === 'flint' || it.t === 'tnt') && it.fuse < 0) {
        it.fuse = it.t === 'tnt' ? 20 : 8;
        it.armed = true;
      }
    }
  }
  for (const L of lorries) {
    const dx = L.x + 6 - cx,
      d = Math.hypot(dx, L.y + 3 - cy) || 1;
    if (d < r + 8) {
      L.vx += (dx / d) * 2;
      L.vy -= 2;
    }
  }
  for (const t of trees) {
    if (t.fall) continue;
    const dx = Math.abs(t.x - cx),
      dy = Math.abs(t.gy - cy);
    if (dx < r + 6 && dy < r + 16) t.fall = Math.sign(t.x - cx) || 1;
    else if (dx < r + 20 && dy < r + t.spr.height && rnd() < 0.6) ignite(t);
  }
  for (const c of crew) {
    if (c.dead) continue;
    if (Math.hypot(c.x + 3 - cx, c.y + 5 - cy) < r + 5 && rnd() < 0.5) c.burn = 150;
  }
}
function updParts() {
  for (let k = parts.length - 1; k >= 0; k--) {
    const p = parts[k];
    p.vy += p.g !== undefined ? p.g : 0.12;
    if (p.m !== undefined || p.rain) {
      if (p.vy > 3.5) p.vy = 3.5;
      const nx = p.x + p.vx,
        ny = p.y + p.vy,
        tx = Math.floor(nx),
        ty = Math.floor(ny);
      if (tx < 0 || tx >= W || ty >= H) {
        parts.splice(k, 1);
        continue;
      }
      if (ty >= 0 && mat[ty * W + tx] !== AIR) {
        const cx = Math.floor(p.x),
          cy = Math.floor(p.y);
        const ok = cy >= 0 && cy < H && cx >= 0 && cx < W && mat[cy * W + cx] === AIR;
        if (p.rain) {
          if (ok && rnd() < 0.07) setMat(cx, cy, WATER);
          else if (rnd() < 0.4)
            parts.push({ x: p.x, y: p.y - 1, vx: (rnd() - 0.5) * 0.6, vy: -0.5, l: 6, c: '#cfe6fa' });
        } else if (ok) setMat(cx, cy, p.m);
        parts.splice(k, 1);
        continue;
      }
      p.x = nx;
      p.y = ny;
      if (--p.l <= 0) parts.splice(k, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    if (--p.l <= 0) parts.splice(k, 1);
  }
  for (let k = flashes.length - 1; k >= 0; k--) if (--flashes[k].l <= 0) flashes.splice(k, 1);
}

export { DEBCOL, DEBRIS, explode, ignite, killAnimal, updAnimal, updArrows, updItems, updParts, updTrees };
