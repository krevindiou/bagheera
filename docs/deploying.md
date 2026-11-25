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
- That pull request runs the end-to-end tests and builds and scans the three images
  for amd64 and arm64 without pushing them (`.github/workflows/release-check.yml`),
  so merge it once its checks are green. They start only because a GitHub App
  opens the pull request (the `RELEASE_APP_ID` variable and
  `RELEASE_APP_PRIVATE_KEY` secret, with Contents, Pull requests and Issues
  write access): a pull request opened with `GITHUB_TOKEN` triggers no
  workflow.
- Merging that pull request tags `vx.y.z` and creates the GitHub release; the
  Release workflow (`.github/workflows/release.yml`) then runs CI and the
  end-to-end tests on that commit, builds `bagheera-api`
  (`docker/Dockerfile.api`), `bagheera-web` (`docker/Dockerfile.caddy`:
  Caddy serving the built SPA, see `docker/Caddyfile` for its security
  headers) and `bagheera-backup` (`docker/Dockerfile.backup`) for amd64 and arm64, each on a native runner, scans them with Trivy
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
open release pull requests; merging one publishes the images to
`ghcr.io/<your-account>/bagheera-api`, `bagheera-web` and `bagheera-backup`, with no secret to set
up (without the GitHub App, release pull requests get no checks before the
merge). After the first publish, make the packages public (each package's
settings on GitHub, "Change visibility") so the host can pull them
anonymously, and set `IMAGE_NAMESPACE=ghcr.io/<your-account>` in
`docker/prod.env`. `bagheera-backup` arrived later than the other two (in
2.0.0): if your fork published releases before it, make it public after the
first release that publishes it, or `make deploy` stops with
`bagheera-backup:<version> is not published, or not public`.

## Deploying and rolling back

`make deploy` deploys the latest release tag on `origin`; `make deploy
TAG=<version>` another one (a leading `v` is dropped; the script refuses one
whose images are missing). Uncloud
replaces containers one at a time: it starts the new one, waits for its health
check, then removes the old one, so a release that never turns healthy leaves
the previous one serving. Extra arguments go to `uc deploy`, e.g.
`scripts/deploy.sh <version> -y` to skip the confirmation.

To roll back, deploy an older version. Before 2.0.0 there was no
`bagheera-backup` image, so rolling back past 2.0.0 cannot be done from a 2.x
checkout (the script stops at the missing `bagheera-backup:<version>`): deploy
from the old tag's checkout instead, with its own `docker/compose.prod.yml`,
e.g. `git checkout v1.0.4` then `make deploy TAG=1.0.4` there. What then
happens to the running `backup` service, which the old compose file does not
know, has not been verified: check `uc ps` afterwards, and remove it by hand
if it is still there. The old release's backup then needs its old setup (the
`backup.yml` workflow and the host-side script) again.

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

A `backup` service in `docker/compose.prod.yml` dumps Postgres every night and
ships the dump to restic and/or an age-encrypted email, as configured in
`docker/prod.env` (`BACKUP_*`, `RESTIC_*`: see `docker/prod.env.example`).
`make deploy` installs it, and validates its configuration first
(`x-pre_deploy: backup-validate`): a missing destination or a malformed value
aborts the deploy with a readable message, and `BACKUP_DISABLED=true` is the
explicit opt-out. Only the database is backed up, not `docker/prod.env`.
[`backup-restore.md`](backup-restore.md) covers what is and is not backed up,
choosing destinations, alerts and restoring.

The backup sends its email (the encrypted dump, the alerts) with curl through
the stack's `EMAIL_SMTP_URL`, which must then be `smtp://` (STARTTLS, usually
port 587) or `smtps://` (TLS from the start, usually port 465), without
nodemailer's query options; a `smtp://host:465` URL may work for the API, but
not for curl, which would try STARTTLS on that port: write `smtps://` there.
Validation only checks the settings' form, so after the first deploy (and after
changing a destination or the mail settings) run one backup by hand and check
that it lands: `uc exec backup env BACKUP_REPORT=always backup-run` also sends
the `[Bagheera backup] OK` report when `BACKUP_ALERT_EMAIL` is set, which proves
the alert path ("Installing, and changing the configuration" in
[`backup-restore.md`](backup-restore.md)). Deploy outside the backup window
(03:00 in `APP_TIMEZONE` by default): a deploy that replaces the backup container
mid-run loses that night's backup, without an alert.

### Upgrading from the GitHub-triggered backup

Earlier releases backed up through the `backup.yml` GitHub workflow, which
reached the host over SSH. The first `make deploy` after upgrading **fails
until you configure the new service**: set `RESTIC_REPOSITORY` and
`RESTIC_PASSWORD` (plus the storage's credentials) and/or `BACKUP_EMAIL_TO` and
`BACKUP_EMAIL_AGE_RECIPIENT` in `docker/prod.env`, or `BACKUP_DISABLED=true`.
You can reuse the old restic repository and password to keep the existing
snapshots, with one catch: the new service records every snapshot under the host
name `bagheera`, and its retention only considers that host's snapshots. The old
snapshots carry the deploy host's own host name, so **they are never pruned**
and stay until you remove them by hand, from a shell in the backup container
(see [`backup-restore.md`](backup-restore.md)). For example, to keep only the
last 3 (an example: adapt `<old-host>` and the number, and check
`restic snapshots` first):

```sh
restic forget --host <old-host> --tag postgres --keep-last 3 --prune
```

Once the new backup has run, you can delete what the old one left behind:

- the GitHub secrets `BACKUP_SSH_PRIVATE_KEY`, `DEPLOY_HOST` and
  `DEPLOY_HOST_KNOWN_HOSTS`;
- on the host: the `backup` user (and its `authorized_keys`, the forced-command
  key), `/usr/local/bin/backup.sh` and `/etc/bagheera-backup.env`.

## Deploying with a non-root account (optional)

`uc machine init` is usually pointed at `root@<deploy-host>`, and `uc` keeps
connecting as whoever its context names. To stop root being reachable with
your deploy key, give deploys an account of their own:

```sh
useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys   # your own public key
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

Then check that `uc` works through it: `uc --connect ssh://deploy@<deploy-host> ps`.
Whether a non-root account may use the Uncloud daemon depends on its socket's
permissions, so if `uc` is refused, keep the root login for deploys and skip
this step. Once it works, point your context at the new account (`uc ctx
connection`) and remove root's SSH access (`PermitRootLogin no`, or delete
root's `authorized_keys`).
