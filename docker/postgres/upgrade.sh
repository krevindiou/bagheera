#!/usr/bin/env bash
# Upgrades a cluster of the previous major to this image's, before the server
# starts: pg_upgrade in copy mode into a temporary directory, which only
# becomes the new cluster, by a rename, once every step has succeeded. The old
# cluster is started and stopped, never deleted. Runs as the postgres user.

# No `set -u`: the official entrypoint's functions don't run under it.
set -Eeo pipefail

# Only defines functions when sourced.
# shellcheck source=/dev/null
. /usr/local/bin/docker-entrypoint.sh

root=/var/lib/postgresql
new=$root/$PG_MAJOR/docker
staging=$new.upgrading
old=$root/$PG_PREVIOUS_MAJOR/docker
old_bin=/usr/libexec/postgresql$PG_PREVIOUS_MAJOR
new_bin=/usr/local/bin

log() {
  printf 'postgres-upgrade: %s\n' "$*"
}

step() {
  log "step: $1"
}

has_cluster() {
  [ -s "$1/PG_VERSION" ]
}

# old_control <field>: a field of the old cluster's pg_controldata.
old_control() {
  LC_ALL=C "$old_bin/pg_controldata" "$old" | sed -n "s/^$1: *//p"
}

upgrade() {
  # A slow disk can need more than pg_ctl's default minute for a recovery.
  export PGCTLTIMEOUT=300
  export PGPASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"

  step 'remove leftovers'
  rm -rf "$staging"

  # Always started once, even if it was shut down cleanly: its encoding and
  # locale can only be read from a running server. An unclean one recovers here,
  # which pg_upgrade requires.
  step 'read old cluster'
  local socket settings encoding provider collate ctype locale checksums
  socket=$(mktemp -d)
  "$old_bin/pg_ctl" -D "$old" -o "-c listen_addresses='' -c unix_socket_directories='$socket'" -w start
  settings=$(psql -h "$socket" -U "$POSTGRES_USER" -d template1 -v ON_ERROR_STOP=1 -XAtF '|' -c \
    "select pg_encoding_to_char(encoding), datlocprovider, datcollate, datctype, coalesce(datlocale, '') from pg_database where datname = 'template0'")
  "$old_bin/pg_ctl" -D "$old" -m fast -w stop
  IFS='|' read -r encoding provider collate ctype locale <<<"$settings"
  checksums=--data-checksums
  if [ "$(old_control 'Data page checksum version')" = 0 ]; then
    checksums=--no-data-checksums
  fi

  step 'initialise'
  local initdb_args=(--encoding="$encoding" --lc-collate="$collate" --lc-ctype="$ctype" "$checksums")
  case $provider in
    c) initdb_args+=(--locale-provider=libc) ;;
    b) initdb_args+=(--locale-provider=builtin --builtin-locale="$locale") ;;
    i) initdb_args+=(--locale-provider=icu --icu-locale="$locale") ;;
    *)
      log "unknown locale provider [$provider]"
      return 1
      ;;
  esac
  # The official entrypoint's functions work on PGDATA.
  export PGDATA=$staging
  mkdir -p "$staging"
  chmod 700 "$staging"
  docker_init_database_dir "${initdb_args[@]}"
  pg_setup_hba_conf postgres

  # pg_upgrade writes its files, and puts its sockets, in the current directory.
  local work
  work=$(mktemp -d)
  cd "$work"
  local upgrade_args=(--old-bindir "$old_bin" --new-bindir "$new_bin" --old-datadir "$old" --new-datadir "$staging"
    --username "$POSTGRES_USER" --socketdir "$work")
  step 'check'
  "$new_bin/pg_upgrade" "${upgrade_args[@]}" --check
  step 'upgrade'
  "$new_bin/pg_upgrade" "${upgrade_args[@]}"

  # A private socket directory: the health check must not reach this server.
  step 'finish'
  docker_temp_server_start postgres -c unix_socket_directories="$work"
  if [ -f "$work/update_extensions.sql" ]; then
    psql -h "$work" -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -X -f "$work/update_extensions.sql"
  fi
  vacuumdb -h "$work" -U "$POSTGRES_USER" --all --analyze-in-stages --missing-stats-only
  docker_temp_server_stop

  # Read now: pg_upgrade starts and stops the old server itself.
  step 'record'
  local checkpoint
  checkpoint=$(old_control 'Latest checkpoint location')
  [ -n "$checkpoint" ]
  printf '%s %s\n' "$PG_PREVIOUS_MAJOR" "$checkpoint" >"$staging/bagheera_upgraded_from"

  # The rename is what makes the upgrade count.
  step 'publish'
  if [ -e "$new" ]; then
    rmdir "$new"
  fi
  sync
  mv "$staging" "$new"
  sync
  log "upgrade from $PG_PREVIOUS_MAJOR to $PG_MAJOR complete"
}

main() {
  docker_setup_env
  # Only the image's own layout is upgraded.
  [ "$PGDATA" = "$new" ] || return 0
  if ! has_cluster "$new" && has_cluster "$old"; then
    upgrade
  fi
}

main
