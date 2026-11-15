# Flintworks multiplayer relay (see relay.js)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY relay.js ./
# shared worlds of friends are kept here (a volume, docker-compose.yml)
RUN mkdir -p /data && chown node:node /data
ENV PORT=8787
ENV SHARED_DIR=/data
EXPOSE 8787
USER node
CMD ["node", "relay.js"]
