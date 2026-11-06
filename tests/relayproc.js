// Starts a relay of its own (server/relay.js) for a test file. Resolves once it listens; if it
// exits first (e.g. its packages are missing), fails right away with what it printed.
import { spawn } from 'node:child_process';

export function startRelay(port) {
  const relay = spawn(process.execPath, ['server/relay.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'pipe' });
  let err = '';
  relay.stderr.on('data', d => (err += d));
  const ready = new Promise((ok, fail) => {
    relay.stdout.once('data', ok);
    relay.once('exit', code => {
      const missing = /Cannot find package '([^']+)'/.exec(err);
      fail(
        new Error(
          missing
            ? `relay: package "${missing[1]}" missing – run: npm --prefix server ci`
            : `relay exited (${code}): ${err.trim().split('\n').slice(0, 5).join('\n')}`,
        ),
      );
    });
  });
  return { relay, ready };
}
