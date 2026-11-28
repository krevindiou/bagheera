#!/usr/bin/env bash
# Runs the upgrade step before a server start, then hands over to the official
# entrypoint with the same arguments.
set -Eeo pipefail

# Only defines functions when sourced; _pg_want_help is one of them.
# shellcheck source=/dev/null
. /usr/local/bin/docker-entrypoint.sh

if { [ "${1:-}" = postgres ] || [[ "${1:-}" == -* ]]; } && ! _pg_want_help "$@"; then
  # One container at a time on the volume: an upgrade's servers listen on no
  # network, and another container's postmaster.pid can look stale. The lock is
  # on the volume's root itself, which the postgres user can't swap for a link.
  # Everything run from here inherits descriptor 9, so it is held until the
  # server stops.
  exec 9</var/lib/postgresql
  if ! flock -n 9; then
    printf 'postgres-upgrade: refusing to start: %s\n' \
      'another container holds the data volume; stop it first, two servers on one volume would corrupt it' >&2
    exit 1
  fi
  upgrade=(bagheera-upgrade)
  if [ "$(id -u)" = 0 ]; then
    mkdir -p "/var/lib/postgresql/$PG_MAJOR"
    # -h: a link at that path (the postgres user can create one) is changed
    # itself, never what it points at.
    chown -h postgres:postgres "/var/lib/postgresql/$PG_MAJOR"
    # As the official entrypoint does: *_FILE secrets are read while still root.
    docker_setup_env
    upgrade=(su-exec postgres bagheera-upgrade)
  fi
  # A child, not exec: PID 1 has to stay root's, so that a postmaster.pid left
  # by a killed container, which names PID 1, is recognised as stale. In its own
  # process group and in the background, so that a stop reaches it and all it
  # runs. SIGTERM, whatever was received: a background job ignores SIGINT.
  stopped=
  child=
  forward_stop() {
    [ -n "$child" ] || return 0
    # The child alone while setsid has not made its group yet.
    kill -TERM -- "-$child" 2>/dev/null || kill -TERM "$child" 2>/dev/null || true
  }
  trap 'stopped=1; forward_stop' INT TERM
  setsid "${upgrade[@]}" &
  child=$!
  # A stop that came before the child was known.
  [ -z "$stopped" ] || forward_stop
  while true; do
    status=0
    wait "$child" || status=$?
    # A trapped signal ends the wait before the child does.
    kill -0 "$child" 2>/dev/null || break
  done
  trap - INT TERM
  if [ -n "$stopped" ]; then
    exit 1
  fi
  if [ "$status" -ne 0 ]; then
    exit "$status"
  fi
fi

exec docker-entrypoint.sh "$@"
