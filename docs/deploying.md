# Deploying

The first deployment is walked through in the README's "Deploy it on your own
server". This page covers what happens on each deploy and the rules to follow
afterwards.

## How a release reaches the host

- On pushes to `main` that pass the tests, CI's `publish` job builds
  `bagheera-api` (`docker/Dockerfile.api`) and `bagheera-web`
  (`docker/Dockerfile.caddy`: Caddy serving the built SPA, see
  `docker/Caddyfile` for its security headers) for amd64 and arm64, and pushes
  them to Docker Hub tagged with the git SHA and `latest`. The images are
  public and hold no secrets or deployment settings.
- `make deploy TAG=<git sha>` (`scripts/deploy.sh`, which needs `uc` and Docker
  on your machine) rolls those images out with
  `uc deploy -f docker/compose.prod.yml`, which also runs Postgres and Valkey.
  Migrations run from the new API image before it replaces the old one.
- Uncloud's Caddy terminates TLS and routes `/api` and `/health` to the API,
  everything else to the web container. Settings and secrets come from
  `docker/prod.env` (copy `docker/prod.env.example`).

## Publishing your own images

Only needed if you changed the code and want to deploy your build rather than
the public `krevindiou/bagheera-*` images. Fork the repository, create two
public Docker Hub repositories, `bagheera-api` and `bagheera-web`, and an
access token with Read & Write scope. In your fork's Actions settings, add the
variable `DOCKERHUB_USERNAME` and the secret `DOCKERHUB_TOKEN`, then set
`DOCKERHUB_USERNAME` in `docker/prod.env` to your account. Each push to `main`
then publishes both images under your account, tagged with the git SHA.

## Deploying and rolling back

`make deploy TAG=<git sha>` takes a SHA CI has published (`$(git rev-parse HEAD)` on a checkout of `main`; the script refuses one
whose images are missing). Uncloud replaces containers one at a time: it starts
the new one, waits for its health check, then removes the old one, so a release
that never turns healthy leaves the previous one serving. Extra arguments go to
`uc deploy`, e.g. `scripts/deploy.sh <sha> -y` to skip the confirmation.

To roll back, deploy an older SHA.

## Deploying schema changes

Migrations run from the new API image while the previous release is still
serving traffic, so every migration must work against the API version currently
running: expand first (add columns/tables, backfill, widen types), and only
drop, rename, or tighten a shape in a later release once no running code
depends on the old one. Drizzle migrations here are forward-only — there's no
down migration to undo one. A failing migration aborts the deploy before any
API container is replaced.

Rolling back the API (`make deploy TAG=<previous git sha>`, e.g. after a failed
health check) leaves the schema exactly as the last migration left it; it does
not undo anything. Undoing a migration means a restore per
[`backup-restore.md`](backup-restore.md).

## Valkey persistence

Valkey runs with the append-only file (`--appendonly yes --appendfsync
everysec`), so sessions, revocations and queued jobs survive an unclean stop
(SIGKILL, OOM, host crash). Without it, Valkey reloads its last RDB snapshot,
which can be around 30 minutes old and would bring revoked or signed-out
cookies back to life. `everysec` can still lose about a second of writes on a
host crash; `--appendfsync always` narrows that further at a write-latency
cost.

## Backups

`scripts/backup.sh` is the Postgres backup routine that runs on the deploy host;
[`backup-restore.md`](backup-restore.md) covers restoring.
