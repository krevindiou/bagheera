# Restoring from a backup

`scripts/backup.sh` pushes a `pg_dump` snapshot (custom format) plus any
archived WAL segments to a restic repository. To restore:

1. **Find the snapshot.**
   ```sh
   restic snapshots --tag postgres
   ```

2. **Restore the files.**
   ```sh
   restic restore <snapshot-id> --target /tmp/bagheera-restore
   ```
   This drops the `pg_dump` file (under a path like
   `/tmp/bagheera-backup-XXXXXX.pgdump`) and, if it was present at backup
   time, the WAL archive directory into `/tmp/bagheera-restore`.

3. **Load the dump into Postgres.**
   Against a fresh/scratch database (never the live one directly — restore
   to a scratch DB first, verify, then swap):
   ```sh
   createdb -U bagheera bagheera_restore
   pg_restore -U bagheera -d bagheera_restore --no-owner \
     /tmp/bagheera-restore/tmp/bagheera-backup-XXXXXX.pgdump
   ```

4. **Point-in-time recovery (optional).** If WAL segments were restored
   too and you need to replay past the dump's timestamp, configure a
   Postgres instance with `restore_command` reading from the restored WAL
   directory and a `recovery_target_time`, per Postgres's own PITR docs —
   the WAL segments are simply files restic gives back untouched.

5. **Verify, then cut over.** Once `bagheera_restore` looks right (row
   counts, spot-checked rows), swap it in for the live database using
   your normal maintenance-window process.

This procedure was run once end-to-end against a scratch database as part
of building the backup script: a real snapshot was created, restored, and
`pg_restore`'d into a fresh database, and its row counts were checked
against the original.
