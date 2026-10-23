import { hasTool } from './tools.js';
import { onDig } from './hazards.js';
import { buzz } from './sound.js';
import { chestNear, openChest } from './treasure.js';
import { addFloat } from './floats.js';
import { track } from './profile.js';
import { dust, splash } from './effects.js';
import { insideB, midMat, moveBody, overlap, sel_, spawnItem, unstuck } from './entities.js';
import { inp } from './input.js';
import { sfx } from './sound.js';
import { G, builds, crew, lorries, parts, trees } from './state.js';
import { openBase, openBuild, toast } from './ui.js';
import {
  ACID,
  AIR,
  COAL,
  EARTH,
  GEM,
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
  boxFree,
  free,
  mat,
  paint,
  rnd,
  solid,
} from './world.js';

// ---- Clonk ----
function hurt(c, a, silent) {
  if (c.dead) return;
  c.energy -= a;
  if (a >= 5) {
    addFloat(c.x + 3, c.y - 3, '-' + Math.round(a), '#ff6a5a');
    if (c === sel_()) buzz(40 + Math.min(120, a * 4));
  }
  c.hurt = 12;
  if (!silent && a > 3) sfx('hurt', c.x, c.y);
  if (c.energy <= 0) killClonk(c);
}
function killClonk(c) {
  c.dead = true;
  c.energy = 0;
  c.deadT = 0;
  c.tumble = false;
  c.climb = c.hangle = false;
  for (const t of c.inv) spawnItem(t, c.x + 2, c.y + 2, (rnd() - 0.5) * 1.5, -1.2, 30);
  c.inv = [];
  toast('{name} ist erschöpft', { name: c.name });
  sfx('hurt', c.x, c.y);
  if (crew[G.sel] === c) {
    const nx = crew.findIndex(o => !o.dead);
    if (nx >= 0) G.sel = nx;
  }
}
function startTumble(c, vx, vy) {
  if (c.dead) return;
  c.tumble = true;
  c.climb = c.hangle = false;
  c.digging = false;
  c.chop = null;
  c.bridge = null;
  c.getup = 0;
  c.vx = vx;
  c.vy = vy;
}
function digAt(cx, cy, r) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || x >= W) continue;
      const dx = x + 0.5 - cx,
        dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r2) continue;
      digCell(x, y);
    }
  }
  spawnFromDig(cx, cy);
}
const CRUMB = {
  [EARTH]: '#7d5230',
  [SAND]: '#d9b56a',
  [LOAM]: '#b07a45',
  [ORE]: '#9a5a46',
  [COAL]: '#3b3735',
  [GEM]: '#b6f6ff',
  [GOLD]: '#ffe066',
  [ROCK]: '#8a847c',
};
function digCell(x, y) {
  const i = y * W + x,
    m = mat[i];
  if (m === ROCK) {
    // the steel pick chips slowly through rock
    if (!hasTool('pick') || rnd() > 0.3) return;
  } else if (m !== EARTH && m !== SAND && m !== GOLD && m !== LOAM && m !== ORE && m !== COAL && m !== GEM) return;
  if (rnd() < 0.06) parts.push({ x, y, vx: (rnd() - 0.5) * 1.2, vy: -rnd(), l: 20, c: CRUMB[m] });
  if (m === GOLD) {
    G.goldDust++;
    if (rnd() < 0.25) parts.push({ x, y, vx: (rnd() - 0.5) * 1.2, vy: -rnd() * 1.4, l: 25, c: '#ffe066' });
  } else if (m === EARTH) G.earthDug++;
  else if (m === LOAM) G.loamDug++;
  else if (m === ORE) G.oreDug++;
  else if (m === COAL) G.coalDug++;
  else if (m === GEM) G.gemDug = (G.gemDug || 0) + 1;
  mat[i] = AIR;
  bg[i] = 1;
  paint(i);
  onDig(x, y);
}
function spawnFromDig(cx, cy) {
  while (G.goldDust >= 16) {
    G.goldDust -= 16;
    spawnItem('nug', cx - 1, cy - 1, (rnd() - 0.5) * 1.5, -1.2, 10);
    sfx('pick', cx, cy);
  }
  if (G.oreDug >= 45) {
    G.oreDug = 0;
    spawnItem('ore', cx - 1, cy - 2, rnd() - 0.5, -1, 20);
    sfx('pick', cx, cy);
  }
  if (G.coalDug >= 45) {
    G.coalDug = 0;
    spawnItem('coal', cx - 1, cy - 2, rnd() - 0.5, -1, 20);
    sfx('pick', cx, cy);
  }
  if (G.gemDug >= 24) {
    G.gemDug = 0;
    spawnItem('gem', cx - 1, cy - 2, rnd() - 0.5, -1.2, 10);
    track('gem');
    sfx('coin', cx, cy);
  }
  if (G.loamDug >= 90) {
    G.loamDug = 0;
    spawnItem('loam', cx - 2, cy - 2, rnd() - 0.5, -1, 20);
  }
  if (G.earthDug >= 260) {
    G.earthDug = 0;
    spawnItem(rnd() < 0.3 ? 'flint' : 'rock', cx - 1, cy - 2, rnd() - 0.5, -1, 30);
  }
}
function nearTree(c) {
  for (const t of trees) {
    if (t.fall) continue;
    if (Math.abs(c.x + 3 - t.x) < 8 && Math.abs(c.y + 10 - t.gy) < 5) return t;
  }
  return null;
}
const NOIN = { ax: 0, ay: 0, dig: false, jumpP: false, jumpUp: false, throwP: false, actP: false };
function updClonk(c, I) {
  if (c.dead) {
    c.deadT++;
    c.vy = Math.min(c.vy + 0.17, 4);
    moveBody(c, c.vx * 0.9, c.vy, 0);
    c.vx *= 0.9;
    return;
  }
  if (c.hurt > 0) c.hurt--;
  unstuck(c);
  const mBody = midMat(c, 0.6),
    mHead = midMat(c, 0.1),
    mFeet = midMat(c, 0.95);
  const inLiq = LIQ[mBody],
    headLiq = LIQ[mHead];
  if (inLiq && !c.wasLiq && c.vy > 1) {
    splash(c.x + 1, c.y + 5, 10);
    sfx('splash', c.x, c.y);
  }
  c.wasLiq = inLiq;
  if (mBody === LAVA || mFeet === LAVA) {
    hurt(c, 1.1, true);
    if (G.frame % 20 === 0) sfx('hurt', c.x, c.y);
    if (!c.tumble && rnd() < 0.04) {
      c.vy = -2.6;
    }
    if (rnd() < 0.3)
      parts.push({ x: c.x + rnd() * 6, y: c.y + rnd() * 10, vx: 0, vy: -0.6, l: 15, c: '#ffb03a', g: -0.01 });
  }
  if (mBody === ACID || mHead === ACID) hurt(c, 0.3, true);
  if ((mBody === LAVA || mFeet === LAVA) && c.burn < 120) c.burn = 240;
  if (c.burn > 0) {
    c.burn--;
    hurt(c, 0.12, true);
    if (rnd() < 0.5)
      parts.push({
        x: c.x + rnd() * 6,
        y: c.y + rnd() * 8,
        vx: (rnd() - 0.5) * 0.3,
        vy: -0.5 - rnd() * 0.5,
        l: 12,
        c: rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f',
        g: -0.01,
      });
    if (mBody === WATER || mHead === WATER || (G.rainT > 0 && rnd() < 0.01)) {
      c.burn = 0;
      sfx('hiss', c.x, c.y);
      for (let q = 0; q < 6; q++)
        parts.push({ x: c.x + 3, y: c.y + 2, vx: (rnd() - 0.5) * 0.5, vy: -0.6, l: 30, c: '#e8eef2', g: -0.004 });
    }
    if (G.frame % 40 === 0) sfx('crackle', c.x, c.y);
  }
  if (headLiq) {
    c.breath -= 0.2;
    if (c.breath <= 0) {
      c.breath = 0;
      hurt(c, 0.35, true);
    }
  } else c.breath = Math.min(100, c.breath + 1.5);
  if (c.dead) return;
  // AI for idle clonks: get out of liquids
  if (I === NOIN && headLiq) I = { ...NOIN, ay: -1 };

  if (c.tumble) {
    c.vy = Math.min(c.vy + 0.17, 4.5);
    if (inLiq) {
      c.vx *= 0.92;
      c.vy *= 0.92;
    }
    const vx0 = c.vx,
      vy0 = c.vy;
    const [bx, by] = moveBody(c, c.vx, c.vy, 0);
    if (bx) c.vx = -vx0 * 0.4;
    if (by) {
      if (vy0 > 4.4) hurt(c, (vy0 - 4.4) * 15);
      c.vy = vy0 > 1 ? -vy0 * 0.3 : 0;
      c.vx *= 0.8;
    }
    c.rot += c.vx * 0.35 + (by ? 0 : 0.08 * Math.sign(c.vx || 1));
    const onG = !free(c.x, c.y + 1, 6, 10);
    if (onG && Math.abs(c.vx) < 0.35 && Math.abs(c.vy) < 0.6) {
      c.getup++;
      c.vx *= 0.7;
      if (c.getup > 30) {
        c.tumble = false;
        c.rot = 0;
      }
    }
    if (inLiq) {
      c.getup += 2;
      if (c.getup > 30) {
        c.tumble = false;
        c.rot = 0;
      }
    }
    return;
  }
  // bridge building
  if (c.bridge) {
    const b = c.bridge;
    b.n++;
    if (b.n % 2 === 0) {
      const k = b.n / 2,
        x = Math.floor(b.x0 + c.face * k),
        y = Math.floor(b.y0 + b.dy * k);
      for (let t = 0; t < b.th; t++) {
        const yy = y + t;
        if (x >= 0 && x < W && yy >= 0 && yy < H) {
          const i = yy * W + x;
          if (mat[i] === AIR || LIQ[mat[i]]) {
            mat[i] = b.m;
            paint(i);
          }
        }
      }
      if (k % 4 === 0) sfx('hammer', c.x, c.y);
    }
    if (b.n >= b.len || (Math.abs(I.ax) > 0.5 && Math.sign(I.ax) !== c.face) || I.jumpP) c.bridge = null;
    c.vx = c.vy = 0;
    c.anim += 0.2;
    return;
  }
  // chopping
  if (c.chop) {
    const t = c.chop;
    if (t.fall || Math.abs(I.ax) > 0.5 || I.jumpP || I.dig) {
      c.chop = null;
    } else {
      c.face = Math.sign(t.x - (c.x + 3)) || c.face;
      t.hp--;
      c.anim += 0.25;
      if (G.frame % 14 === 0) {
        sfx('chop', c.x, c.y);
        for (let q = 0; q < 3; q++)
          parts.push({ x: t.x, y: t.gy - 4, vx: (rnd() - 0.5) * 1.5, vy: -rnd() * 1.2, l: 20, c: '#d9b98a' });
      }
      if (t.hp <= 0) {
        t.fall = c.face;
        track('chop');
        c.chop = null;
        sfx('creak', t.x, t.gy);
      }
      c.vx = 0;
    }
    if (c.chop) return;
  }
  const contact = !boxFree(c.x - 3, c.y - 3, 12, 16);
  if (I.dig && contact && !c.climb && !c.hangle) {
    // Clonk-style digging: only horizontal or slanted, never straight up/down
    if (Math.abs(I.ax) > 0.25) c.face = Math.sign(I.ax);
    const mag = Math.hypot(I.ax, I.ay);
    // snap to three directions: straight, slanted down, slanted up
    const raw = mag < 0.3 ? 0 : Math.atan2(I.ay, Math.max(0.001, Math.abs(I.ax)));
    const ang = raw > 0.45 ? 0.78 : raw < -0.45 ? -0.55 : 0;
    const dxv = c.face * Math.cos(ang),
      dyv = Math.sin(ang);
    c.digging = true;
    c.digDir = [dxv, dyv];
    digAt(c.x + 3 + dxv * 5, c.y + 5 + dyv * 6, 5.5);
    c.vx = c.vy = 0;
    const sp = hasTool('pick') ? 0.8 : 0.55;
    moveBody(c, dxv * sp, dyv * sp, 3);
    c.anim += 0.3;
    if (G.frame % 9 === 0) sfx('dig', c.x, c.y);
    return;
  }
  c.digging = false;
  if (c.climb) {
    climbUpd(c, I);
    return;
  }
  if (c.hangle) {
    hangleUpd(c, I);
    return;
  }

  const onG = !free(c.x, c.y + 1, 6, 10);
  let tvx = Math.abs(I.ax) < 0.25 ? 0 : I.ax * (inLiq ? 0.6 : 1.05);
  if (Math.abs(I.ax) > 0.25) c.face = Math.sign(I.ax);
  c.vx += (tvx - c.vx) * (onG ? 0.4 : inLiq ? 0.15 : 0.1);
  if (inLiq) {
    c.vy += 0.04;
    c.vy *= 0.9;
    if (I.ay < -0.4) c.vy -= 0.12;
    if (I.ay > 0.4) c.vy += 0.06;
  } else c.vy = Math.min(c.vy + 0.17, 4.5);
  let jumped = false;
  const riding = builds.some(b => b.cs && b.done && onCase(c, b.cs));
  if (I.jumpP && !(riding && I.jumpUp)) {
    if (onG) {
      c.vy = -2.55;
      jumped = true;
      sfx('jump', c.x, c.y);
    } else if (inLiq) {
      c.vy = -1.8;
      jumped = true;
    }
  }
  const fallV = c.vy;
  const [bx, by] = moveBody(c, c.vx, c.vy, onG ? 3 : 0);
  if (by && fallV > 2.4) dust(c.x, c.y + 9, Math.round(fallV * 2), '#b89a76');
  if (by) {
    if (fallV > 3.9) {
      const d = (fallV - 3.9) * 22;
      hurt(c, d);
      if (fallV > 4.4) startTumble(c, c.vx, -0.8);
      else sfx('thud', c.x, c.y);
    } else if (fallV < -1 && !inLiq && !boxFree(c.x, c.y - 1, 6, 1)) {
      c.hangle = true;
      c.vx = c.vy = 0;
      return;
    }
    c.vy = 0;
  }
  if (bx) {
    if (!inLiq && Math.abs(I.ax) > 0.3) {
      c.climb = true;
      c.face = Math.sign(I.ax);
    }
    c.vx = 0;
  }
  if (onG && !jumped && c.vy >= 0 && free(c.x, c.y + 1, 6, 10)) {
    for (let s = 1; s <= 3; s++)
      if (!free(c.x, c.y + s + 1, 6, 10)) {
        c.y += s;
        break;
      }
  }
  if (onG) c.anim += Math.abs(c.vx) * 0.35;
  else if (inLiq) c.anim += 0.12;
  if (onG && Math.abs(c.vx) > 0.8 && G.frame % 12 === 0) dust(c.x, c.y + 9, 1, '#b89a76');
}
function climbUpd(c, I) {
  const f = c.face,
    sideX = f > 0 ? Math.floor(c.x) + 6 : Math.floor(c.x) - 1,
    y0 = Math.floor(c.y);
  let wall = false;
  for (let yy = y0; yy < y0 + 10; yy++)
    if (solid(sideX, yy)) {
      wall = true;
      break;
    }
  if (!wall) {
    c.climb = false;
    if (free(c.x + f * 2, c.y, 6, 10)) c.x += f * 2;
    c.vx = f * 0.6;
    c.vy = -0.4;
    return;
  }
  if (I.jumpP && !I.jumpUp) {
    c.climb = false;
    c.face = -f;
    c.vx = -f * 1.6;
    c.vy = -2.1;
    sfx('jump', c.x, c.y);
    return;
  }
  if (I.ax * f < -0.4) {
    c.climb = false;
    c.vx = -f * 0.6;
    return;
  }
  const up = I.ay < -0.3 || I.ax * f > 0.3,
    down = I.ay > 0.4;
  if (up) {
    if (free(c.x, c.y - 0.7, 6, 10)) {
      c.y -= 0.7;
      c.anim += 0.25;
    } else if (!boxFree(c.x, c.y - 1, 6, 1)) {
      c.climb = false;
      c.hangle = true;
    }
  } else if (down) {
    if (free(c.x, c.y + 0.7, 6, 10)) {
      c.y += 0.7;
      c.anim += 0.25;
    } else c.climb = false;
  }
  c.vx = c.vy = 0;
}
function hangleUpd(c, I) {
  c.vx = c.vy = 0;
  if (I.ay > 0.4 || (I.jumpP && !I.jumpUp)) {
    c.hangle = false;
    c.vy = 0.5;
    return;
  }
  const ceil = x => {
    const x0 = Math.floor(x),
      y = Math.floor(c.y) - 1;
    for (let xx = x0 + 1; xx < x0 + 5; xx++) if (solid(xx, y)) return true;
    return false;
  };
  if (!ceil(c.x)) {
    c.hangle = false;
    return;
  }
  if (Math.abs(I.ax) > 0.3) {
    const s = Math.sign(I.ax) * 0.6;
    c.face = Math.sign(I.ax);
    if (free(c.x + s, c.y, 6, 10) && ceil(c.x + s)) {
      c.x += s;
      c.anim += 0.2;
    } else if (!free(c.x + s, c.y, 6, 10)) {
      c.hangle = false;
      c.climb = true;
    }
  }
}
function onCase(e, cs) {
  return !e.climb && Math.abs(e.y + e.h - cs.y) < 1.5 && e.x + e.w > cs.x && e.x < cs.x + 12;
}
function doThrow(c, I) {
  if (!I.throwP || !c.inv.length || c.climb || c.tumble) return;
  if (c.isel >= c.inv.length) c.isel = c.inv.length - 1;
  const t = c.inv.splice(c.isel, 1)[0];
  if (c.isel >= c.inv.length) c.isel = Math.max(0, c.inv.length - 1);
  let vx = c.face * 2.5 + c.vx * 0.5,
    vy = -2;
  if (I.ay < -0.4) {
    vx = c.face * 1.4;
    vy = -3.2;
  } else if (I.ay > 0.4) {
    vx = c.face * 0.5;
    vy = 0;
  }
  const it = spawnItem(t, c.x + 2 + c.face * 3, c.y + 1, vx, vy, 40, c);
  if (t === 'flint') it.armed = true;
  if (t === 'tnt') it.fuse = 110;
  sfx('throw', c.x, c.y);
}

