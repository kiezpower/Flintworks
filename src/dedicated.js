// A dedicated world runs the exact shipped simulation in a local headless Chromium.
// The operator injects boot data and a checkpoint binding before loading the page.
import { G, crew } from './state.js';
import { P, saveProfile } from './profile.js';
import { NET, createRoom, inRoom, onRoomChange } from './net/room.js';
import { serialize } from './save.js';

export async function bootDedicated() {
  const boot = window.__flintWorldHost;
  if (!boot || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ||
      typeof window.__flintCheckpoint !== 'function') return;
  delete window.__flintWorldHost;
  G.dedicated = true;
  P.name = boot.name || 'Flintworks'; P.playKind = 'coop'; P.gmode = 'settlement';
  P.mode = boot.biome || 'meadow'; P.diff = boot.diff || 'adventure';
  P.sound = false; P.music = false; saveProfile();
  const updateIdle = () => {
    G.serverIdle = !inRoom() || !NET.players.some(p => p.online && !p.watch && !p.serverHost);
  };
  onRoomChange(updateIdle);
  createRoom(boot.public !== false, true);
  const deadline = Date.now() + 20000;
  while (!inRoom() && Date.now() < deadline && NET.status !== 'error') await new Promise(r => setTimeout(r, 100));
  if (!inRoom() || !NET.host || !NET.hosted) throw new Error('dedicated room unavailable');
  const loaded = boot.world
    ? await G.loadWorld(boot.world)
    : await G.createWorld({ name: boot.name || 'Flintworks', biome: boot.biome || 'meadow' });
  if (!loaded) throw new Error('dedicated world could not be loaded');
  // No operator's character takes up a player slot or works in the settlement.
  const own = crew.findIndex(c => c.pid === G.myId);
  if (own >= 0) crew.splice(own, 1);
  G.watching = true;
  updateIdle();
  let saving = Promise.resolve();
  const checkpoint = () => {
    const world = { id: G.worldId, name: G.worldName, save: {
      t: Date.now(), data: serialize(), start: G.netStart,
      players: NET.players.filter(p => !p.serverHost).map(({ pid, fid, name }) => ({ pid, fid, name })),
    } };
    saving = saving.then(() => window.__flintCheckpoint(world));
    return saving;
  };
  await checkpoint();
  window.__flintHostStatus = () => ({ room: NET.room, host: NET.host, connected: inRoom(), frame: G.frame, idle: G.serverIdle });
  window.__flintSaveWorld = checkpoint;
  // Disk failures are reported to the supervisor and terminate hosting instead of silently
  // continuing a world which cannot survive a restart.
  setInterval(() => checkpoint().catch(e => window.__flintHostError(String(e.message))), 10000);
  window.__flintHostReady = true;
}
