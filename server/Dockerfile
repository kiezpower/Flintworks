# Flintworks multiplayer relay (see relay.js)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY relay.js ./
ENV PORT=8787
EXPOSE 8787
USER node
CMD ["node", "relay.js"]
