# Contributing

## Reporting a bug or asking for a feature

Open an [issue](https://github.com/krevindiou/bagheera/issues). For a bug, say what you did, what you expected and what happened instead, with the browser or deployment details that matter. Issues are acknowledged within 14 days.

Security vulnerabilities are the exception: report them privately, as [`SECURITY.md`](SECURITY.md) explains, never in a public issue.

## Proposing a change

1. Fork the repository and branch off `main`.
2. Set up the stack as the [README](README.md#run-it-locally) explains: only Docker and Docker Compose are needed, everything else runs in containers.
3. Make the change, with its tests (see below).
4. Run `make precommit`: it formats, lints, runs every workspace-wide check CI runs (types, audit, knip, ...), builds and runs the unit tests. Fix anything it reports.
5. Open a pull request against `main`. CI must pass before it is merged.

## What a change must meet

- **Tests**: new functionality comes with automated tests, changed behaviour updates them and removed code removes them. Unit tests (`*.spec.ts`, Vitest) sit next to the code they test; API behaviour that needs Postgres or Valkey goes in an integration test (`*.integration-spec.ts`); user journeys go in a Playwright test under `apps/web/e2e/`. Coverage must not drop.
- **No warnings**: the linters (oxlint, ESLint) and the TypeScript compiler (strict mode) run with zero warnings allowed.
- **Formatting**: oxfmt, applied by `make format`.
- **Money**: amounts are integers in minor units (`packages/money`), never floating-point currency math.
- **Schema changes**: a Drizzle migration generated with `make exec-api CMD="pnpm db:generate --name <snake_case_description>"`, compatible with the previous release (see [`docs/deploying.md`](docs/deploying.md)).
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat(scope): ...`, `fix(scope): ...`), one logical change each.

By contributing, you agree that your contribution is licensed under the project's [MIT license](LICENSE).
