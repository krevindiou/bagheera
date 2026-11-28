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
# The service's name in both Compose files, which resolves to its containers.
service=postgres

log() {
  printf 'postgres-upgrade: %s\n' "$*"
}

current_step=
# The pg_ctl and data directory of the temporary server running, if any.
running=()

step() {
  current_step=$1
  log "step: $1"
}

refuse() {
  log "refusing to start: $*" >&2
  exit 1
}

has_cluster() {
  [ -s "$1/PG_VERSION" ]
}

# old_control <field>: a field of the old cluster's pg_controldata.
old_control() {
  LC_ALL=C "$old_bin/pg_controldata" "$old" | sed -n "s/^$1: *//p"
}

# Fails the start if the old cluster ran after the upgrade, or no upgrade from
# it is recorded: serving the new one would then silently lose what the old one
# holds. A server that was killed keeps its checkpoint, but not its state.
check_unchanged() {
  local recorded='' state checkpoint
  if [ -f "$new/bagheera_upgraded_from" ]; then
    recorded=$(cat "$new/bagheera_upgraded_from")
  fi
  state=$(old_control 'Database cluster state')
  checkpoint=$(old_control 'Latest checkpoint location')
  if [ "$state" != 'shut down' ] || [ "$recorded" != "$PG_PREVIOUS_MAJOR $checkpoint" ]; then
    refuse "the $PG_PREVIOUS_MAJOR cluster in $old changed since the upgrade, or $new holds no record of one." \
      "To keep the $PG_MAJOR data, remove $old." \
      "To upgrade again from the $PG_PREVIOUS_MAJOR data, remove $new."
  fi
}

# Two servers on one volume corrupt it, and a deployment can start this
# container while the previous one still runs. This server doesn't listen yet,
# so an answer is another one's: 0 accepts connections, 1 rejects them.
refuse_a_running_server() {
  local status=0
  pg_isready -h "$service" -t 3 >/dev/null 2>&1 || status=$?
  if [ "$status" -le 1 ]; then
    refuse "a server already answers at '$service'; stop it first, two servers on one volume would corrupt it"
  fi
}

# refuse_clusters <newer|older>: fails if the volume holds a cluster of a major
# newer, or older, than this image's. The layouts from before major 18 count as
# older.
refuse_clusters() {
  local dir major found=()
  if [ "$1" = older ]; then
    for dir in "$root" "$root/data"; do
      if has_cluster "$dir"; then
        found+=("$dir")
      fi
    done
  fi
  for dir in "$root"/*/docker; do
    major=${dir%/docker}
    major=${major##*/}
    if [[ ! $major =~ ^[0-9]+$ ]] || ! has_cluster "$dir"; then
      continue
    fi
    if { [ "$1" = newer ] && [ "$major" -gt "$PG_MAJOR" ]; } ||
      { [ "$1" = older ] && [ "$major" -lt "$PG_MAJOR" ]; }; then
      found+=("$dir")
    fi
  done
  if [ "${#found[@]}" -gt 0 ]; then
    refuse "found a cluster in ${found[*]}; only an upgrade from $PG_PREVIOUS_MAJOR is supported"
  fi
}

# stop_if_running <bindir> <datadir>
stop_if_running() {
  if "$1/pg_ctl" -D "$2" status >/dev/null 2>&1; then
    "$1/pg_ctl" -D "$2" -m fast -w stop || true
  fi
}

# Leaves no temporary server behind, and reports a failed upgrade.
on_exit() {
  local status=$?
  if [ "${#running[@]}" -gt 0 ]; then
    "${running[0]}" -D "${running[1]}" -m fast -w stop || true
  fi
  # pg_upgrade starts and stops both servers itself, and leaves one running when
  # it is interrupted.
  if [ "$current_step" = check ] || [ "$current_step" = upgrade ]; then
    stop_if_running "$old_bin" "$old"
    stop_if_running "$new_bin" "$staging"
  fi
  if [ "$status" -ne 0 ]; then
    # pg_upgrade keeps its logs only when it fails. They echo the statements
    # that restore the roles, password verifiers included.
    if [ -d "$staging/pg_upgrade_output.d" ]; then
      find "$staging/pg_upgrade_output.d" -type f \( -name '*.log' -o -name '*.txt' \) \
        -exec tail -n +1 {} + | sed -E "s/(PASSWORD )'[^']*'/\1'[redacted]'/g" >&2 || true
    fi
    log "failed at step '$current_step'; the $PG_PREVIOUS_MAJOR data in $old is kept" >&2
  fi
}

upgrade() {
  trap on_exit EXIT
  # A stop from the entrypoint: leave through on_exit.
  trap 'exit 1' INT TERM
  # A slow disk can need more than pg_ctl's default minute for a recovery.
  export PGCTLTIMEOUT=300
  export PGPASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"

  step 'remove leftovers'
  rm -rf "$staging"

  # Copy mode needs room for a second cluster; twice that leaves a margin.
  step 'check free space'
  local used free
  used=$(du -sk "$old" | cut -f1)
  free=$(df -Pk "$root" | awk 'NR == 2 { print $4 }')
  if [ "$free" -lt $((used * 2)) ]; then
    log "not enough free space: $free kB free, $((used * 2)) kB needed" >&2
    return 1
  fi

  # Always started once, even if it was shut down cleanly: its encoding and
  # locale can only be read from a running server. An unclean one recovers here,
  # which pg_upgrade requires.
  step 'read old cluster'
  local socket settings encoding provider collate ctype locale checksums
  socket=$(mktemp -d)
  running=("$old_bin/pg_ctl" "$old")
  "$old_bin/pg_ctl" -D "$old" -o "-c listen_addresses='' -c unix_socket_directories='$socket'" -w start
  settings=$(psql -h "$socket" -U "$POSTGRES_USER" -d template1 -v ON_ERROR_STOP=1 -XAtF '|' -c \
    "select pg_encoding_to_char(encoding), datlocprovider, datcollate, datctype, coalesce(datlocale, '') from pg_database where datname = 'template0'")
  "$old_bin/pg_ctl" -D "$old" -m fast -w stop
  running=()
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
  running=("$new_bin/pg_ctl" "$staging")
  docker_temp_server_start postgres -c unix_socket_directories="$work"
  if [ -f "$work/update_extensions.sql" ]; then
    psql -h "$work" -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -X -f "$work/update_extensions.sql"
  fi
  vacuumdb -h "$work" -U "$POSTGRES_USER" --all --analyze-in-stages --missing-stats-only
  docker_temp_server_stop
  running=()

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
  refuse_a_running_server
  if has_cluster "$new"; then
    if has_cluster "$old"; then
      check_unchanged
    fi
    return 0
  fi
  # First: upgrading the old data beside a newer cluster would serve stale data.
  refuse_clusters newer
  if has_cluster "$old"; then
    upgrade
  else
    refuse_clusters older
  fi
}

main
