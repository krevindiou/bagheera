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
`~/.ssh/rc`; `command=` runs the script whatever the client asks for.

What this does _not_ do: the `docker` group is root-equivalent for anyone
with a shell as that user. The forced command is what keeps the _key_ away
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
nightly run is (up to 24h).

Retention (`BACKUP_KEEP_DAILY`/`WEEKLY`/`MONTHLY`) is applied with
`restic forget --group-by host`: each snapshot has its own dump path and day
tag, so grouping by paths (restic's default) or by tags would leave every
snapshot alone in its group and nothing would ever be pruned.

A restore rolls back more than data. A passkey removal exists only as a
missing `webauthn_credential` row, so restoring a snapshot taken before it
brings the passkey back — and if it was removed because it was compromised,
its holder can sign in again, with no alert and no audit row left to show the
removal happened. Steps 4 and 6 below undo that; don't skip them. To restore:

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

4. **Reconcile passkeys with the live database.** Do this before cut-over,
   while the live database is still readable, with the API stopped
   (`kamal app stop -c config/deploy.api.yml`) so live can't change under
   you. If the live database is lost, see "Live database lost" below
   instead.

   Export live's passkeys, and its audit rows since `<since>` — the
   snapshot's time from step 1 minus an hour or so (rows already in the
   snapshot are skipped on import):

   ```sh
   psql -U bagheera -d bagheera -v ON_ERROR_STOP=1 <<'SQL'
   \copy (SELECT id, member_id, credential_id, public_key, counter, transports, device_name, created_at, last_used_at FROM webauthn_credential) TO '/tmp/bagheera-restore/live-credentials.csv' CSV
   \copy (SELECT id, member_id, event_type, source_address, details, created_at FROM security_event WHERE created_at > '<since>') TO '/tmp/bagheera-restore/live-events.csv' CSV
   SQL
   ```

   Then make the restored passkeys match live: drop the ones removed since
   the snapshot, and copy in the ones added since — deleting alone would
   leave a member who replaced their only passkey with none. Counters take
   live's value, since a rolled-back counter would hide a cloned
   authenticator.

   ```sh
   psql -U bagheera -d bagheera_restore -v ON_ERROR_STOP=1 <<'SQL'
   BEGIN;
   CREATE TEMP TABLE live_credential (LIKE webauthn_credential);
   \copy live_credential (id, member_id, credential_id, public_key, counter, transports, device_name, created_at, last_used_at) FROM '/tmp/bagheera-restore/live-credentials.csv' CSV

   DELETE FROM webauthn_credential r
   WHERE NOT EXISTS (SELECT 1 FROM live_credential l WHERE l.credential_id = r.credential_id);

   -- Members who signed up after the snapshot aren't in the restore at all.
   INSERT INTO webauthn_credential (id, member_id, credential_id, public_key, counter, transports, device_name, created_at, last_used_at)
   SELECT l.id, l.member_id, l.credential_id, l.public_key, l.counter, l.transports, l.device_name, l.created_at, l.last_used_at
   FROM live_credential l
   WHERE NOT EXISTS (SELECT 1 FROM webauthn_credential r WHERE r.credential_id = l.credential_id)
     AND EXISTS (SELECT 1 FROM member m WHERE m.id = l.member_id);

   UPDATE webauthn_credential r
   SET counter = l.counter, last_used_at = l.last_used_at
   FROM live_credential l
   WHERE l.credential_id = r.credential_id AND l.counter > r.counter;

   -- Keeps the removals (and other security events) on record.
   CREATE TEMP TABLE live_event (LIKE security_event);
   \copy live_event (id, member_id, event_type, source_address, details, created_at) FROM '/tmp/bagheera-restore/live-events.csv' CSV
   INSERT INTO security_event (id, member_id, event_type, source_address, details, created_at)
   SELECT e.id, CASE WHEN EXISTS (SELECT 1 FROM member m WHERE m.id = e.member_id) THEN e.member_id END,
          e.event_type, e.source_address, e.details, e.created_at
   FROM live_event e
   ON CONFLICT (id) DO NOTHING;
   COMMIT;

   -- Members left with no passkey: they can't sign in (see below).
   SELECT m.id, m.email FROM member m
   WHERE NOT EXISTS (SELECT 1 FROM webauthn_credential c WHERE c.member_id = m.id);
   SQL
   ```

   Keep the two CSVs until step 6 and any recovery below are done, then
   delete them.

