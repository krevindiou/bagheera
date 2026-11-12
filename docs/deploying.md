# Deploying

The first deployment is walked through in the README's "Deploy it on your own
server". This page covers what happens on each deploy and the rules to follow
afterwards.

## How a release reaches the host

- Pushes to `main` publish nothing: CI lints and tests them (docs-only changes
  skip it), and builds the images without pushing when a change touches
  `docker/`, a `package.json` or the lockfile (`.github/workflows/docker.yml`).
- release-please keeps a "chore(main): release x.y.z" pull request open, built
  from the Conventional Commits pushed to `main` since the last release:
  `feat` bumps the minor version, `fix` the patch, a breaking change (`!` or a
  `BREAKING CHANGE:` footer) the major; `CHANGELOG.md` lists them. A
  `Release-As: x.y.z` footer in a commit message forces the next version.
- Merging that pull request tags `vx.y.z` and creates the GitHub release; the
  Release workflow (`.github/workflows/release.yml`) then runs CI and the
  end-to-end tests on that commit, builds `bagheera-api`
  (`docker/Dockerfile.api`) and `bagheera-web` (`docker/Dockerfile.caddy`:
  Caddy serving the built SPA, see `docker/Caddyfile` for its security
  headers) for amd64 and arm64, each on a native runner, scans them with Trivy
  and pushes them to GitHub Container Registry (`ghcr.io`) tagged `x.y.z` and
  `latest`. The images are public and hold no secrets or deployment settings.
  A failing test, or a critical or high CVE with a fix, stops it before
  anything is pushed: fix it (for a CVE, usually a base image or dependency
  bump) and merge the next release pull request.
- The published `latest` is re-scanned weekly
  (`.github/workflows/image-scan.yml`): a failure means a fix exists, so
  release it.
- `make deploy TAG=<version>` (`scripts/deploy.sh`, which needs `uc` and Docker
  on your machine) rolls those images out with
  `uc deploy -f docker/compose.prod.yml`, which also runs Postgres and Valkey.
  Migrations run from the new API image before it replaces the old one.
- Uncloud's Caddy terminates TLS and routes `/api` and `/health` to the API,
  everything else to the web container. Settings and secrets come from
  `docker/prod.env` (copy `docker/prod.env.example`).

## Publishing your own images

Only needed if you changed the code and want to deploy your build rather than
the public `ghcr.io/krevindiou/bagheera-*` images. Fork the repository, enable
its Actions, and allow GitHub Actions to create pull requests (Settings →
Actions → General → Workflow permissions). Pushes to your fork's `main` then
open release pull requests; merging one publishes both images to
`ghcr.io/<your-account>/bagheera-api` and `bagheera-web`, with no secret to set
up. After the first publish, make both packages public (each package's
settings on GitHub, "Change visibility") so the host can pull them
anonymously, and set `IMAGE_NAMESPACE=ghcr.io/<your-account>` in
`docker/prod.env`.

## Deploying and rolling back

`make deploy` deploys the latest release tag on `origin`; `make deploy
TAG=<version>` another one (a leading `v` is dropped; the script refuses one
whose images are missing). Uncloud
replaces containers one at a time: it starts the new one, waits for its health
check, then removes the old one, so a release that never turns healthy leaves
the previous one serving. Extra arguments go to `uc deploy`, e.g.
`scripts/deploy.sh <version> -y` to skip the confirmation.

To roll back, deploy an older version.

## Deploying schema changes

Migrations run from the new API image while the previous release is still
serving traffic, so every migration must work against the API version currently
running: expand first (add columns/tables, backfill, widen types), and only
drop, rename, or tighten a shape in a later release once no running code
depends on the old one. Drizzle migrations here are forward-only — there's no
down migration to undo one. A failing migration aborts the deploy before any
API container is replaced.

Rolling back the API (`make deploy TAG=<previous version>`, e.g. after a failed
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
