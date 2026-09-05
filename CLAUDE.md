# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Docker only — no local runtime

**Everything runs in Docker containers. Never run the app, its tests, or its tooling with a local Node/pnpm/Postgres install.** `node_modules` lives only in named Docker volumes (see `docker/compose.yml`) — any `node_modules` visible on the host is a stray empty mountpoint, not real deps; ignore it, don't `pnpm install` there. Every `pnpm`/`drizzle-kit`/etc. command must run **inside** the `api`/`web` container (`make shell-api`, `make shell-web`, or `docker compose -f docker/compose.yml exec ...`), or you'll hit permission errors and/or touch the wrong DB.

The only host-level requirement is Docker + Docker Compose.

## Commands

```bash
cp apps/api/.env.example apps/api/.env
make up                          # start full stack (hot reload); migrations run automatically on api startup
```

| Service | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3000 |
| API docs (Swagger) | http://localhost:3000/api/docs |
| Mailpit (SMTP catcher) | http://localhost:8025 |

```bash
make help              # list all targets
make ps                # container status
make down               # stop stack
make migrate            # run db migrations
make lint                # lint api + web
make format              # format api + web
make shell-api           # shell into the api container
make shell-web           # shell into the web container

make test                # unit + integration + e2e
make test-unit           # api (jest) + web (vitest) unit tests
make test-integration    # api integration tests (jest-integration.json, uses Testcontainers)
make test-e2e            # boots a separate `bagheera-e2e` compose stack, seeds it, runs Playwright
```

Anything not covered by `make`, run the same way `docker compose exec` — e.g.:

```bash
docker compose -f docker/compose.yml exec --workdir /app/apps/api api pnpm test:cov
docker compose -f docker/compose.yml exec --workdir /app/apps/api api pnpm test -- path/to/file.spec.ts   # single api test
docker compose -f docker/compose.yml exec --workdir /app/apps/api api pnpm db:generate                     # new drizzle migration after schema changes
docker compose -f docker/compose.yml exec --workdir /app/apps/api api pnpm db:seed                         # seed payment_method/category reference data
docker compose -f docker/compose.yml exec --workdir /app/apps/web web pnpm test -- path/to/file.spec.ts    # single web test
docker compose -f docker/compose.yml exec --workdir /app/apps/web web pnpm e2e -- e2e/some.spec.ts         # single e2e test (needs the e2e stack, see make test-e2e)
```

Every `make`/`docker compose` target above is dev-only; deploys go through Kamal (`config/deploy.yml`, `.kamal/`), which builds `docker/Dockerfile.caddy` (Caddy + built SPA). See `scripts/backup.sh` for the Postgres backup routine that runs on the deploy host.

## Before committing

Never commit or push unless the user explicitly asks.

Run `make format`, `make lint`, `make test`, then the `security-review` skill — in that order. If any fail, fix and re-run; do not commit until all four pass.

## Architecture

Monorepo (pnpm workspace): `apps/api` (NestJS), `apps/web` (Vue 3 SPA). `packages/` is reserved, currently empty.

### Domain

Manual-entry personal finance manager: members own banks → accounts → operations (transactions). Operations can be transfers between two of a member's accounts, or automated via recurring schedulers. Reports/dashboard aggregate balances and spending. Every entity that carries a monetary/flow direction (`payment_method`, `category`, `operation`, `scheduler`) shares one `entry_type` enum: `'debit' | 'credit'` — a payment method and a category are each pinned to one type, and the type on an operation/scheduler must match both (enforced server-side, see `operation.service.ts`'s `validateTypedRefs`; mirrored client-side in the Vue forms' type-driven filtering).

Money is stored as integers scaled by `MONEY_SCALE = 10000` (four decimal places) — see `apps/api/src/common/money.ts`'s `toMinorUnits`/`toMajorUnits`. Never do currency math in floating-point major units.

Reference data (`payment_method`, `category`) is fixed/seeded, not user-editable — ids are relied on as stable identifiers both in `apps/api/src/db/seed-data.ts` and hardcoded in `apps/web/src/pages/operations/operations.types.ts` (`PAYMENT_METHOD_NAMES`, `PAYMENT_METHOD_TYPES`, etc.). Changing these ids/types means updating both sides.

