# Bagheera

[![CI](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml/badge.svg)](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](package.json)

Bagheera is a manual-entry personal finance manager. Users track banks, accounts, and operations (transactions), move money between accounts via transfers, automate regular income or expenses with recurring schedulers, and review balances and spending through reports.

## Stack

| Layer | Choice |
|---|---|
| API | NestJS (TypeScript) · PostgreSQL via Drizzle · Valkey (sessions, rate limiting, BullMQ queue) · BullMQ (email jobs) |
| Web | Vue 3 + Pinia · TanStack Query · VeeValidate + Zod · Bootstrap · Chart.js |
| Auth | Passkeys (WebAuthn), cookie-based server-side revocable sessions |
| Infra | Docker Compose · Caddy (static SPA) · Kamal + kamal-proxy (deploy, TLS, routing) |

## Getting started

Requires Docker and Docker Compose — nothing else. Every service runs in containers with hot reload.

```bash
cp apps/api/.env.example apps/api/.env

make up
```

That's it — migrations run automatically on API startup. To override the default ports or dev credentials, copy `docker/.env.example` to `docker/.env`; every var it sets already has a default in `docker/compose.yml`.

| Service | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3000 |
| API docs (Swagger) | http://localhost:3000/api/docs |
| Mailpit (SMTP catcher) | http://localhost:8025 |

## Common tasks

```bash
make help      # list all targets
make ps        # container status
make build     # build api + web and their packages/* deps, as CI does
make migrate   # run db migrations
make test      # unit + integration + e2e (or test-unit/test-integration/test-e2e individually)
make lint      # lint api + web + packages/*
make format    # format api + web + packages/*
make shell-api # shell into the api container
make shell-web # shell into the web container
```

Any other command runs inside a container through `make exec-api` / `make exec-web`, e.g.:

```bash
make exec-api CMD="pnpm test:cov"
make exec-api CMD="pnpm db:generate --name <snake_case_description>"
make exec-web CMD="pnpm generate:api-client"
make test-e2e E2E_ARGS="auth.spec.ts"   # one e2e spec, on the separate e2e stack
```

## Project layout

```
apps/
  api/       NestJS backend
  web/       Vue frontend
packages/
  money/           cross-stack code shared by api and web (minor-units money math)
  reference-data/  shared reference data (payment-method ids, locales, entry types, report and scheduler enum values, country and currency codes, report result cap, value-date bounds)
docker/      Dockerfiles, Compose files, Caddyfile
config/      Kamal deploy configs (deploy.yml: web, deploy.api.yml: api)
docs/        backup-restore.md
scripts/     backup.sh
.kamal/      Kamal secrets (env references only)
```

## Production

Deploys go through [Kamal](https://kamal-deploy.org) as two apps on one host, rolled out over SSH by CI on pushes to `main`:

- `config/deploy.yml` builds `docker/Dockerfile.caddy` (Caddy serving the built SPA, see `docker/Caddyfile` for its security headers) and runs the Postgres and Valkey accessories.
- `config/deploy.api.yml` builds `docker/Dockerfile.api`; migrations run from the new image before it goes live.

kamal-proxy terminates TLS and routes `/api` and `/health` to the API, everything else to Caddy. Secrets come from the deploying environment via `.kamal/secrets`. See `scripts/backup.sh` and `docs/backup-restore.md` for backups and restores.

### Deploying schema changes

Migrations run from the new API image while the previous release is still serving traffic, so every migration must work against the API version currently running: expand first (add columns/tables, backfill, widen types), and only drop, rename, or tighten a shape in a later release once no running code depends on the old one. Drizzle migrations here are forward-only — there's no down migration to undo one.

Rolling back the API (`kamal rollback <version> -c config/deploy.api.yml`, e.g. after a failed health check) leaves the schema exactly as the last migration left it; it does not undo anything. Undoing a migration means a restore per `docs/backup-restore.md`.

### Valkey persistence

The Valkey accessory runs with the append-only file (`--appendonly yes --appendfsync everysec`), so sessions, revocations and queued jobs survive an unclean stop (SIGKILL, OOM, host crash). Without it, Valkey reloads its last RDB snapshot, which can be around 30 minutes old and would bring revoked or signed-out cookies back to life. `everysec` can still lose about a second of writes on a host crash; `--appendfsync always` narrows that further at a write-latency cost.

Do not roll this out with `kamal accessory reboot valkey` alone: restarting straight into `appendonly yes` over an existing `dump.rdb` was observed to start with an empty dataset, discarding every session and queued job. Switch the live instance over first:

```bash
# on the deploy host
docker exec bagheera-web-valkey sh -c 'valkey-cli --no-auth-warning -a "$VALKEY_PASSWORD" config set appendonly yes'
docker exec bagheera-web-valkey sh -c 'valkey-cli --no-auth-warning -a "$VALKEY_PASSWORD" info persistence' | grep -E 'aof_rewrite_in_progress|aof_last_bgrewrite_status'
```

Repeat the second command until it shows `aof_rewrite_in_progress:0` and `aof_last_bgrewrite_status:ok`. Only then ship the `config/deploy.yml` change and run `kamal accessory reboot valkey`, and check `dbsize` afterwards.

## License

MIT — see [`package.json`](package.json).
