# Backups and restoring

A `backup` service in `docker/compose.prod.yml` dumps the database every night
and ships the dump to the destinations you configure in `docker/prod.env`.
`make deploy` installs it with the rest of the stack: there is no host
crontab, no GitHub workflow and no dedicated SSH user. Its scripts, image and
tests live in `docker/backup/` and `docker/Dockerfile.backup`.

## What is backed up and what is not

Only the Postgres dump (`pg_dump -Fc`, role `bagheera`, over the internal
network). **`docker/prod.env` is not backed up, and it is your job to keep a
copy of it somewhere safe and off the server.** `CRYPTO_KEYS` above all: the
encrypted fields in the database cannot be read without them, so a backup
restored without `CRYPTO_KEYS` is unusable. Keep alongside it:

- `RESTIC_PASSWORD`: the restic repository is encrypted with it, and a lost
  password makes the whole repository unreadable.
- The age private key (see below), if you use the email destination.

Valkey (sessions, queued jobs, rate-limit counters) is not backed up either;
step 6 of the restore flushes its sessions.

There is no WAL archiving, so the nightly dump is the only recovery point: the
recovery point objective is however old the last successful run is (up to
24h).

## Choosing destinations

The service refuses to deploy without at least one destination, or an explicit
`BACKUP_DISABLED=true`. Both destinations can be on at once; they are
independent, and one failing does not stop the other. The settings, with
their defaults, are documented in `docker/prod.env.example`.

**restic** (`RESTIC_REPOSITORY`, `RESTIC_PASSWORD`): an encrypted, deduplicated
repository, created on first use. It can be:

- S3-compatible storage: `s3:https://s3.example.com/<bucket>/bagheera`, with
  `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
- An SFTP server: `sftp:<user>@<host>:/path/to/repo`, with
  `BACKUP_SFTP_PRIVATE_KEY` and `BACKUP_SFTP_KNOWN_HOSTS` (the output of
  `ssh-keyscan <host>`; the backup never trusts an unknown host).
- The local volume `backup_data`, mounted at `/backups`: set
  `RESTIC_REPOSITORY=/backups/restic`. A local path must be under `/backups`,
  the only place in the container that outlives a deploy, and the volume must
  be writable by the container's `backup` user (uid 10001): the deploy refuses
  anything else. **A local volume alone does not protect against losing the
  host**: it lives on the same machine as the database.

Give each Bagheera instance a repository of its own: every instance records
its snapshots under the same host name and tag, so two sharing a repository
would prune each other's snapshots.

Retention is `BACKUP_KEEP_DAILY`/`WEEKLY`/`MONTHLY` (7/4/6), applied after each
backup with
`restic forget --host bagheera --group-by host --tag postgres --prune` and the
three `--keep-*` values. Every snapshot is recorded under the fixed host name
`bagheera`, and `forget` only looks at that host's snapshots. This is on
purpose: retention groups by host name, and a container's own host name changes
with every deploy, so snapshots left under it would form a new group each time,
which never ages out. A failing `forget` after a successful backup alerts as
`restic-retention`: that night's snapshot is saved, only the pruning failed.

A `restic check` runs every Sunday at 04:30 and alerts on error. restic waits up
to 10 minutes for a repository lock (`--retry-lock 10m`), so a weekly check and
a backup that overlap do not fail.

**Email** (`BACKUP_EMAIL_TO`, `BACKUP_EMAIL_AGE_RECIPIENT`): the dump,
encrypted with [age](https://age-encryption.org) to a public key and attached
to a message sent through the stack's `EMAIL_SMTP_URL` and `EMAIL_FROM`. It is
never sent in clear, and the SMTP connection must use TLS. `BACKUP_EMAIL_TO`
(like `BACKUP_ALERT_EMAIL`) takes one bare address, such as `ops@example.com`.

The backup sends with curl, not with the API's nodemailer, so `EMAIL_SMTP_URL`
must be a URL both read: `smtp://user:password@host:587` (STARTTLS, usually
port 587) or `smtps://user:password@host:465` (TLS from the start, usually port
465), without nodemailer's query options (`?secure=...`). A URL written
`smtp://host:465` may work for the API, but curl would try STARTTLS on a port
that expects TLS from the start: write `smtps://` there.

