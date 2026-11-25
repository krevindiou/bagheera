#!/usr/bin/env bash
# Container entrypoint: validates the configuration, writes the SFTP material
# and the crontab, then becomes supercronic. `--prepare` stops before the last
# step (the tests use it to inspect what would run).
set -euo pipefail

# shellcheck source=lib.sh
. /usr/local/lib/backup/lib.sh

BACKUP_DIR=/tmp/backup
CRONTAB=$BACKUP_DIR/crontab

# Writes the key, the pinned host keys and an ssh config that never trusts an
# unknown host, under ~/.ssh where restic's `ssh` finds them.
write_sftp_material() {
  local ssh_dir=$HOME/.ssh
  mkdir -p "$ssh_dir"
  chmod 700 "$ssh_dir"
  # ssh refuses a key file without its final newline; printf adds it.
  printf '%s\n' "$BACKUP_SFTP_PRIVATE_KEY" >"$ssh_dir/id_backup"
  chmod 600 "$ssh_dir/id_backup"
  printf '%s\n' "$BACKUP_SFTP_KNOWN_HOSTS" >"$ssh_dir/known_hosts"
  cat >"$ssh_dir/config" <<EOF
Host *
  IdentityFile $ssh_dir/id_backup
  UserKnownHostsFile $ssh_dir/known_hosts
  StrictHostKeyChecking yes
  BatchMode yes
EOF
  log info "wrote the SFTP key and pinned host keys under $ssh_dir"
}

write_crontab() {
  mkdir -p "$BACKUP_DIR"
  {
    printf '%s backup-run\n' "$(cfg BACKUP_SCHEDULE '0 3 * * *')"
    if restic_enabled; then
      printf '30 4 * * 0 backup-check\n'
    fi
  } >"$CRONTAB"
}

main() {
  umask 077

  if backup_disabled; then
    log warn "BACKUP_DISABLED=true: no backup will run, the container only stays up"
    # Not `exec sleep`: as PID 1 it would ignore SIGTERM and `docker stop`
    # would wait for the kill timeout. bash runs the trap instead.
    sleep infinity &
    # The sleeper must not outlive the script, or it would hold its stdout open.
    # shellcheck disable=SC2064
    trap "kill $! 2>/dev/null; exit 0" TERM INT
    wait $!
    return
  fi

  backup-validate || exit 1

  if [ -n "${BACKUP_SFTP_PRIVATE_KEY:-}" ]; then
    write_sftp_material
  fi
  write_crontab

  if [ "${1:-}" = "--prepare" ]; then
    return 0
  fi

  log info "starting the scheduler"
  exec supercronic "$CRONTAB"
}

main "$@"