### API (`apps/api`, NestJS)

One Nest module per bounded concern (`apps/api/src/*/`, wired in `app.module.ts`): `auth` (sign-in/out, password recovery/change, activation), `webauthn` (passkey registration/authentication — an additional, optional, passwordless sign-in method alongside the password, not a 2nd factor), `session` (cookie sessions, CSRF, rotation, absolute TTL), `security` (audit log, rate limiting, hashing/crypto, ownership scoping), `members`, `banks`, `accounts`, `operations` (incl. transfers, scheduler catch-up), `schedulers`, `reference-data`, `reports`, `dashboard`, `email` (BullMQ + nodemailer), `logging` (pino).

- **DB**: Postgres via Drizzle ORM. Schema lives in `apps/api/src/db/schema/*.ts` (one file per table + `enums.ts`), config in `apps/api/drizzle.config.ts`, generated migrations in `apps/api/drizzle/`. Run `db:generate` after schema edits, `db:migrate` to apply (auto-run by the `api` container's start command).
- **Sessions**: cookie-based, server-side, revocable — stored in Valkey (`connect-redis`/`ioredis`), not JWT. The signed-in member id is read via `session/require-member-id.ts`'s `requireMemberId(req)`, not by re-reading `req.session.memberId`.
- **CSRF**: the cookie is httpOnly; the client mints a fresh CSRF token per mutating request rather than mirroring a JS-readable cookie (see `apps/web/src/api/client.ts`).
- **Rate limiting**: `rate-limiter-flexible` backed by Valkey (`security/rate-limit.*`).
- **Ownership scoping**: the bank→account(→operation/scheduler) ownership chain, and the flat report-owner check, are centralized in `security/ownership.service.ts` (`OwnershipService`) — every service that scopes a query to the signed-in member calls its `requireOwned*`/`filterOwned*` methods rather than re-joining bank/account itself. "Closed" is never folded into these checks (closed stays reachable/listable); each caller decides whether it needs a fully-active chain for a mutation.
- **Reports**: chart aggregation is done in Postgres (SQL grouping), not pulled into app-level JS — see `reports/chart.service.ts` and `common/chart-axis.ts` / `common/synthesis-chart.ts`.
- **Tests**: `*.spec.ts` = jest unit tests (co-located, mocked DB). `*.integration-spec.ts` = jest integration tests (`jest-integration.json`, run via `test:integration`) spin up real Postgres/Valkey through Testcontainers — that's why the `api` dev container mounts the host Docker socket.

### Web (`apps/web`, Vue 3)

- **State/data**: TanStack Query for server state, Pinia (`stores/session.store.ts`) only for client-side session state; forms use VeeValidate + Zod (`*.schemas.ts` next to each page).
- **API client**: typed via `openapi-fetch` against a schema generated from the API's Swagger doc (`pnpm generate:api-client`, output `src/api/schema.d.ts` — regenerate after API contract changes). `src/api/client.ts` centralizes the CSRF-token-per-mutation middleware and global 401 handling (clears the session store, redirects to sign-in).
- **Routing**: `vue-router`, all routes under an `/en` prefix (`src/router/index.ts`); `meta: { requiresAuth: true }` gates authenticated pages.
- **Pages**: `src/pages/<domain>/` (e.g. `operations/`, `schedulers/`, `accounts/`), each typically pairing a `*Page.vue`/`*Form.vue` with a `.types.ts` (shared constants/helpers, e.g. `PAYMENT_METHODS`) and `.schemas.ts` (Zod validation) — the debit/credit type-driven filtering of category/payment-method choices is centralized in the `useTypedReferenceData` composable (`OperationForm.vue`, `SchedulerForm.vue`, `search.vue` all use it) and must stay in sync with the API's `validateTypedRefs`.
- **E2E**: Playwright, config/tests under `apps/web/e2e/`, run against a real backend (see `make test-e2e` / the `playwright` compose service, which shares the `web` container's network namespace so cookies work correctly with `localhost` origins).
