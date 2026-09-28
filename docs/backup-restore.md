# Restoring from a backup

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
