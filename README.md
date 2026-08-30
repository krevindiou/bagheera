# Bagheera

[![CI](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml/badge.svg)](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](package.json)

Bagheera is a manual-entry personal finance manager. Users track banks, accounts, and operations (transactions), move money between accounts via transfers, automate regular income or expenses with recurring schedulers, and review balances and spending through reports.

## Stack

| Layer | Choice |
|---|---|
| API | NestJS (TypeScript) · PostgreSQL via Drizzle · Valkey (sessions, cache, rate limiting) · BullMQ (email jobs) |
| Web | Vue 3 + Pinia · TanStack Query · VeeValidate + Zod · Bootstrap · Chart.js |
| Auth | Cookie-based, server-side revocable sessions |
| Infra | Docker Compose · Caddy (reverse proxy + static SPA) · Kamal (deploy) |

## Getting started

Requires Docker and Docker Compose — nothing else. Every service runs in containers with hot reload.

```bash
cp apps/api/.env.example apps/api/.env

make up
```

That's it — migrations run automatically on API startup. The root `.env.example` is only needed to override default ports/credentials; every var it sets already has a default in `docker/compose.yml`.

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
make lint      # lint api + web
make format    # format api + web
make shell-api # shell into the api container
make shell-web # shell into the web container
```

Anything not covered by `make` can be run directly, e.g.:

```bash
docker compose -f docker/compose.yml exec api pnpm test:cov
docker compose -f docker/compose.yml exec api pnpm db:generate
docker compose -f docker/compose.yml exec web pnpm e2e
```

## Project layout

```
apps/
  api/     NestJS backend
  web/     Vue frontend
docker/    Dockerfiles, Compose files, Caddyfile
scripts/   backup.sh
.kamal/    deploy config/secrets
```

## Production

```bash
make ENV=prod build
make ENV=prod up
```

Runs `docker/compose.prod.yml`, with Caddy serving the built SPA and reverse-proxying API routes. Deploys go through [Kamal](https://kamal-deploy.org) (`.kamal/`); see `docker/Caddyfile` for the edge/TLS setup and `scripts/backup.sh` for the Postgres backup routine.

## License

MIT — see [`package.json`](package.json).