Generate the key pair on your own machine, not the server:

```sh
age-keygen -o bagheera-backup.key
```

Put the public key it prints (`age1...`) in `BACKUP_EMAIL_AGE_RECIPIENT`, and
keep `bagheera-backup.key` off the server: it is the only way to read these
backups, and whoever holds it can read every one of them.

`BACKUP_EMAIL_MAX_MB` (default 10) is in MiB and caps the **encrypted** file.
Base64 adds about a third on the wire, so if your mail provider's limit is
around 10 MB, lower it. Over the cap the email destination fails and, if
`BACKUP_ALERT_EMAIL` is set, alerts (otherwise it is only in the container
logs); it never skips silently, but it also means the database has outgrown this
channel and you need restic.

## Alerts, and what they cannot tell you

A failed run emails `BACKUP_ALERT_EMAIL` with the last 20 lines of its log, with
secrets redacted (without that variable, failures only show in the container
logs, and the deploy prints a warning). `BACKUP_REPORT=always` also emails each
success; the default `failure` only emails failures. A failing weekly
`restic check` sends the same alert. There is no ping URL.

Know what this does not cover:

- **A stopped container, or a scheduler that does not run, sends nothing.** The
  alert is sent by the backup itself. Check now and then that `uc ps` shows the
  `backup` service healthy and that the latest snapshot (or email) is recent.
- **A run that hangs is cut short, not detected at once.** Each step (the dump,
  each restic command) gets at most `BACKUP_STEP_TIMEOUT` (default `2h`; a
  number, optionally followed by `s`, `m`, `h` or `d`), after which the run
  fails and alerts with the step marked `(timed out)`. `pg_dump` also gives up
  after 10 minutes waiting for a table lock, and an SFTP connection whose server
  stops answering is dropped after about two minutes. Until then the run holds
  the run lock, and a run started meanwhile refuses with the log line
  `another backup is already running` and sends nothing.
- **A deploy during a run loses that night's backup, without an alert**: the
  container being replaced stops mid-run. Deploy outside the backup window
  (03:00 in `APP_TIMEZONE` by default, see `BACKUP_SCHEDULE`).
- **No alert can be sent when SMTP itself is down**: the failure is only in the
  container logs.

## Installing, and changing the configuration

