# Restoring from a backup

## Deploy host SSH setup (one-time)

Two different SSH identities reach the deploy host, and neither should be a
root login:

- **Deploys** (`ci.yml`'s deploy job, via Kamal) use `KAMAL_SSH_PRIVATE_KEY`.
- **Backups** (`backup.yml`) use their own key, `BACKUP_SSH_PRIVATE_KEY`,
  which on the host can do exactly one thing: run the backup script.

Both pin the host's SSH key in a `DEPLOY_HOST_KNOWN_HOSTS` secret rather than
trusting whatever `ssh-keyscan` returns on each run (that accepts whichever
key answers, which a DNS/routing MITM could exploit). Everything below is done
once, and again if the host is rebuilt or its key rotated.

### 1. Pin the host key

Capture it from a trusted connection (e.g. right after provisioning the
host, or over a connection you've already verified out of band):

```sh
ssh-keyscan -H <deploy-host> > known_hosts_line
cat known_hosts_line   # sanity-check: one non-empty line per key type
gh secret set DEPLOY_HOST_KNOWN_HOSTS < known_hosts_line
rm known_hosts_line
```

### 2. Backups: own key, one forced command

A leaked backup key should be able to start a backup and nothing else — not
read the database, not reach a shell, not point the dump at someone else's
restic repository. So the restic and Postgres configuration lives **on the
host**, and the key is tied to a single root-owned script.

On the deploy host, as root:

```sh
useradd --create-home --shell /bin/bash backup
usermod -aG docker backup          # docker exec into the postgres container
install -d -m 700 -o backup -g backup /home/backup/.ssh

# The script the key is allowed to run. Root-owned, so the backup user (and
# anyone holding its key) cannot edit it. Re-run this after scripts/backup.sh
# changes in the repo.
install -m 755 -o root -g root scripts/backup.sh /usr/local/bin/backup.sh

# Its configuration: the env vars listed in scripts/backup.sh's header.
# Readable by the backup user, writable by nobody but root.
install -m 640 -o root -g backup /dev/null /etc/bagheera-backup.env
$EDITOR /etc/bagheera-backup.env
```

`/etc/bagheera-backup.env` holds plain `KEY=value` lines (no `export`, no
quoting needed for simple values):

```
RESTIC_REPOSITORY=...
RESTIC_PASSWORD=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
POSTGRES_PASSWORD=...
POSTGRES_CONTAINER=bagheera-web-postgres
```

Generate the key pair somewhere safe (not on the host), authorize the public
half with the restrictions, and give CI the private half:

```sh
ssh-keygen -t ed25519 -N "" -C bagheera-backup -f backup_key
gh secret set BACKUP_SSH_PRIVATE_KEY < backup_key
# On the host, as root (replace the key material with backup_key.pub's):
printf 'restrict,command="/usr/local/bin/backup.sh" %s\n' "$(cat backup_key.pub)" \
  > /home/backup/.ssh/authorized_keys
chown backup:backup /home/backup/.ssh/authorized_keys
chmod 600 /home/backup/.ssh/authorized_keys
rm backup_key backup_key.pub
```

`restrict` turns off port/agent/X11 forwarding, PTY allocation and
`~/.ssh/rc`; `command=` runs the script whatever the client asks for. Once
this works, the `RESTIC_*`, `RESTIC_AWS_*` and (if nothing else uses it)
backup-only `BACKUP_POSTGRES_CONTAINER` values can be deleted from GitHub:
the workflow no longer sends them.

What this does *not* do: the `docker` group is root-equivalent for anyone
with a shell as that user. The forced command is what keeps the *key* away
from a shell; the account itself is still privileged. A rootless backup
container with only the postgres socket mounted is a further step, not
required by this one.

### 3. Deploys: a non-root account (optional switch)

Kamal connects as `root` unless told otherwise. To stop root being reachable
with the deploy key:

```sh
useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys   # KAMAL_SSH_PRIVATE_KEY's public half
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

Test it before switching (`ssh deploy@<deploy-host> docker ps`), then set the
repo variable `KAMAL_SSH_USER=deploy` (Settings → Variables). Both Kamal
configs read it and fall back to `root` while it is unset, so nothing changes
until you do. Once deploys work as `deploy`, remove root's SSH access
(`PermitRootLogin no`, or delete root's `authorized_keys`).

The first deploy as `deploy` is the real test: Kamal bootstraps its own
directories on the host, and anything it created earlier as root (for
example a `.kamal` directory) may need `chown`ing to `deploy`.

## Restoring

`scripts/backup.sh` pushes a `pg_dump` snapshot (custom format) to a restic
repository nightly. There's no WAL archiving, so this is the only recovery
point — the recovery point objective is however old the last successful
nightly run is (up to 24h). To restore:

1. **Find the snapshot.**
   ```sh
   restic snapshots --tag postgres
   ```

2. **Restore the file.**
   ```sh
   restic restore <snapshot-id> --target /tmp/bagheera-restore
   ```
   This drops the `pg_dump` file (under a path like
   `/tmp/bagheera-backup-XXXXXX.pgdump`) into `/tmp/bagheera-restore`.

3. **Load the dump into Postgres.**
   Against a fresh/scratch database (never the live one directly — restore
   to a scratch DB first, verify, then swap):
   ```sh
   createdb -U bagheera bagheera_restore
   pg_restore -U bagheera -d bagheera_restore --no-owner \
     /tmp/bagheera-restore/tmp/bagheera-backup-XXXXXX.pgdump
   ```

4. **Verify, then cut over.** Once `bagheera_restore` looks right (row
   counts, spot-checked rows), swap it in for the live database using
   your normal maintenance-window process.

This procedure was run once end-to-end against a scratch database as part
of building the backup script: a real snapshot was created, restored, and
`pg_restore`'d into a fresh database, and its row counts were checked
against the original.

If a tighter recovery point objective is ever needed, the option is
point-in-time recovery: a periodic `pg_basebackup` (or pgBackRest/WAL-G)
plus `archive_mode=on`, with WAL pruned against the oldest retained base
backup. Don't turn `archive_mode` back on without that — WAL segments with
no base backup to replay them onto are just unbounded disk growth, not a
recovery mechanism.
