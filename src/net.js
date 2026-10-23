// Multiplayer groundwork: room codes and invite links. The actual connection (WebRTC or a
// WebSocket relay) plugs in later behind connect(); the lobby already uses this interface.
const NET = {
  room: null, // own or joined room code
  host: false,
  players: [], // future: [{ name, cap, hat }]
  status: 'offline', // 'offline' | 'waiting' | 'connected'
  maxPlayers: 3,
};
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

// ?room=CODE in the address means someone invited us
const fromUrl = new URLSearchParams(location.search).get('room');
if (fromUrl && /^[A-Z0-9]{6}$/i.test(fromUrl)) {
  NET.room = fromUrl.toUpperCase();
  NET.status = 'waiting';
}

function ensureRoom() {
  if (!NET.room) {
    NET.room = newCode();
    NET.host = true;
    NET.status = 'waiting';
  }
  return NET.room;
}
function inviteLink() {
  return `${location.origin}${location.pathname}?room=${ensureRoom()}`;
}
// share sheet on phones, clipboard elsewhere; resolves to 'shared' | 'copied' | 'failed'
async function shareInvite(text) {
  const url = inviteLink();
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Flintworks', text, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
// placeholder until a multiplayer server exists
async function connect() {
  return false;
}

export { NET, connect, ensureRoom, inviteLink, shareInvite };