The backup runs at `BACKUP_SCHEDULE` (a 5-field cron expression, default
`0 3 * * *`), and the weekly `restic check` on Sundays at 04:30. Both follow
`APP_TIMEZONE` (the container's `TZ`), not UTC.

`make deploy` runs `backup-validate` (`x-pre_deploy`) before replacing the
backup container: an invalid configuration, or no destination, aborts the
deploy with a readable message. `BACKUP_DISABLED=true` is the explicit opt-out:
the container stays up, healthy, and does nothing. Settings are read from
`docker/prod.env` at deploy time, so apply a change by deploying again.

After the first deploy, and after changing a destination or the mail settings,
take one backup by hand (see the next section) and check that it lands: the
snapshot in `restic snapshots`, the message in the `BACKUP_EMAIL_TO` mailbox.
If `BACKUP_ALERT_EMAIL` is set, check the alert path too, with a run that
reports its success:

```sh
uc exec backup env BACKUP_REPORT=always backup-run
```

and confirm that the `[Bagheera backup] OK` message arrives. Validation checks
the settings' form, not that the SMTP server or the repository accepts them.

Upgrading from the release that backed up through a GitHub workflow: see
"Upgrading from the GitHub-triggered backup" in
[`deploying.md`](deploying.md).

## Running commands in the backup container

Everything below runs inside the `backup` container, which has `restic`,
`age`, `pg_dump` and `pg_restore`, and the repository and database settings
already in its environment. From your machine:

```sh
uc exec backup backup-run    # take a backup now
uc exec backup sh            # open a shell
```

`uc exec` ("Execute a command in a running service container") is documented
by Uncloud, but this repository's docs have not been checked against it: confirm the
invocation, and how it gives you a terminal, with `uc exec --help`. The
fallback that needs nothing from Uncloud is `docker exec` on the deploy host,
finding the container by its label, as the commands below do for the other
services:

```sh
docker exec -it "$(docker ps -q --filter label=uncloud.service.name=backup)" sh
```

## Restoring

A restore rolls back more than data. A passkey removal exists only as a
missing `webauthn_credential` row, so restoring a snapshot taken before it
brings the passkey back — and if it was removed because it was compromised,
its holder can sign in again, with no alert and no audit row left to show the
removal happened. Steps 4 and 6 below undo that; don't skip them. To restore,
open a shell in the backup container (above) and point the Postgres tools at
the database:

```sh
export PGHOST=postgres PGUSER=bagheera PGPASSWORD="$POSTGRES_PASSWORD"
mkdir -p /tmp/bagheera-restore
```

1. **Find the dump.**

   restic channel: list the snapshots (the dump is the file
   `bagheera.pgdump`, tagged `postgres`) and note the time of the one you want.

   ```sh
   restic snapshots --tag postgres
   ```

   Email channel: find the message `[Bagheera backup] YYYY-MM-DD (<N> KiB)`
   in the mailbox you configured, with its attachment
   `bagheera-YYYY-MM-DD.pgdump.age`.

2. **Get the file into the container.**

   restic channel:

   ```sh
   restic restore <snapshot-id> --target /tmp/bagheera-restore   # or `latest --tag postgres`
   ```

   This puts the dump at `/tmp/bagheera-restore/tmp/backup/bagheera.pgdump`.
   (Snapshots taken by the earlier host-side script hold it as
   `/tmp/bagheera-backup-XXXXXX.pgdump` instead.)

   Email channel: save the attachment and decrypt it with the private key
   from `age-keygen`, on your own machine so the key never reaches the server.
   Both commands below run on **your machine**: the second sends the
   decrypted dump to the container over SSH (`docker exec -i` runs on the deploy
   host, and needs the container's stdin). The decrypted dump is plaintext:
   delete `bagheera.pgdump` from your machine once restored.

   ```sh
   age -d -i bagheera-backup.key bagheera-YYYY-MM-DD.pgdump.age > bagheera.pgdump
   ssh <deploy-host> 'docker exec -i "$(docker ps -q --filter label=uncloud.service.name=backup)" sh -c "cat > /tmp/bagheera-restore/bagheera.pgdump"' < bagheera.pgdump
   ```

   The dump is then at `/tmp/bagheera-restore/bagheera.pgdump`. (`age` is also
   in the container, if you accept putting the private key there.)

3. **Load the dump into Postgres.**
   Against a fresh/scratch database (never the live one directly — restore
   to a scratch DB first, verify, then swap). Use the path from step 2:

   ```sh
   createdb bagheera_restore
   pg_restore -d bagheera_restore --no-owner <path-to-bagheera.pgdump>
   ```

4. **Reconcile passkeys with the live database.** Do this before cut-over,
   while the live database is still readable, with the API stopped (on the
   deploy host, not in the backup container:
   `docker stop "$(docker ps -q --filter label=uncloud.service.name=api)"`)
   so live can't change under you. If the live database is lost, see "Live database lost" below
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

   Keep the two CSVs until step 6 and any recovery below are done; step 7
   deletes them.

5. **Verify, then cut over.** Once `bagheera_restore` looks right (row
   counts, spot-checked rows), swap it in for the live database using
   your normal maintenance-window process.

6. **Flush sessions, then tell members.** Sessions live in Valkey, which the
   restore doesn't touch, so sessions opened after the snapshot (including
   any opened with a since-removed passkey) would otherwise outlive it.
   Before starting the API again, delete every session and per-member
   session set (on the deploy host) — only those: `FLUSHALL` would also drop queued emails and
   rate-limit lockouts.

   ```sh
   docker exec "$(docker ps -q --filter label=uncloud.service.name=valkey)" sh -c '
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

7. **Clean up.** Once step 6 and any recovery below are done, delete what the
   restore left in the backup container (the dump, decrypted, and the CSVs of
   live passkeys), from its shell:

   ```sh
   rm -rf /tmp/bagheera-restore
   ```

The backup's own tests (`make test-backup`) take a dump, push it to a restic
repository and read it back, and decrypt an emailed attachment into a valid
dump, but a full restore into a scratch database is worth rehearsing before you
need it.

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
