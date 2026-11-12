# Bagheera

[![CI](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml/badge.svg)](https://github.com/krevindiou/bagheera/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/krevindiou/bagheera/graph/badge.svg?token=V05Z98I3T9)](https://codecov.io/github/krevindiou/bagheera)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/krevindiou/bagheera/badge)](https://scorecard.dev/viewer/?uri=github.com/krevindiou/bagheera)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/16610/badge)](https://www.bestpractices.dev/projects/16610)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Bagheera is a manual-entry personal finance manager. Users track banks, accounts, and operations (transactions), import operations from their bank's OFX files, move money between accounts via transfers, automate regular income or expenses with recurring schedulers, and review balances and spending through reports.

## Stack

| Layer | Choice                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------- |
| API   | NestJS (TypeScript) · PostgreSQL via Drizzle · Valkey (sessions, rate limiting, BullMQ queue) · BullMQ (email jobs) |
| Web   | Vue 3 + Pinia · TanStack Query · VeeValidate + Zod · Bootstrap · Chart.js                                           |
| Auth  | Passkeys (WebAuthn), cookie-based server-side revocable sessions                                                    |
| Infra | Docker Compose · Caddy (static SPA) · GitHub Container Registry (images) · Uncloud (deploy, TLS, routing)           |

## Run it locally

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

## Developing

```bash
make help      # list all targets
make ps        # container status
make build     # build api + web and their packages/* deps
make migrate   # run db migrations
make test      # unit + integration + e2e (or test-unit/test-integration/test-e2e individually)
make lint      # lint api + web + packages/*
make format    # format api + web + packages/*
make check     # every workspace-wide check CI runs (lint, format, types, audit, knip, ...)
make precommit # format + lint + check + build + test-unit: run before committing
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
  reference-data/  reference data, enums, limits and constants shared by api and web
docker/      Dockerfiles, Compose files (compose.yml for dev, compose.prod.yml for production), Caddyfile
docs/        deploying.md, backup-restore.md
scripts/     backup.sh, deploy.sh
```

## Deploy it on your own server

Production runs on [Uncloud](https://uncloud.run), on one Linux host. The images are pre-built and public on GitHub Container Registry (`ghcr.io/krevindiou/bagheera-api` and `ghcr.io/krevindiou/bagheera-web`), so you only deploy them: nothing to build or publish.

1. **Host.** A Linux server reachable over SSH, with a DNS A record for `<your-domain>` pointing at it. Open ports 80 and 443 for Uncloud's Caddy; 51820/udp only matters once there are several machines (it carries the WireGuard mesh between them).
2. **`uc`.** Install the CLI on your machine ([install guide](https://uncloud.run/docs/getting-started/install-cli)), then run `uc machine init <user>@<host>`. It installs Docker and the Uncloud daemon on the host and starts Caddy.
3. **Settings.** `cp docker/prod.env.example docker/prod.env` and fill it in, with `APP_DOMAIN=<your-domain>`. The file is git-ignored.
4. **Deploy.** Run `make deploy` to deploy the latest release, or `make deploy TAG=<version>` for another one from the [releases page](https://github.com/krevindiou/bagheera/releases). If the migration step fails on an empty host because Postgres isn't up yet, deploy the stores first with `scripts/deploy.sh postgres valkey`, then deploy again.

Then check that the pages, `/api/…` and `/health` all resolve over HTTPS on `<your-domain>`, and that passkey sign-up works (a passkey is bound to the domain).

Rolling back, schema changes, Valkey persistence and backups are in [`docs/deploying.md`](docs/deploying.md) and [`docs/backup-restore.md`](docs/backup-restore.md).

## Contributing

Bug reports, feature requests and pull requests are welcome: see [`CONTRIBUTING.md`](CONTRIBUTING.md). Report security vulnerabilities privately, as [`SECURITY.md`](SECURITY.md) explains.

## License

MIT — see [`LICENSE`](LICENSE).
