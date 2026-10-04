# syntax=docker/dockerfile:1

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/widget/package.json packages/widget/
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm --filter @opina/widget build \
  && pnpm --filter @opina/server build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV OPINA_DATA_DIR=/data
ENV OPINA_MIGRATIONS_DIR=/app/migrations
RUN groupadd -r opina && useradd -r -g opina opina \
  && mkdir -p /data /data/tmp \
  && chown -R opina:opina /data
COPY --from=build /app/apps/server/.output ./.output
COPY --from=build /app/apps/server/server/db/migrations ./migrations
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]

