# Filomina – production image for any Docker host (VM, Cloud Run, Fly, …)
# Build:  docker build -t filomina .
# Models: downloaded at build time (ARG MODEL_PACK=l|sc). Pass --build-arg MODEL_PACK=sc for the light pack.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG MODEL_PACK=l
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# models/ from the build context are reused when present; otherwise they are downloaded here
RUN node scripts/fetch-models.mjs --pack ${MODEL_PACK} && npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 DATA_DIR=/data FACE_MODELS_DIR=/app/models
RUN mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/models ./models
COPY --from=build --chown=node:node /app/next.config.ts ./
USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
