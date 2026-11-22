# Build from the repository root: docker build -f server/world-host.Dockerfile .
# Two stages: the game is built with all development packages, the image that runs on the server
# only holds what the world host needs (Node, Playwright with Chromium, the built game and
# world-host.mjs). Keeps the image small: the vServer's disk is shared with other apps.

# ---- build: the production game bundle (dist/) ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --no-audit --no-fund
COPY . .
RUN npm run build \
  # only Playwright (the version the game is tested with) goes on to the server
  && mkdir /runtime && cd /runtime \
  && echo '{"private":true,"type":"module"}' > package.json \
  && npm install --no-audit --no-fund --omit=dev "playwright@$(node -p "require('/app/node_modules/playwright/package.json').version")" \
  && npm cache clean --force

# ---- run: the world host ----
FROM node:24-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
COPY --from=build /runtime/package.json ./package.json
COPY --from=build /runtime/node_modules ./node_modules
# flock (util-linux) for the world lock, Chromium's headless shell and the libraries it needs
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    apt-get update && apt-get install -y --no-install-recommends util-linux \
    && npx playwright install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/*
COPY --from=build /app/dist ./dist
COPY server/world-host.mjs ./server/world-host.mjs
RUN mkdir -p /data && chown node:node /data
ENV WORLD_DATA_DIR=/data
USER node
CMD ["node", "server/world-host.mjs"]
