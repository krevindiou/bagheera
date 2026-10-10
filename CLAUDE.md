# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Docker only — no local runtime

**Everything runs in Docker containers. Never run the app, its tests, or its tooling with a local Node/pnpm/Postgres install.** `node_modules` lives only in named Docker volumes (see `docker/compose.yml`) — any `node_modules` visible on the host is a stray empty mountpoint, not real deps; ignore it, don't `pnpm install` there. Every `pnpm`/`drizzle-kit`/etc. command must run **inside** the `api`/`web` container (`make shell-api`, `make shell-web`, `make exec-api CMD=...`, `make exec-web CMD=...`), or you'll hit permission errors and/or touch the wrong DB. Each container mounts only its own app plus `packages/`, so workspace-wide checks (`pnpm dedupe --check`, knip) run in CI, not through `make`.

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
make build              # build api + web and their packages/* deps, as CI does
make migrate            # run db migrations
make lint                # lint api + web + packages/*
make format              # format api + web + packages/*
make shell-api           # shell into the api container
make shell-web           # shell into the web container
make exec-api CMD="..."   # run a command in the api container, from apps/api
make exec-web CMD="..."   # run a command in the web container, from apps/web

make test                # unit + integration + e2e
make test-unit           # api + web + packages/* unit tests (all vitest)
make test-integration    # api integration tests (vitest.integration.config.mts, uses Testcontainers)
make test-e2e            # boots a separate `bagheera-e2e` compose stack, seeds it, runs Playwright (E2E_ARGS="auth.spec.ts" for one spec)
```

Anything not covered by a dedicated target goes through `make exec-api`/`make exec-web` — e.g.:

```bash
make exec-api CMD="pnpm test:cov"
make exec-api CMD="pnpm test common/like-pattern.spec.ts"    # single api test (no `--`: vitest would drop the filter)
make exec-api CMD="pnpm db:generate --name <snake_case_description>"  # new drizzle migration after schema changes — always pass --name, or drizzle-kit picks a random adjective_noun tag instead
make exec-api CMD="pnpm db:seed"                             # seed payment_method/category reference data
make exec-web CMD="pnpm test src/domain/money.spec.ts"      # single web test
make exec-web CMD="pnpm generate:api-client"                 # regenerate src/api/schema.d.ts from the running api
make test-e2e E2E_ARGS="auth.spec.ts"                        # single e2e spec (Playwright needs glibc, so it never runs in the musl `web` container)
```

A raw `docker compose -f docker/compose.yml ...` fails with "required variable DOCKER_GID is missing a value" unless `DOCKER_GID` and `PLAYWRIGHT_VERSION` are exported; the Makefile exports both.

Every `make` target above is dev-only; deploys go through Kamal (`.kamal/secrets`) as two apps: `config/deploy.yml` builds `docker/Dockerfile.caddy` (Caddy serving the built SPA, plus the Postgres/Valkey accessories) and `config/deploy.api.yml` builds `docker/Dockerfile.api`. kamal-proxy routes `/api` and `/health` to the API by path; Caddy never proxies it. See `scripts/backup.sh` for the Postgres backup routine that runs on the deploy host.

## Before committing

Never commit or push unless the user explicitly asks.

Run these in order; if any fail, fix and re-run before moving to the next. Do not commit until every step passes:

1. Tests in sync with the codebase: new code has new tests, changed code has updated tests, removed code has its tests removed too. Compare coverage before/after (`pnpm test:cov`, see below) — it should not drop.
2. `make format`
3. `make lint`
4. `make build`
5. `make test-unit`
6. `security-review` skill

## Architecture

Monorepo (pnpm workspace): `apps/api` (NestJS), `apps/web` (Vue 3 SPA), `packages/` (cross-stack code both depend on — `packages/money` and `packages/reference-data`, see below). A `packages/*` member ships compiled output (`main`/`types` point at `dist/`, built via its own `pnpm build`) since the API's production image runs `node dist/main` with no TS loader — editing a package's `src/` needs `pnpm --filter <package> build` (or a container restart) to reach a running dev container, unlike `apps/api`/`apps/web`'s own hot reload.

### Domain

Manual-entry personal finance manager: members own banks → accounts → operations (transactions). Operations can be transfers between two of a member's accounts, or automated via recurring schedulers. Reports/dashboard aggregate balances and spending. Every entity that carries a monetary/flow direction (`payment_method`, `category`, `operation`, `scheduler`) shares one `entry_type` enum: `'debit' | 'credit'` — a payment method and a category are each pinned to one type, and the type on an operation/scheduler must match both (enforced server-side by `operations/entry-rules.ts`'s `validateTypedRefs`, called from both the operation and scheduler services; mirrored client-side in the Vue forms' type-driven filtering).

Money is stored as integers scaled by `MONEY_SCALE = 10000` (four decimal places) — see `packages/money`'s `toMinorUnits`/`toMajorUnits` (also home to `AMOUNT_CEILING`, the sanity ceiling `AmountField()` and the web amount schemas validate against). `apps/api/src/common/money.ts` and `apps/web/src/domain/money.ts` re-export/wrap it rather than each carrying their own copy. Never do currency math in floating-point major units.

Reference data (`payment_method`, `category`) is fixed/seeded, not user-editable. Payment-method ids (`PAYMENT_METHOD_ID`) and the transfer-method list live in `packages/reference-data`, imported by both `apps/api/src/db/seed-data.ts` and `apps/web/src/domain/referenceData.ts` (the latter also keeps its own `PAYMENT_METHOD_ICONS`, web-only). The supported UI/email locales (`SUPPORTED_LOCALES`, `DEFAULT_LOCALE`) live there too, re-exported by `apps/api/src/common/locale.ts` and `apps/web/src/i18n/locales.ts`; so do `ENTRY_TYPES`/`EntryType`, the report and scheduler enum lists (`REPORT_TYPES`, `PERIOD_GROUPINGS`, `DATA_GROUPINGS`, `FREQUENCY_UNITS`), `COUNTRY_CODES`, `CURRENCY_CODES`, `MAX_SIGNIFICANT_RESULTS_NUMBER` the value-date rule (`MIN_VALUE_DATE`, `MAX_VALUE_DATE`, `isValueDate`) and `isoDateIn` (a calendar day in a time zone), which both apps import from `@bagheera/reference-data` directly or through a thin re-export (`apps/api/src/common/currency.ts`, `apps/api/src/common/value-date.ts`, `apps/web/src/domain/referenceData.ts`). Category ids are generated by the database (only Salary has a fixed id), so never hardcode them.

### API (`apps/api`, NestJS)

One Nest module per bounded concern (`apps/api/src/*/`, wired in `app.module.ts`): `auth` (current session, sign-out, scheduler catch-up at sign-in), `webauthn` (passkeys — the only sign-in method: sign-up, sign-in, registering more passkeys, step-up before sensitive changes; there are no passwords), `session` (cookie sessions, CSRF, rotation, absolute TTL), `security` (audit log, rate limiting, crypto, ownership scoping), `members` (email-confirmed sign-up, profile, email change), `banks`, `accounts`, `operations` (incl. transfers), `schedulers`, `reference-data`, `reports`, `dashboard`, `email` (BullMQ + nodemailer), `logging` (pino), `health` (`/health`, probed by compose and kamal-proxy).

- **DB**: Postgres via Drizzle ORM. Schema lives in `apps/api/src/db/schema/*.ts` (one file per table + `enums.ts`), config in `apps/api/drizzle.config.ts`, generated migrations in `apps/api/drizzle/`. Run `db:generate` after schema edits, `db:migrate` to apply (auto-run by the `api` container's start command).
- **Sessions**: cookie-based, server-side, revocable — stored in Valkey (`connect-redis`/`ioredis`), not JWT. The signed-in member id is read via `session/require-member-id.ts`'s `requireMemberId(req)`, not by re-reading `req.session.memberId`.
- **CSRF**: the cookie is httpOnly; the client mints a fresh CSRF token per mutating request rather than mirroring a JS-readable cookie (see `apps/web/src/api/client.ts`).
- **Rate limiting**: `rate-limiter-flexible` backed by Valkey (`security/rate-limit.*`).
- **Ownership scoping**: the bank→account(→operation/scheduler) ownership chain, and the flat report-owner check, are centralized in `security/ownership.service.ts` (`OwnershipService`) — every service that scopes a query to the signed-in member calls its `requireOwned*`/`filterOwned*` methods rather than re-joining bank/account itself. "Closed" is never folded into these checks (closed stays reachable/listable); each caller decides whether it needs a fully-active chain for a mutation (`requireOwnedFullyActiveAccount`, or `operations/entry-rules.ts`'s `requireFullyActive`/`requireFullyActiveLocked`). A query that needs "this member's reachable accounts" as one condition among others (not a single id/set of ids `OwnershipService` already has a method for) uses `security/reachable.ts`'s `reachableAccountsOf(db, memberId)` — it builds its own `EXISTS` subquery against `bank`, so it's correct even in a query that never joins `bank` itself, unlike a caller hand-rolling the same join. New code should never import `bank` from `db/schema` to re-derive ownership/active-ness by hand; go through one of these instead.
- **Reports**: chart aggregation is done in Postgres (SQL grouping), not pulled into app-level JS — see `reports/report-series.service.ts`, `reports/report-distribution.service.ts` (period buckets in `reports/chart/period.ts`) and `common/chart-axis.ts` / `common/synthesis-chart.ts`.
- **Tests**: `*.spec.ts` = vitest unit tests (co-located, mocked DB). `*.integration-spec.ts` = vitest integration tests (`vitest.integration.config.mts`, run via `test:integration`) spin up real Postgres/Valkey through Testcontainers — that's why the `api` dev container mounts the host Docker socket.

### Web (`apps/web`, Vue 3)

- **State/data**: TanStack Query for server state, Pinia (`stores/session.store.ts`) only for client-side session state; forms use VeeValidate + Zod (`*.schemas.ts` next to each page).
- **API client**: typed via `openapi-fetch` against a schema generated from the API's Swagger doc (`pnpm generate:api-client`, output `src/api/schema.d.ts` — regenerate after API contract changes). `src/api/client.ts` centralizes the CSRF-token-per-mutation middleware and global 401 handling (clears the session store, redirects to sign-in).
- **Routing**: `vue-router`, all routes under a `/:locale` prefix constrained to `SUPPORTED_LOCALES` (`src/i18n/locales.ts`, currently `en`/`fr`; `src/router/index.ts`); `meta: { requiresAuth: true }` gates authenticated pages.
- **Pages**: `src/pages/<domain>/` (e.g. `operations/`, `schedulers/`, `accounts/`), each typically pairing a `*Page.vue`/`*Form.vue` with a `.types.ts` (types derived from the generated API schema) and `.schemas.ts` (Zod validation) — the debit/credit type-driven filtering of category/payment-method choices is centralized in the `useTypedReferenceData` composable (used by `operations/OperationFields.vue`, which `OperationForm.vue` and `SchedulerForm.vue` share, and by `operations/search.vue`) and must stay in sync with the API's `validateTypedRefs`.
- **E2E**: Playwright, config/tests under `apps/web/e2e/`, run against a real backend (see `make test-e2e` / the `playwright` compose service, which shares the `web` container's network namespace so cookies work correctly with `localhost` origins).
