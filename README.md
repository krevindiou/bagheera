# Bagheera

[![CI](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml/badge.svg)](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](package.json)

Bagheera is a manual-entry personal finance manager. Users track banks, accounts, and operations (transactions), move money between accounts via transfers, automate regular income or expenses with recurring schedulers, and review balances and spending through reports.

## Stack

| Layer | Choice |
|---|---|
| API | NestJS (TypeScript) · PostgreSQL via Drizzle · Valkey (sessions, cache, rate limiting) · BullMQ (email jobs) |
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
make migrate   # run db migrations
make test      # unit + integration + e2e (or test-unit/test-integration/test-e2e individually)
make lint      # lint api + web + packages/*
make format    # format api + web + packages/*
make shell-api # shell into the api container
make shell-web # shell into the web container
```

Anything not covered by `make` can be run directly, e.g.:

```bash
docker compose -f docker/compose.yml exec --workdir /app/apps/api api pnpm test:cov
docker compose -f docker/compose.yml exec --workdir /app/apps/api api pnpm db:generate --name <snake_case_description>
make test-e2e   # Playwright needs the separate e2e stack
```

## Project layout

```
apps/
  api/       NestJS backend
  web/       Vue frontend
packages/
  money/           cross-stack code shared by api and web (minor-units money math)
  reference-data/  shared fixed payment-method ids
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

## License

MIT — see [`package.json`](package.json).
