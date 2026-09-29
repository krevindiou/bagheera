# Restoring from a backup

## Deploy host SSH setup (one-time)

`ci.yml`'s deploy job and `backup.yml` both pin the deploy host's SSH key
in a `DEPLOY_HOST_KNOWN_HOSTS` secret rather than trusting whatever
`ssh-keyscan` returns on each run (that accepts whichever key answers,
which a DNS/routing MITM could exploit). `backup.yml` also connects as a
dedicated `backup` user instead of `root`, so a leaked
`KAMAL_SSH_PRIVATE_KEY` can only reach the postgres container, not the
whole host. Both need a one-time setup on the deploy host, done once
(and again if the host is ever rebuilt or its key rotated):

1. **Capture the host's key** from a trusted connection (e.g. right after
   provisioning the host, or over a connection you've already verified
   out of band):
   ```sh
   ssh-keyscan -H <deploy-host> > known_hosts_line
   cat known_hosts_line   # sanity-check: one non-empty line per key type
   ```
2. **Store it as a repo secret:**
   ```sh
   gh secret set DEPLOY_HOST_KNOWN_HOSTS < known_hosts_line
   rm known_hosts_line
   ```
3. **Provision the `backup` user** on the deploy host (as root or an
   existing sudo user):
   ```sh
   useradd --create-home --shell /bin/bash backup
   usermod -aG docker backup
   install -d -m 700 -o backup -g backup /home/backup/.ssh
   # The same public key KAMAL_SSH_PRIVATE_KEY's private half pairs with —
   # reusing Kamal's own deploy key means no new GitHub secret is needed.
   cp /root/.ssh/authorized_keys /home/backup/.ssh/authorized_keys
   chown backup:backup /home/backup/.ssh/authorized_keys
   chmod 600 /home/backup/.ssh/authorized_keys
   ```
   Membership in the `docker` group is root-equivalent for anything
   touching the Docker socket — this trades "backup's key can reach the
   whole host as root" for "backup's key can reach the whole host via
   docker", which is why it's still a distinct, narrower user rather than
   a sandboxed one: it removes *root login* from what a leaked key gets,
   not full host access. A tighter setup (e.g. a rootless backup
   container with only the postgres socket mounted in) is a further step,
   not required by this one.

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
