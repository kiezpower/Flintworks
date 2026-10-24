// WebSocket connection to the relay (server/relay.js). Reconnects by itself after a dropout
// and measures the round trip time. Messages are plain objects (JSON).
const DEFAULT_URL = 'wss://play.kiez-power.de';
// ?mp=ws://localhost:8787 in the address points the game to a test server
const URL_ = new URLSearchParams(location.search).get('mp') || DEFAULT_URL;

const T = { ws: null, status: 'off', rtt: 0, want: false }; // status: off | connecting | open
const handlers = new Map(); // message type → [fn]
let backoff = 500,
  pingT = 0,
  onOpenFn = null;

function on(type, fn) {
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type).push(fn);
}
function emit(type, m) {
  for (const fn of handlers.get(type) || []) fn(m);
}
function send(m) {
  if (T.ws && T.ws.readyState === 1) {
    T.ws.send(JSON.stringify(m));
    return true;
  }
  return false;
}
// onOpen runs after every (re)connect, e.g. to (re)join the room
function connect(onOpen) {
  onOpenFn = onOpen;
  T.want = true;
  if (T.ws && T.ws.readyState <= 1) return;
  T.status = 'connecting';
  emit('status', T);
  let ws;
  try {
    ws = new WebSocket(URL_);
  } catch {
    return retry();
  }
  T.ws = ws;
  ws.onopen = () => {
    backoff = 500;
    T.status = 'open';
    emit('status', T);
    clearInterval(pingT);
    pingT = setInterval(() => send({ t: 'ping', ts: performance.now() }), 3000);
    onOpenFn?.();
  };
  ws.onmessage = e => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    if (m.t === 'pong') T.rtt = Math.round(performance.now() - m.ts);
    emit(m.t, m);
  };
  ws.onclose = () => {
    clearInterval(pingT);
    T.ws = null;
    T.status = 'off';
    emit('status', T);
    if (T.want) retry();
  };
  ws.onerror = () => ws.close();
}
function retry() {
  setTimeout(() => T.want && connect(onOpenFn), backoff);
  backoff = Math.min(4000, backoff * 2);
}
function disconnect() {
  T.want = false;
  clearInterval(pingT);
  if (T.ws) T.ws.close();
  T.ws = null;
  T.status = 'off';
}

export { T as transport, connect, disconnect, on, send };
