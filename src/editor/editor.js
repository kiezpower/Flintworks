// Level editor (dev server only, /editor.html): paint the map of a level (map.txt) character by
// character, place objects and areas, edit the rest of level.json, save it to src/levels/<id>/
// and play it right away. Like painting Map.bmp and Objects.txt in the original Clonk.
import { CHARS } from '../levels/palette.js';
import ORDER from '../levels/order.json';
import './editor.css';

const PACKS = import.meta.glob('../levels/*/level.json', { eager: true, import: 'default' });
const MAPS = import.meta.glob('../levels/*/map.txt', { eager: true, query: '?raw', import: 'default' });
const DRAFT = 'flintworks-level-draft';
const $ = id => document.getElementById(id);

// colours of the map characters (close to the game's map)
const COL = {
  '.': '#8fc3ea',
  ',': '#3a2416',
  '#': '#7d5230',
  R: '#77726b',
  S: '#d9b56a',
  L: '#ad7642',
  G: '#f2c230',
  O: '#9a5a46',
  C: '#2a2626',
  E: '#5fd3e8',
  X: '#3b3640',
  P: '#a0703f',
  '~': '#3b7fc4',
  '%': '#ff7a2a',
  A: '#7ed957',
  '?': '#6a4428',
};
const NAMES = {
  '.': 'Himmel',
  ',': 'Höhle',
  '#': 'Erde',
  R: 'Fels',
  S: 'Sand',
  L: 'Lehm',
  G: 'Gold',
  O: 'Erz',
  C: 'Kohle',
  E: 'Edelstein',
  X: 'Granit',
  P: 'Planke',
  '~': 'Wasser',
  '%': 'Lava',
  A: 'Säure',
  '?': 'Zufall',
};
// what the object tool places: [label, object, has a height (else it stands on the ground)]
const OBJS = [
  ['Burg', { t: 'base' }, false],
  ['Baum', { t: 'tree', stage: 4 }, false],
  ['Feuerstein', { t: 'item', kind: 'flint' }, false],
  ['Sprengstoff', { t: 'item', kind: 'tnt' }, false],
  ['Wipf (eingeschlossen)', { t: 'animal', kind: 'wipf', lost: true }, true],
  ['Wipf', { t: 'animal', kind: 'wipf' }, false],
  ['Monster', { t: 'animal', kind: 'monster' }, true],
  ['Fledermaus', { t: 'animal', kind: 'bat' }, true],
  ['Wühler (verschüttet)', { t: 'trapped' }, true],
  ['Truhe', { t: 'chest' }, true],
  ['Grubengas', { t: 'gas', r: 8 }, true],
];
const TOOLS = [
  ['brush', 'Pinsel'],
  ['rect', 'Rechteck'],
  ['fill', 'Füllen'],
  ['obj', 'Objekt'],
  ['area', 'Bereich'],
];

let L = null, // level.json without the map
  grid = null, // rows of characters
  tool = 'brush',
  ch = '#',
  undo = [],
  scale = 4,
  drag = null;