// ---- Context action ----
function lorryNear(c) {
  return lorries.find(L => overlap(c, L, 3)) || null;
}
function context(c) {
  if (!c || c.dead) return { label: '—' };
  if (insideB(c, G.base)) return { label: 'Basis', fn: () => openBase() };
  const ch = chestNear(c);
  if (ch) return { label: 'Öffnen', fn: () => openChest(ch) };
  const L = lorryNear(c);
  if (L) return { label: 'Lore', fn: () => lorryAct(c, L) };
  const t = nearTree(c);
  if (t && !free(c.x, c.y + 1, 6, 10))
    return {
      label: 'Fällen',
      fn: () => {
        c.chop = t;
      },
    };
  const it = c.inv[c.isel];
  if (it === 'loam') return { label: 'Brücke', fn: () => startBridge(c, LOAM) };
  if (it === 'plank') return { label: 'Brücke', fn: () => startBridge(c, PLANK) };
  if (it === 'tnt')
    return {
      label: 'Zünden',
      fn: () => {
        c.inv.splice(c.isel, 1);
        const s = spawnItem('tnt', c.x + 2, c.y + 6, 0, 0, 999);
        s.fuse = 150;
        toast('Lauf!');
        sfx('fuse', c.x, c.y);
      },
    };
  return { label: 'Bauen', fn: () => openBuild() };
}
function startBridge(c, m) {
  if (c.climb || c.hangle || c.tumble) return;
  c.inv.splice(c.isel, 1);
  if (c.isel >= c.inv.length) c.isel = Math.max(0, c.inv.length - 1);
  const dy = inp.ay < -0.4 ? -0.5 : inp.ay > 0.4 ? 0.5 : 0;
  c.bridge = {
    n: 0,
    x0: c.x + 3 + c.face * 4,
    y0: c.y + 10,
    dy,
    m,
    len: m === PLANK ? 84 : 56,
    th: m === PLANK ? 2 : 3,
  };
}
function lorryAct(c, L) {
  if (c.inv.length) {
    const n = Math.min(c.inv.length, 25 - L.items.length);
    if (n <= 0) {
      toast('Lore ist voll');
      return;
    }
    L.items.push(...c.inv.splice(0, n));
    c.isel = 0;
    toast('{n} Sachen in die Lore', { n });
    sfx('pick', c.x, c.y);
  } else if (L.items.length) {
    const n = Math.min(5, L.items.length);
    c.inv.push(...L.items.splice(L.items.length - n, n));
    toast('{n} Sachen genommen', { n });
    sfx('pick', c.x, c.y);
  } else toast('Lore ist leer');
}

export {
  NOIN,
  climbUpd,
  context,
  digAt,
  digCell,
  doThrow,
  hangleUpd,
  hurt,
  killClonk,
  lorryAct,
  lorryNear,
  nearTree,
  onCase,
  spawnFromDig,
  startBridge,
  startTumble,
  updClonk,
};
