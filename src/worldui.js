// World management in the lobby and in the running game's menu.
import { G, esc } from './state.js';
import { P, saveProfile } from './profile.js';
import { GAME_MODES } from './modes.js';
import { NET, createRoom, inRoom } from './net/room.js';
import { saveGame, serialize } from './save.js';
import { saveNet } from './net/netsave.js';
import { archiveWorld } from './worldarchive.js';
import { MAX_IMPORT, readWorld, listWorlds, renameWorld, deleteWorld, exportWorld, importWorld } from './worldstore.js';
import { closePanel, openPanel, opt, sec, toast, panelEl } from './ui.js';
import { tr } from './i18n.js';
import { openShared, shareWorld, sharedInfo, sharedSeenAll, sharedWorlds, unshareWorld } from './net/shared.js';
import './worldui.css';

const mayManage = () => !inRoom() || (NET.host && !NET.auto);
async function preserve() {
  if (G.inRun && (!G.net || G.netHost)) {
    await archiveWorld({ data: serialize(), start: G.net ? G.netStart : null, players: NET.players.map(({ pid, fid, name }) => ({ pid, fid, name })) });
    saveGame(); saveNet();
  }
  await G.worldSavePending;
}
let busy = false;
const guard = fn => async () => {
  if (busy) return;
  busy = true;
  try { await fn(); } catch { toast('Welt konnte nicht geöffnet werden – die bisherige Welt bleibt gespeichert'); }
  finally { busy = false; }
};
// "vor 5 min", "vor 3 h", "vor 2 Tagen"
function ago(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 2) return tr('gerade eben');
  if (m < 90) return tr('vor {n} min', { n: m });
  if (m < 36 * 60) return tr('vor {n} h', { n: Math.round(m / 60) });
  return tr('vor {n} Tagen', { n: Math.round(m / 1440) });
}
// a shared world (net/shared.js): into the friends' room if they are in it, otherwise the latest
// state from the server, played in a room of one's own
async function playShared(id) {
  await preserve();
  const r = await openShared(id);
  if (r === 'ok' || r === 'joined') {
    closePanel();
    if (r === 'joined') G.onFriendJoin?.();
  } else toast(r);
}
// the list of shared worlds in the open panel; it follows the server (who is in it, who built last)
function drawShared() {
  const l = document.getElementById('worldShared');
  if (!l || panelEl.hidden) return;
  const sh = sharedWorlds(),
    head = l.previousElementSibling;
  l.innerHTML = '';
  l.hidden = !sh.length;
  if (head?.classList.contains('psec')) head.hidden = !sh.length;
  for (const w of sh) {
    const who = w.mine ? tr('von dir geteilt') : tr('von {name}', { name: w.ownerName || '?' });
    const what = w.room ? tr('{n} bauen gerade', { n: w.n || 1 }) : w.by ? tr('zuletzt {name}, {when}', { name: w.by, when: ago(w.updated) }) : '';
    opt(l, { title: esc(w.name), sub: esc(what ? `${who} · ${what}` : who), short: true, onClick: guard(() => playShared(w.id)) });
  }
  sharedSeenAll();
}
G.onSharedChange = drawShared;
function field(parent, label, value, id) {
  const l = document.createElement('label');
  l.className = 'world-field';
  l.textContent = tr(label);
  const input = document.createElement('input');
  input.id = id; input.value = value; input.maxLength = 48;
  l.appendChild(input); parent.appendChild(l);
  return input;
}
export async function openWorlds() {
  const p = openPanel('Meine Welten');
  const stamp = G.panelT;
  const active = () => !panelEl.hidden && G.panelT === stamp;
  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = tr('Welten bleiben auf diesem Gerät. Exportiere eine Sicherung für andere Geräte. Eine geteilte Welt liegt zusätzlich auf dem Server, damit deine Freunde weiterbauen können.');
  p.appendChild(note);
  if (!mayManage()) {
    note.textContent = tr('Der Host verwaltet die Welten. Verlasse den Raum für deine eigenen Welten.');
    return;
  }
  try { await preserve(); }
  catch { return; }
  let worlds;
  try { worlds = await listWorlds(); }
  catch { toast('Welt konnte nicht gespeichert werden – bitte Speicherplatz prüfen'); return; }
  if (!active()) return;
  // worlds shared among friends: mine and the ones friends share with me
  const shared = sec(p, 'Geteilte Welten');
  shared.id = 'worldShared';
  drawShared();
  const list = sec(p, 'Gespeicherte Welten');
  if (!worlds.length) {
    const empty = document.createElement('p'); empty.textContent = tr('Noch keine Welt gespeichert'); list.appendChild(empty);
  }
  for (const w of worlds) {
    opt(list, {
      title: esc(w.name), sub: `${esc(tr(GAME_MODES[w.save.data.mode]?.name || 'Siedlungswelt'))} · ${new Date(w.updated).toLocaleString()}${sharedInfo(w.id) ? ' · ' + esc(tr('geteilt')) : ''}`,
      short: true, onClick: guard(() => detail(w.id)),
    });
  }
  opt(sec(p, ''), { title: tr('Neue Siedlungswelt'), onClick: newWorld });
  const imp = sec(p, 'Sicherung importieren');
  const file = document.createElement('input');
  file.type = 'file'; file.accept = '.json,application/json'; file.id = 'worldImport';
  file.setAttribute('aria-label', tr('Sicherung importieren'));
  file.onchange = guard(async () => {
    if (!file.files?.length) return;
    const f = file.files[0];
    if (f.size > MAX_IMPORT) { toast('Diese Welt-Datei ist ungültig oder zu groß'); return; }
    try { await importWorld(await f.text(), Object.keys(GAME_MODES)); }
    catch { toast('Diese Welt-Datei ist ungültig oder zu groß'); return; }
    if (active()) await openWorlds();
  });
  imp.appendChild(file);
}
async function detail(id) {
  const stamp = G.panelT;
  const w = await readWorld(id);
  if (!w || !mayManage() || panelEl.hidden || G.panelT !== stamp) return;
  const p = openPanel('Welt verwalten');
  const name = field(p, 'Weltname', w.name, 'worldName');
  const actions = sec(p, '');
  const info = sharedInfo(id);
  opt(actions, { title: tr('Welt fortsetzen'), onClick: guard(async () => {
    if (!mayManage()) return;
    // (a shared world always goes on from the server's state, so nobody builds past the others)
    if (sharedInfo(id)) return playShared(id);
    await preserve();
    // Read again after preserving: the open world may have received a newer autosave.
    const current = await readWorld(id);
    if (await G.loadWorld(current)) closePanel();
  }) });
  opt(actions, { title: tr('Umbenennen'), short: true, onClick: guard(async () => {
    await preserve();
    await renameWorld(id, name.value);
    if (G.worldId === id) G.worldName = name.value.trim().slice(0, 48) || 'Flintworks';
    await detail(id);
  }) });
  opt(actions, { title: tr('Sicherung exportieren'), short: true, onClick: guard(async () => {
    await preserve();
    const current = await readWorld(id);
    const url = URL.createObjectURL(new Blob([exportWorld(current)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'flintworks-' + current.name.replace(/[^a-z0-9äöüß_-]/gi, '_') + '.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }) });
  // sharing: the server keeps the world, friends build on whenever they like
  if (!info && w.save.data.mode === 'settlement')
    opt(actions, { title: tr('Mit Freunden teilen'), sub: tr('Deine Freunde können jederzeit weiterbauen – auch wenn du nicht da bist'), short: true, onClick: guard(async () => {
      await preserve();
      const r = await shareWorld(id);
      if (r !== 'ok') return toast(r);
      toast('Welt geteilt – deine Freunde finden sie unter „Meine Welten“');
      await new Promise(done => setTimeout(done, 1200)); // (the list with the new world comes from the server)
      if (!panelEl.hidden) await detail(id);
    }) });
  else if (info?.mine)
    opt(actions, { title: tr('Nicht mehr teilen'), sub: tr('Die Welt bleibt auf diesem Gerät, der Server löscht seine Kopie'), short: true, onClick: guard(async () => {
      unshareWorld(id);
      toast('Die Welt wird nicht mehr geteilt');
      await detail(id);
    }) });
  else if (info) {
    const n = document.createElement('p'); n.className = 'hint';
    n.textContent = tr('Geteilt von {name}', { name: info.ownerName || '?' });
    p.appendChild(n);
  }
  if (G.worldId === id && G.inRun && !G.net && !inRoom())
    opt(actions, { title: tr('Welt schließen'), sub: tr('Sichern und zur Lobby zurückkehren'), short: true, onClick: guard(async () => {
      await preserve();
      if (G.closeWorld()) await openWorlds();
    }) });
  // Deletion deliberately needs a second distinct button; cancelling has no side effects.
  opt(actions, { title: tr('Welt löschen'), short: true, onClick: () => {
    if (G.worldId === id && G.inRun) return toast('Verlasse diese Welt, bevor du sie löschst');
    const confirm = openPanel('Welt löschen');
    const n = document.createElement('p'); n.textContent = w.name; confirm.appendChild(n);
    opt(sec(confirm, ''), { title: tr('Endgültig löschen'), onClick: guard(async () => { await deleteWorld(id); await openWorlds(); }) });
    opt(sec(confirm, ''), { title: tr('Abbrechen'), onClick: () => detail(id) });
  } });
  opt(sec(p, ''), { title: tr('Zurück'), short: true, onClick: openWorlds });
}
function newWorld() {
  const p = openPanel('Neue Siedlungswelt');
  const name = field(p, 'Weltname', tr('Unsere Siedlung'), 'worldName');
  const label = document.createElement('label');
  label.className = 'world-field'; label.textContent = tr('Welt');
  const biome = document.createElement('select'); biome.id = 'worldBiome';
  for (const [id, text] of [['meadow', 'Wiese'], ['desert', 'Wüste'], ['winter', 'Winter']]) {
    const o = document.createElement('option'); o.value = id; o.textContent = tr(text); biome.appendChild(o);
  }
  label.appendChild(biome); p.appendChild(label);
  const start = together => guard(async () => {
    if (!mayManage()) return;
    await preserve();
    if (together && !inRoom()) {
      P.playKind = 'coop'; saveProfile(); createRoom();
      const until = Date.now() + 15000;
      while (!inRoom() && Date.now() < until && NET.status !== 'error') await new Promise(r => setTimeout(r, 100));
      if (!inRoom()) throw new Error('room unavailable');
    }
    await G.createWorld({ name: name.value, biome: biome.value });
    closePanel();
  });
  if (!inRoom()) opt(sec(p, ''), { title: tr('Alleine starten'), onClick: start(false) });
  opt(sec(p, ''), { title: tr('Mit Freunden starten'), sub: tr('Freunde können während des Spiels beitreten'), onClick: start(true) });
}