// ---- loading ----
function load(id) {
  const pack = PACKS[`../levels/${id}/level.json`];
  L = structuredClone(pack);
  grid = MAPS[`../levels/${id}/map.txt`]
    .replace(/\r/g, '')
    .split('\n')
    .filter(r => r.length)
    .map(r => [...r]);
  undo = [];
  showJson();
  fit();
  msg(`${id} geladen`);
}
function fresh() {
  const id = prompt('Name des Ordners (klein, ohne Leerzeichen):', 'neues-level');
  if (!id || !/^[a-z0-9-]{2,40}$/.test(id)) return msg('Ungültiger Name');
  const ask = prompt('Größe in Pixeln (Breite x Höhe, 300–2800 x 150–700):', '800x300') || '',
    size = ask.split('x').map(Number);
  const zoom = Number(prompt('Zoom (Pixel je Zeichen):', '4')) || 4;
  if (!(size[0] >= 300 && size[0] <= 2800 && size[1] >= 150 && size[1] <= 700)) return msg('Ungültige Größe');
  const mw = Math.round(size[0] / zoom),
    mh = Math.round(size[1] / zoom),
    top = Math.round(mh * 0.3);
  grid = [];
  for (let y = 0; y < mh; y++)
    grid.push([...Array(mw)].map(() => (y < top ? '.' : y < top + 2 ? '#' : y >= mh - 2 ? 'X' : '?')));
  L = {
    id,
    v: 1,
    name: id,
    icon: 'castle',
    desc: 'Verdiene {goal} Taler',
    intro: '',
    biome: 'meadow',
    size: [mw * zoom, mh * zoom],
    zoom,
    rough: 0.5,
    seed: (Math.random() * 9000 + 1000) | 0,
    diff: 'adventure',
    fill: {},
    start: { money: 40, crew: 3 },
    rules: { meteors: false },
    objects: [{ t: 'base', x: 40 }],
    areas: {},
    goals: [{ t: 'money', n: 300 }],
    lose: { crewDead: true },
    stars: [8, 14],
    triggers: [],
  };
  undo = [];
  addOption(id);
  $('pick').value = id;
  showJson();
  fit();
  msg('Neues Level – Speichern legt den Ordner an');
}
function addOption(id) {
  if ([...$('pick').options].some(o => o.value === id)) return;
  const o = document.createElement('option');
  o.value = o.textContent = id;
  $('pick').appendChild(o);
}

// ---- level.json in the text box ----
const mapText = () => grid.map(r => r.join('')).join('\n') + '\n';
function showJson() {
  $('json').value = JSON.stringify(L, null, 1);
}
function applyJson() {
  try {
    const n = JSON.parse($('json').value);
    const z = n.zoom || 1;
    // a new size or zoom: the map is cut or padded (with what is at its edge)
    const mw = Math.round(n.size[0] / z),
      mh = Math.round(n.size[1] / z);
    if (mw !== grid[0].length || mh !== grid.length) {
      if (z !== L.zoom) return msg('Zoom und Größe nicht gleichzeitig ändern');
      push();
      grid = [...Array(mh)].map((_, y) =>
        [...Array(mw)].map((_, x) => grid[Math.min(y, grid.length - 1)][Math.min(x, grid[0].length - 1)]),
      );
      n.size = [mw * z, mh * z];
    }
    L = n;
    showJson();
    fit();
    msg('Übernommen');
  } catch (e) {
    msg('JSON-Fehler: ' + e.message);
  }
}

// ---- drawing the map ----
const cv = $('cv'),
  ctx = cv.getContext('2d');
function fit() {
  const v = $('view').getBoundingClientRect();
  scale = Math.max(1, Math.floor(Math.min((v.width - 16) / grid[0].length, (v.height - 40) / grid.length)));
  cv.width = grid[0].length * scale;
  cv.height = grid.length * scale;
  draw();
}
// the top of the ground in a map column, in world pixels
const groundY = wx => {
  const mx = Math.min(grid[0].length - 1, Math.max(0, Math.floor(wx / L.zoom)));
  let y = 0;
  while (y < grid.length - 1 && grid[y][mx] === '.') y++;
  return y * L.zoom;
};
const wxOf = x => (x < 0 ? L.size[0] + x : x);
function draw() {
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[0].length; x++) {
      const c = grid[y][x];
      ctx.fillStyle = COL[c] || '#ff00ff';
      ctx.fillRect(x * scale, y * scale, scale, scale);
      if (c === '?' && scale > 2 && (x + y) % 3 === 0) {
        ctx.fillStyle = '#8a5a32';
        ctx.fillRect(x * scale, y * scale, scale / 2, scale / 2);
      }
    }
  const k = scale / L.zoom; // screen pixels per world pixel
  ctx.lineWidth = 1;
  for (const [name, a] of Object.entries(L.areas || {})) {
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(wxOf(a[0]) * k + 0.5, a[1] * k + 0.5, a[2] * k, a[3] * k);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.fillText(name, wxOf(a[0]) * k + 3, a[1] * k + 12);
  }
  for (const o of L.objects || []) {
    const x = wxOf(o.x ?? 0),
      y = o.y ?? groundY(x);
    if (o.t === 'base') {
      ctx.fillStyle = 'rgba(200,190,170,.85)';
      ctx.fillRect(x * k, (y - 30) * k, 36 * k, 30 * k);
      continue;
    }
    const col = { tree: '#3f9e4a', item: '#ff4040', animal: o.lost ? '#ffffff' : '#f2e6d0', trapped: '#ffe066' };
    ctx.fillStyle = col[o.t] || (o.t === 'chest' ? '#b8860b' : '#c0ff60');
    const s = Math.max(4, 5 * k);
    ctx.fillRect(x * k - s / 2, y * k - s, s, s);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x * k - s / 2 + 0.5, y * k - s + 0.5, s - 1, s - 1);
  }
  if (drag && (drag.tool === 'rect' || drag.tool === 'area')) {
    ctx.strokeStyle = '#ffe066';
    const [x0, y0, x1, y1] = box(drag);
    ctx.strokeRect(x0 * scale + 0.5, y0 * scale + 0.5, (x1 - x0 + 1) * scale, (y1 - y0 + 1) * scale);
  }
}

