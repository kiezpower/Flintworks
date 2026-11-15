// World management in the lobby and in the running game's menu.
import { G, esc } from './state.js';
import { P, saveProfile } from './profile.js';
import { GAME_MODES } from './modes.js';
import { NET, createRoom, inRoom } from './net/room.js';
import { saveGame, serialize } from './save.js';
import { saveNet } from './net/netsave.js';
import { archiveWorld } from './worldarchive.js';
import { MAX_IMPORT, readWorld, listWorlds, renameWorld, deleteWorld, exportWorld, importWorld } from './worldstore.js';
import { closePanel, openPanel, opt, sec, toast } from './ui.js';
import { tr } from './i18n.js';
import './worldui.css';

const mayManage = () => !inRoom() || (NET.host && !NET.auto);
async function preserve() {
  if (G.inRun && (!G.net || G.netHost)) {
    await archiveWorld({ data: serialize(), start: G.net ? G.netStart : null, players: NET.players.map(({ pid, fid, name }) => ({ pid, fid, name })) });
    saveGame(); saveNet();
  }
  await G.worldSavePending;
}
const guard = fn => async () => {
  try { await fn(); } catch { toast('Welt konnte nicht geöffnet werden – die bisherige Welt bleibt gespeichert'); }
};
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
  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = tr('Welten bleiben auf diesem Gerät. Exportiere eine Sicherung für andere Geräte.');
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
  if (!p.isConnected) return;
  const list = sec(p, 'Gespeicherte Welten');
  if (!worlds.length) {
    const empty = document.createElement('p'); empty.textContent = tr('Noch keine Welt gespeichert'); list.appendChild(empty);
  }
  for (const w of worlds) {
    opt(list, {
      title: esc(w.name), sub: `${esc(tr(GAME_MODES[w.save.data.mode]?.name || 'Siedlungswelt'))} · ${new Date(w.updated).toLocaleString()}`,
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
    await openWorlds();
  });
  imp.appendChild(file);
}
async function detail(id) {
  const w = await readWorld(id);
  if (!w || !mayManage()) return;
  const p = openPanel('Welt verwalten');
  const name = field(p, 'Weltname', w.name, 'worldName');
  const actions = sec(p, '');
  opt(actions, { title: tr('Welt fortsetzen'), onClick: guard(async () => {
    if (!mayManage()) return;
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
