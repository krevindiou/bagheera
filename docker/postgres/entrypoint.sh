#!/usr/bin/env bash
# Runs the upgrade step before a server start, then hands over to the official
# entrypoint with the same arguments.
set -Eeo pipefail

# Only defines functions when sourced; _pg_want_help is one of them.
# shellcheck source=/dev/null
. /usr/local/bin/docker-entrypoint.sh

if { [ "${1:-}" = postgres ] || [[ "${1:-}" == -* ]]; } && ! _pg_want_help "$@"; then
  if [ "$(id -u)" = 0 ]; then
    mkdir -p "/var/lib/postgresql/$PG_MAJOR"
    # -h: a link at that path (the postgres user can create one) is changed
    # itself, never what it points at.
    chown -h postgres:postgres "/var/lib/postgresql/$PG_MAJOR"
    # A child, not exec: PID 1 has to stay root's, so that a postmaster.pid
    # left by a killed container, which names PID 1, is recognised as stale.
    su-exec postgres bagheera-upgrade
  else
    bagheera-upgrade
  fi
fi

exec docker-entrypoint.sh "$@"
