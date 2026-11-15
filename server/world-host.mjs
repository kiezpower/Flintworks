// One persistent world per process. Uses the production game bundle, never the development
// debug API. All disk paths and network destinations come from the local operator's environment.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, open, readFile, rename, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(process.env.WORLD_DATA_DIR || resolve(root, 'server/world-data'));
const dist = resolve(process.env.WORLD_DIST_DIR || resolve(root, 'dist'));
const relay = process.env.WORLD_RELAY_URL || 'wss://play.kiez-power.de';
if (!/^wss?:\/\//.test(relay)) throw new Error('WORLD_RELAY_URL must be a WebSocket URL');
await mkdir(dataDir, { recursive: true, mode: 0o700 });
// An OS advisory lock survives process crashes safely: the kernel releases it when the host
// exits. No stale PID files or manual lock deletion after a machine/container restart.
if (process.env.FLINT_WORLD_LOCKED !== '1') {
  const child = spawn('flock', ['-n', '-E', '73', '-F', resolve(dataDir, 'host.lock'), process.execPath, fileURLToPath(import.meta.url)], {
    env: { ...process.env, FLINT_WORLD_LOCKED: '1' }, stdio: 'inherit',
  });
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('SIGINT', () => child.kill('SIGINT'));
  child.on('error', e => { console.error('Cannot acquire world lock:', e.message); process.exit(1); });
  child.on('exit', (code, signal) => {
    if (code === 73) console.error('World data is already in use by another host');
    process.exit(code ?? (signal ? 1 : 0));
  });
  await new Promise(() => {});
}
let browser, server, monitor, stopping = false, healthy = false;
const worldPath = resolve(dataDir, 'world.json');
const identityPath = resolve(dataDir, 'identity');
async function atomic(path, body) {
  const tmp = path + '.tmp';
  const f = await open(tmp, 'w', 0o600);
  try { await f.writeFile(body); await f.sync(); } finally { await f.close(); }
  await rename(tmp, path);
}
async function optional(path) {
  try { return await readFile(path, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
let page, writing = Promise.resolve();
async function shutdown(code = 0, checkpoint = true) {
  if (stopping) return;
  stopping = true; healthy = false; clearInterval(monitor);
  try { if (checkpoint && page && !page.isClosed()) await page.evaluate(() => window.__flintSaveWorld?.()); }
  catch (e) { console.error('Final checkpoint failed:', e.message); code = 1; }
  try { await writing; } catch { code = 1; }
  await browser?.close().catch(() => {});
  await new Promise(r => server ? server.close(r) : r());
  process.exitCode = code;
}
process.on('SIGTERM', () => shutdown());
process.on('SIGINT', () => shutdown());
try {
  let token = await optional(identityPath);
  if (!token) { token = randomBytes(16).toString('hex'); await atomic(identityPath, token); }
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error('Invalid world identity file');
  const saved = await optional(worldPath);
  const imported = !saved && process.env.WORLD_IMPORT_FILE ? await readFile(process.env.WORLD_IMPORT_FILE, 'utf8') : null;
  const raw = saved || imported;
  const world = raw ? JSON.parse(raw) : null;
  if (world && (!world.save || !world.name)) throw new Error('Invalid world backup; original file was not changed');
  if (world && !world.id) world.id = world.save.data?.worldId || randomBytes(16).toString('hex');
  const name = world?.name || process.env.WORLD_NAME || 'Flintworks';
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') {
        res.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ready: healthy }));
      }
      const path = resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!path.startsWith(dist + sep) || !(await stat(path)).isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(await readFile(path));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(Number(process.env.WORLD_HTTP_PORT || 0), '127.0.0.1', r));
  const port = server.address().port;
  browser = await chromium.launch({ handleSIGTERM: false, handleSIGINT: false, handleSIGHUP: false, executablePath: process.env.PW_CHROMIUM || undefined, args: [
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ] });
  // The local operator explicitly chooses the relay; the public game's CSP remains unchanged.
  const context = await browser.newContext({ bypassCSP: true, viewport: { width: 640, height: 360 } });
  page = await context.newPage();
  await page.exposeFunction('__flintCheckpoint', world => {
    const body = JSON.stringify(world);
    if (body.length > 24 * 1024 * 1024) throw new Error('World checkpoint exceeds 24 MiB');
    writing = writing.then(async () => {
      const previous = await optional(worldPath);
      if (previous) await atomic(worldPath + '.bak', previous);
      await atomic(worldPath, body);
    });
    return writing;
  });
  await page.exposeFunction('__flintHostError', message => {
    console.error('World host failed:', message);
    void shutdown(1, false);
  });
  await page.addInitScript(({ token, name, world, biome, diff, pub }) => {
    localStorage.setItem('flintworks-token', token);
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name,
      gmode: 'settlement', playKind: 'coop', gfx: 'low', sound: false, music: false }));
    window.__flintWorldHost = { name, world, biome, diff, public: pub };
  }, { token, name, world, biome: process.env.WORLD_BIOME || 'meadow', diff: process.env.WORLD_DIFFICULTY || 'adventure', pub: process.env.WORLD_PUBLIC !== 'false' });
  page.on('pageerror', e => { console.error('Simulation error:', e.message); void shutdown(1, false); });
  page.on('crash', () => { console.error('World browser crashed'); void shutdown(1, false); });
  await page.goto(`http://127.0.0.1:${port}/?mp=${encodeURIComponent(relay)}`);
  await page.waitForFunction(() => window.__flintHostReady, null, { timeout: 45000 });
  healthy = true;
  const status = await page.evaluate(() => window.__flintHostStatus());
  // Contains no secret: this is the same invitation code shown in the ordinary lobby.
  console.log(JSON.stringify({ ready: true, name, room: status.room, healthPort: port }));
  monitor = setInterval(async () => {
    try {
      const s = await page.evaluate(() => window.__flintHostStatus());
      if (!s.connected || !s.host) throw new Error('Relay connection lost; restart from the last checkpoint');
    } catch (e) { console.error(e.message); void shutdown(1); }
  }, 15000);
} catch (e) {
  console.error('Cannot start world host:', e.message);
  await shutdown(1, false);
}
