# syntax=docker/dockerfile:1

# ---------- 1. Build the Vue client ----------
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- 2. Build the Express server ----------
FROM node:22-alpine AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ---------- 3. Runtime ----------
FROM node:22-alpine
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    PORT=3001 \
    STATIC_DIR=/app/public \
    APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.title="stock-app" \
      org.opencontainers.image.version="${APP_VERSION}"
WORKDIR /app
COPY --from=server /app/server/node_modules ./node_modules
COPY --from=server /app/server/dist ./dist
COPY --from=server /app/server/package.json ./
COPY --from=client /app/client/dist ./public
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "dist/index.js"]
