#!/usr/bin/env bash
# One-time setup on the vServer (Debian/Ubuntu, as root):
#   bash setup.sh
# Installs Node.js 20 and Caddy, copies the relay to /opt/flintworks-relay and starts both.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi

mkdir -p /opt/flintworks-relay
cp relay.js package.json /opt/flintworks-relay/
(cd /opt/flintworks-relay && npm install --omit=dev)
chown -R www-data:www-data /opt/flintworks-relay

cp flintworks-relay.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now flintworks-relay
systemctl restart flintworks-relay

# add the site to Caddy (keeps other sites in /etc/caddy/Caddyfile)
grep -q "play.kiez-power.de" /etc/caddy/Caddyfile 2>/dev/null || cat Caddyfile >> /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "Fertig. Test: https://play.kiez-power.de sollte 'Upgrade Required' o. ä. zeigen; Logs: journalctl -u flintworks-relay -f"