// ---- editing ----
function push() {
  undo.push({ grid: grid.map(r => [...r]), L: structuredClone(L) });
  if (undo.length > 60) undo.shift();
}
function back() {
  const u = undo.pop();
  if (!u) return;
  grid = u.grid;
  L = u.L;
  showJson();
  fit();
}
const cellOf = e => {
  const r = cv.getBoundingClientRect();
  return [Math.floor((e.clientX - r.left) / scale), Math.floor((e.clientY - r.top) / scale)];
};
const inGrid = (x, y) => x >= 0 && y >= 0 && x < grid[0].length && y < grid.length;
function dab(x, y) {
  const r = +$('brush').value;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (dx * dx + dy * dy <= r * r + r && inGrid(x + dx, y + dy)) grid[y + dy][x + dx] = ch;
}
function flood(x, y) {
  const from = grid[y][x];
  if (from === ch) return;
  const st = [[x, y]];
  while (st.length) {
    const [cx, cy] = st.pop();
    if (!inGrid(cx, cy) || grid[cy][cx] !== from) continue;
    grid[cy][cx] = ch;
    st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}
const box = d => [Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.max(d.x0, d.x1), Math.max(d.y0, d.y1)];
function placeObject(x, y, remove) {
  const z = L.zoom,
    wx = x * z + (z >> 1),
    wy = y * z + (z >> 1);
  L.objects = L.objects || [];
  if (remove) {
    let best = -1,
      bd = 12 * 12;
    L.objects.forEach((o, k) => {
      const ox = wxOf(o.x ?? 0),
        oy = o.y ?? groundY(ox),
        d = (ox - wx) ** 2 + (oy - wy) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    if (best >= 0) L.objects.splice(best, 1);
    return;
  }
  const [, proto, high] = OBJS[+$('objType').value];
  const o = { ...proto, x: wx };
  if (high) o.y = wy;
  // only one castle
  if (o.t === 'base') L.objects = L.objects.filter(q => q.t !== 'base');
  L.objects.push(o);
}

cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  const [x, y] = cellOf(e);
  if (!inGrid(x, y)) return;
  if (e.button === 2) {
    // eyedropper
    ch = grid[y][x];
    showPal();
    return;
  }
  push();
  cv.setPointerCapture(e.pointerId);
  if (tool === 'brush') dab(x, y);
  else if (tool === 'fill') flood(x, y);
  else if (tool === 'obj') placeObject(x, y, e.shiftKey);
  drag = { tool, x0: x, y0: y, x1: x, y1: y, lx: x, ly: y };
  draw();
});
cv.addEventListener('pointermove', e => {
  const [x, y] = cellOf(e);
  if (inGrid(x, y))
    $('pos').textContent = `x ${x * L.zoom} · y ${y * L.zoom} (Zeichen ${x}, ${y}: ${NAMES[grid[y][x]]})`;
  if (!drag) return;
  if (drag.tool === 'brush') {
    // a line from the last point, so fast strokes leave no gaps
    const n = Math.max(Math.abs(x - drag.lx), Math.abs(y - drag.ly));
    for (let k = 1; k <= n; k++)
      dab(Math.round(drag.lx + ((x - drag.lx) * k) / n), Math.round(drag.ly + ((y - drag.ly) * k) / n));
    drag.lx = x;
    drag.ly = y;
  }
  drag.x1 = x;
  drag.y1 = y;
  draw();
});
cv.addEventListener('pointerup', () => {
  if (!drag) return;
  const [x0, y0, x1, y1] = box(drag);
  if (drag.tool === 'rect')
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inGrid(x, y)) grid[y][x] = ch;
  if (drag.tool === 'area' && (x1 > x0 || y1 > y0)) {
    const name = prompt('Name des Bereichs:');
    const z = L.zoom;
    if (name) (L.areas = L.areas || {})[name] = [x0 * z, y0 * z, (x1 - x0 + 1) * z, (y1 - y0 + 1) * z];
  }
  drag = null;
  showJson();
  draw();
});
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && document.activeElement !== $('json')) {
    e.preventDefault();
    back();
  }
});
addEventListener('resize', () => grid && fit());

