# Bagheera

[![CI](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml/badge.svg)](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/krevindiou/bagheera/graph/badge.svg?token=V05Z98I3T9)](https://codecov.io/github/krevindiou/bagheera)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](package.json)

Bagheera is a manual-entry personal finance manager. Users track banks, accounts, and operations (transactions), move money between accounts via transfers, automate regular income or expenses with recurring schedulers, and review balances and spending through reports.

## Stack

| Layer | Choice                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------- |
| API   | NestJS (TypeScript) · PostgreSQL via Drizzle · Valkey (sessions, rate limiting, BullMQ queue) · BullMQ (email jobs) |
| Web   | Vue 3 + Pinia · TanStack Query · VeeValidate + Zod · Bootstrap · Chart.js                                           |
| Auth  | Passkeys (WebAuthn), cookie-based server-side revocable sessions                                                    |
| Infra | Docker Compose · Caddy (static SPA) · Docker Hub (images) · Uncloud (deploy, TLS, routing)                          |

## Getting started

Requires Docker and Docker Compose — nothing else. Every service runs in containers with hot reload.

```bash
cp apps/api/.env.example apps/api/.env

make up
```

That's it — migrations run automatically on API startup. To override the default ports or dev credentials, copy `docker/.env.example` to `docker/.env`; every var it sets already has a default in `docker/compose.yml`.

| Service                | URL                            |
| ---------------------- | ------------------------------ |
| Web                    | http://localhost:5173          |
| API                    | http://localhost:3000          |
| API docs (Swagger)     | http://localhost:3000/api/docs |
| Mailpit (SMTP catcher) | http://localhost:8025          |

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
docker/      Dockerfiles, Compose files (compose.yml for dev, compose.prod.yml for production), Caddyfile
docs/        backup-restore.md
scripts/     backup.sh, deploy.sh
```

## Production

Production runs on [Uncloud](https://uncloud.run), on one host. CI builds the images; you deploy them by hand.

- On every push to `main` that passes the tests, CI's `publish` job builds `bagheera-api` (`docker/Dockerfile.api`) and `bagheera-web` (`docker/Dockerfile.caddy`: Caddy serving the built SPA, see `docker/Caddyfile` for its security headers) for amd64 and arm64, and pushes them to Docker Hub tagged with the git SHA and `latest`. The images are public and hold no secrets or deployment settings.
- `make deploy TAG=<git sha>` (`scripts/deploy.sh`, which needs `uc` and Docker on your machine) rolls those images out with `uc deploy -f docker/compose.prod.yml`, which also runs Postgres and Valkey. Migrations run from the new API image before it replaces the old one.

Uncloud's Caddy terminates TLS and routes `/api` and `/health` to the API, everything else to the web container. Settings and secrets come from `docker/prod.env` (copy `docker/prod.env.example`; it is git-ignored). See `scripts/backup.sh` and `docs/backup-restore.md` for backups and restores.

### Setting up (once)

1. **Docker Hub.** Create two public repositories, `bagheera-api` and `bagheera-web`, and an access token with Read & Write scope. In the GitHub repository's Actions settings, add the variable `DOCKERHUB_USERNAME` and the secret `DOCKERHUB_TOKEN`.
2. **Host.** A Linux server reachable over SSH, with a DNS A record for `<your-domain>` pointing at it. Open ports 80 and 443 for Uncloud's Caddy; 51820/udp only matters once there are several machines (it carries the WireGuard mesh between them).
3. **`uc`.** Install the CLI on your machine ([install guide](https://uncloud.run/docs/getting-started/install-cli)), then run `uc machine init <user>@<host>`. It installs Docker and the Uncloud daemon on the host and starts Caddy.
4. **Settings.** `cp docker/prod.env.example docker/prod.env` and fill it in, with `APP_DOMAIN=<your-domain>`.
5. **First deploy.** Once CI has published a commit, run `make deploy TAG=<its git sha>`. If the migration step fails on an empty host because Postgres isn't up yet, deploy the stores first with `scripts/deploy.sh <sha> postgres valkey`, then deploy again.

Then check that the pages, `/api/…` and `/health` all resolve over HTTPS on `<your-domain>`, and that passkey sign-up works (a passkey is bound to the domain).

### Deploying and rolling back

`make deploy TAG=<git sha>` takes a SHA CI has published (the script refuses one whose images are missing). Uncloud replaces containers one at a time: it starts the new one, waits for its health check, then removes the old one, so a release that never turns healthy leaves the previous one serving. Extra arguments go to `uc deploy`, e.g. `scripts/deploy.sh <sha> -y` to skip the confirmation.

To roll back, deploy an older SHA.

### Deploying schema changes

Migrations run from the new API image while the previous release is still serving traffic, so every migration must work against the API version currently running: expand first (add columns/tables, backfill, widen types), and only drop, rename, or tighten a shape in a later release once no running code depends on the old one. Drizzle migrations here are forward-only — there's no down migration to undo one. A failing migration aborts the deploy before any API container is replaced.

Rolling back the API (`make deploy TAG=<previous git sha>`, e.g. after a failed health check) leaves the schema exactly as the last migration left it; it does not undo anything. Undoing a migration means a restore per `docs/backup-restore.md`.

### Valkey persistence

Valkey runs with the append-only file (`--appendonly yes --appendfsync everysec`), so sessions, revocations and queued jobs survive an unclean stop (SIGKILL, OOM, host crash). Without it, Valkey reloads its last RDB snapshot, which can be around 30 minutes old and would bring revoked or signed-out cookies back to life. `everysec` can still lose about a second of writes on a host crash; `--appendfsync always` narrows that further at a write-latency cost.

## License

MIT — see [`package.json`](package.json).
