# Opina

Self-hosted CSAT and feedback surveys. One container, SQLite, multi-project admin panel, and a lightweight embeddable widget.

## Stack

- Nuxt 4 + Nuxt UI + nuxt-auth-utils
- SQLite (better-sqlite3) + Drizzle ORM
- Vanilla TypeScript widget (Vite IIFE)
- pnpm workspaces (local) / Bun (production Docker image)

## Requirements

- Node.js **22.x** (Volta pin included; required for `better-sqlite3`)
- pnpm 10+

## Quick start

```bash
pnpm install
make env
make dev          # Nuxt with hot reload on :3000
```

`make up` runs the **production** Docker image (no HMR). Use `make dev` while working on the UI.

### First-time setup

There is **no default user**. On first boot the server prints a one-time setup URL:

```bash
make up
make install-url   # or: cat data/setup-url.txt
```

Open `/setup/<token>`, create the owner account. The token expires in 30 minutes; restart to mint a new one. To wipe data and start over: `make reset-data && make up`.

## Docker / Make

```bash
make dev       # Nuxt HMR on the host
make up        # production Docker image
make logs      # follow Docker logs
make health    # GET /api/health
make restart   # restart Docker container
make down      # stop Docker (keeps ./data)
make help      # all commands
```

Data lives in `./data` (`opina.db`). `make env` creates `.env` from `.env.example` if missing.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `make dev` | Nuxt admin + API (HMR) |
| `make demo` | Vue demo site on `:3001` |
| `make widget` | Build widget into `packages/widget/dist/` (+ sync to `apps/server/public/`) |
| `pnpm build` | Build widget, then server |
| `pnpm test` | Run tests |
| `pnpm db:generate` | Generate Drizzle migrations from schema |

## Widget demo

With `make dev` running on `:3000`:

```bash
make demo   # http://localhost:3001
```

Allow `http://localhost:3001` (and optionally `http://127.0.0.1:3001`) on the project origins.

## Production deploy

1. Set a strong `NUXT_SESSION_PASSWORD` (32+ random chars) and HTTPS `NUXT_PUBLIC_URL`.
2. Persist a volume on `/data`.
3. Prefer `docker-compose.prod.yml` (or any Docker host / Coolify with the same env).
4. Open the setup URL from the logs, create the owner, add your site origins, paste the install snippet.
5. Optionally enable `OPINA_BACKUP_S3_*` and run a backup + restore once.

Local Docker compose allows the example password via `OPINA_ALLOW_INSECURE=1`. Production compose does not.

## Backups (optional)

Set `OPINA_BACKUP_S3_*` in `.env` (see `.env.example`). The Nitro task `backup:r2` runs on the configured cron. From the panel: **Instance → Run backup now**.

### Restore

```bash
gunzip opina-….db.gz
# If screenshots were backed up:
# tar -xzf opina-….screenshots.tar.gz -C ./data
docker compose -f docker-compose.prod.yml -p opina stop opina
cp opina-….db ./data/opina.db
docker compose -f docker-compose.prod.yml -p opina start opina
```