// ---- side panel ----
function showPal() {
  $('pal').innerHTML = '';
  for (const c of Object.keys(CHARS)) {
    const b = document.createElement('button');
    b.className = 'sw' + (c === ch ? ' on' : '');
    b.title = `${NAMES[c]} (${c})`;
    b.innerHTML = `<i style="background:${COL[c]}"></i>${NAMES[c]}`;
    b.onclick = () => {
      ch = c;
      if (tool === 'obj' || tool === 'area') setTool('brush');
      showPal();
    };
    $('pal').appendChild(b);
  }
}
function setTool(t) {
  tool = t;
  for (const b of $('tools').children) b.classList.toggle('on', b.dataset.t === t);
}
for (const [t, label] of TOOLS) {
  const b = document.createElement('button');
  b.dataset.t = t;
  b.textContent = label;
  b.onclick = () => setTool(t);
  $('tools').appendChild(b);
}
OBJS.forEach(([label], k) => {
  const o = document.createElement('option');
  o.value = k;
  o.textContent = label;
  $('objType').appendChild(o);
});
$('objType').onchange = () => setTool('obj');
for (const id of ORDER) addOption(id);
for (const p in PACKS) addOption(p.split('/')[2]);
$('pick').onchange = () => load($('pick').value);
$('newBtn').onclick = fresh;
$('applyBtn').onclick = applyJson;
const msg = t => ($('msg').textContent = t);

const pkg = () => ({ ...L, map: mapText() });
$('playBtn').onclick = () => {
  localStorage.setItem(DRAFT, JSON.stringify(pkg()));
  location.href = './?draft=1';
};
$('saveBtn').onclick = async () => {
  const r = await fetch('/__levels/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ level: L, map: mapText() }),
  });
  const d = await r.json();
  msg(d.ok ? `Gespeichert in src/levels/${L.id}/` : 'Fehler: ' + d.error);
};
$('dlBtn').onclick = () => {
  for (const [name, text] of [
    ['level.json', JSON.stringify(L, null, 2) + '\n'],
    ['map.txt', mapText()],
  ]) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = name;
    a.click();
  }
};

setTool('brush');
showPal();
// ?level=<id> (the way back from playing) opens that level; a draft of it wins over the saved one
{
  const want = new URLSearchParams(location.search).get('level');
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT));
  } catch {}
  if (want && draft && draft.id === want) {
    const { map, ...rest } = draft;
    L = rest;
    grid = map
      .split('\n')
      .filter(r => r.length)
      .map(r => [...r]);
    addOption(want);
    $('pick').value = want;
    showJson();
    fit();
    msg('Entwurf vom Probespielen');
  } else load(want && PACKS[`../levels/${want}/level.json`] ? want : ORDER[0]);
  if (want) $('pick').value = want;
}

// for the browser test
window.__editor = { get grid() { return grid; }, get L() { return L; }, mapText, setTool, set ch(c) { ch = c; } };
