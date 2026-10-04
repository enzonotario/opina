# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock pnpm-workspace.yaml ./
COPY apps/demo/package.json apps/demo/
COPY apps/server/package.json apps/server/
COPY packages/widget/package.json packages/widget/
RUN bun install --frozen-lockfile \
  --filter './apps/server' \
  --filter './packages/widget' \
  --filter './'

FROM deps AS build
COPY . .
RUN bun run --filter @opina/widget build \
  && bun run --filter @opina/server build

FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV OPINA_DATA_DIR=/data
ENV OPINA_MIGRATIONS_DIR=/app/migrations
RUN apt-get update \
  && apt-get install -y --no-install-recommends tar \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r opina && useradd -r -g opina opina \
  && mkdir -p /data /data/tmp \
  && chown -R opina:opina /data
COPY --from=build /app/apps/server/.output ./.output
COPY --from=build /app/apps/server/server/db/migrations ./migrations
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]
