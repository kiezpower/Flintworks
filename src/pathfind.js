// A* path finding for Wühler on the pixel landscape. Nodes are standing positions (top-left of
// the body box, feet on something solid). Moves: walk (with small steps up), drop off ledges,
// jump onto ledges up to jumpH pixels and, if allowed, dig through diggable material.
// The same code drives the helpers in the game and the workers in the lobby.

// o: { solid(x,y), dig?(x,y), bad?(x,y), w, h, stepX, maxStep, maxDrop, jumpH, digCost, maxNodes }
function mkNav(o) {
  const w = o.w || 6,
    h = o.h || 10;
  const clear = (x, y) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (o.solid(xx, yy)) return false;
    return true;
  };
  // how many cells must be dug to fit the body here (-1: something undiggable in the way)
  const digNeed = (x, y) => {
    let n = 0;
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++)
        if (o.solid(xx, yy)) {
          if (!o.dig(xx, yy)) return -1;
          n++;
        }
    return n;
  };
  const floor = (x, y) => {
    for (let xx = x + 1; xx < x + w - 1; xx++) if (o.solid(xx, y + h)) return true;
    return false;
  };
  const okNode = (x, y) => !o.bad || !o.bad(x, y);
  // fall from a free position until standing; null if the drop is too deep
  function settle(x, y) {
    let d = 0;
    while (!floor(x, y)) {
      if (!clear(x, y + 1)) return y;
      if (++d > (o.maxDrop || 40)) return null;
      y++;
    }
    return y;
  }
  // nearest standing position at or below (x, y)
  function standAt(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    for (let u = 0; u <= 6; u++) if (clear(x, y - u)) return settle(x, y - u);
    return null;
  }
  function neighbours(x, y, out) {
    out.length = 0;
    const sx = o.stepX || 2,
      ms = o.maxStep ?? 3,
      jh = o.jumpH || 16;
    for (const dir of [-1, 1]) {
      const nx = x + dir * sx;
      let walked = false;
      for (let u = 0; u <= ms; u++)
        if (clear(nx, y - u)) {
          const ny = settle(nx, y - u);
          if (ny !== null && okNode(nx, ny)) {
            out.push(nx, ny, sx + (ny > y ? (ny - y) * 0.15 : u * 0.3), ny > y + 4 ? 2 : 0);
            walked = true;
          }
          break;
        }
      if (!walked && jh > ms) {
        // jump: straight up with the head clear, then over onto the ledge
        for (let up = ms + 1; up <= jh; up++) {
          if (!clear(x, y - up)) break;
          let landed = false;
          for (const reach of [sx, sx * 2, sx * 3]) {
            const jx = x + dir * reach;
            if (!clear(jx, y - up)) continue;
            const ny = settle(jx, y - up);
            if (ny !== null && ny < y - ms && okNode(jx, ny)) {
              out.push(jx, ny, 6 + up * 0.6 + reach, 1);
              landed = true;
            }
            break;
          }
          if (landed) break;
        }
      }
      if (o.dig) {
        // dig sideways, slanted down or slanted up; the floor must stay under the feet
        // (8 pixel strokes: straight, down 1/2, up 3/8)
        const dx8 = x + dir * 8;
        for (const dy of [0, 4, -3]) {
          const ny = y + dy;
          if (clear(dx8, ny)) continue;
          const n = digNeed(dx8, ny);
          if (n > 0 && floor(dx8, ny) && okNode(dx8, ny)) out.push(dx8, ny, 9 + n * (o.digCost ?? 0.4), 3);
        }
      }
    }
    return out;
  }
  // goal(x,y) → true when reached; heur(x,y) → estimated rest cost
  function find(sx, sy, goal, heur, maxNodes = o.maxNodes || 3000) {
    const s = standAt(sx, sy);
    if (s === null) return null;
    const start = [Math.round(sx), s];
    const key = (x, y) => x * 4096 + y;
    const g = new Map(),
      prev = new Map(),
      act = new Map();
    const open = [];
    const push = (f, k) => {
      // binary heap on f
      open.push([f, k]);
      let i = open.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (open[p][0] <= open[i][0]) break;
        [open[p], open[i]] = [open[i], open[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = open[0],
        last = open.pop();
      if (open.length) {
        open[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1,
            r = l + 1;
          let m = i;
          if (l < open.length && open[l][0] < open[m][0]) m = l;
          if (r < open.length && open[r][0] < open[m][0]) m = r;
          if (m === i) break;
          [open[m], open[i]] = [open[i], open[m]];
          i = m;
        }
      }
      return top;
    };
    const k0 = key(...start);
    g.set(k0, 0);
    push(heur(...start), k0);
    const nb = [];
    let n = 0,
      best = k0,
      bestH = heur(...start);
    // a time budget too, so a hopeless search never makes the game stutter
    const t0 = performance.now(),
      budget = o.budget || 8;
    while (open.length && n++ < maxNodes) {
      if ((n & 63) === 0 && performance.now() - t0 > budget) break;
      const [f, k] = pop();
      const x = Math.floor(k / 4096),
        y = k % 4096;
      const gk = g.get(k);
      if (f - heur(x, y) > gk + 1e-6) continue; // stale entry
      if (goal(x, y)) return build(k);
      const hh = heur(x, y);
      if (hh < bestH) {
        bestH = hh;
        best = k;
      }
      neighbours(x, y, nb);
      for (let i = 0; i < nb.length; i += 4) {
        const nk = key(nb[i], nb[i + 1]),
          ng = gk + nb[i + 2];
        if (ng < (g.get(nk) ?? Infinity)) {
          g.set(nk, ng);
          prev.set(nk, k);
          act.set(nk, nb[i + 3]);
          push(ng + heur(nb[i], nb[i + 1]), nk);
        }
      }
    }
    return o.partial ? build(best, true) : null;
    function build(k, partial) {
      const path = [];
      while (k !== k0) {
        path.push({ x: Math.floor(k / 4096), y: k % 4096, a: act.get(k) });
        k = prev.get(k);
      }
      path.reverse();
      path.partial = !!partial;
      return path;
    }
  }
  return { find, standAt, clear, settle, neighbours };
}
const WALK = 0,
  JUMP = 1,
  DROP = 2,
  DIG = 3;
export { DIG, DROP, JUMP, WALK, mkNav };
