# Build from the repository root: docker build -f server/world-host.Dockerfile .
FROM node:24-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends util-linux && rm -rf /var/lib/apt/lists/*
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --no-audit --no-fund && npx playwright install --with-deps --only-shell chromium && npm cache clean --force && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm run build && mkdir -p /data && chown node:node /data
ENV WORLD_DATA_DIR=/data
USER node
CMD ["node", "server/world-host.mjs"]
