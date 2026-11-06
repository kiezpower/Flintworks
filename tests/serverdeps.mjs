// Before npm test: installs the relay's own packages (server/package.json) when they are missing,
// so the multiplayer tests (rooms, friends) can start a relay.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('server/node_modules/ws')) {
  console.log('Installing the relay packages (server/) for the multiplayer tests …');
  execSync('npm --prefix server ci --no-audit --no-fund', { stdio: 'inherit' });
}