5. **Verify, then cut over.** Once `bagheera_restore` looks right (row
   counts, spot-checked rows), swap it in for the live database using
   your normal maintenance-window process.

6. **Flush sessions, then tell members.** Sessions live in Valkey, which the
   restore doesn't touch, so sessions opened after the snapshot (including
   any opened with a since-removed passkey) would otherwise outlive it.
   Before starting the API again, delete every session and per-member
   session set — only those: `FLUSHALL` would also drop queued emails and
   rate-limit lockouts.
   ```sh
   docker exec bagheera-web-valkey sh -c '
     for pattern in "sess:*" "member:*:sessions"; do
       valkey-cli --no-auth-warning -a "$VALKEY_PASSWORD" --scan --pattern "$pattern" |
         xargs -r valkey-cli --no-auth-warning -a "$VALKEY_PASSWORD" unlink
     done'
   ```
   Then email every member (`SELECT email, locale FROM member`) from
   outside the app: their data was restored to the snapshot's date, anything
   entered since is gone, and they should review their passkeys in settings,
   remove any they don't recognise, and report any passkey they had removed
   that shows up again.

Steps 1–3 were run once end-to-end against a scratch database as part of
building the backup script: a real snapshot was created, restored, and
`pg_restore`'d into a fresh database, and its row counts were checked
against the original.

If a tighter recovery point objective is ever needed, the option is
point-in-time recovery: a periodic `pg_basebackup` (or pgBackRest/WAL-G)
plus `archive_mode=on`, with WAL pruned against the oldest retained base
backup. Don't turn `archive_mode` back on without that — WAL segments with
no base backup to replay them onto are just unbounded disk growth, not a
recovery mechanism.

### Live database lost

Without a live database to compare against, the only record of removals
made after the snapshot is one kept outside Postgres. The ideal is an
append-only list of removed `credential_id`s, one per line, kept off the
database host and written _before_ the removal's delete commits, so no
committed removal can be missing from it. The app doesn't write one today,
so at minimum the operator builds it at restore time: the "passkey removed"
alert emails members received since the snapshot (ask them, or check
the mail provider's send log) say who removed a passkey, but not which one —
for each such member, list their restored passkeys
(`SELECT credential_id, device_name, created_at, last_used_at FROM webauthn_credential WHERE member_id = '<member-id>'`)
and have them confirm which to drop.

Re-apply the list to the restored database in place of step 4's
reconciliation, then carry on with step 5:

```sh
psql -U bagheera -d bagheera_restore -v ON_ERROR_STOP=1 <<'SQL'
CREATE TEMP TABLE removed_credential (credential_id text);
\copy removed_credential FROM 'removed-credentials.txt'
DELETE FROM webauthn_credential WHERE credential_id IN (SELECT credential_id FROM removed_credential);
SELECT m.id, m.email FROM member m
WHERE NOT EXISTS (SELECT 1 FROM webauthn_credential c WHERE c.member_id = m.id);
SQL
```

Passkeys added after the snapshot can't be recovered this way, so members
who replaced a passkey are the likely ones left with none.

### Members left with no passkey

There are no passwords and no account recovery, so a member the queries
above list can't sign in or register a new passkey, and the app has no
tooling to help. Recovery is manual: confirm the person's identity out of
band (e.g. a reply from the account's email address plus details only they
would know), find a passkey they still hold — its row in
`live-credentials.csv` or an older snapshot, confirmed with them by
`device_name`/`created_at` and never one on the removed list — and insert
that row back. Record what was done. If they hold none, there's no way back
into that account.
