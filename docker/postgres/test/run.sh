#!/usr/bin/env bash
# `make test-postgres`: builds the postgres image and runs the upgrade tests
# against throwaway volumes of the previous major. Only the docker CLI runs on
# the host.
# The test_* functions are run by name by the runner loop: ShellCheck sees them
# as never called (SC2329 since 0.11.0, SC2317 before it). new_volume's
# arguments are optional, not the caller's "$@" (SC2119).
# shellcheck disable=SC2119,SC2317,SC2329
# shellcheck source-path=SCRIPTDIR
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."

IMAGE=bagheera-postgres:test
# The official image of the previous major: the one production ran before.
OLD_IMAGE=postgres:18-alpine@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71

# shellcheck source=helpers.sh
. docker/postgres/test/helpers.sh

docker build -q -f docker/Dockerfile.postgres -t "$IMAGE" . >/dev/null

# Fails when a major bump of the base image leaves the previous major behind.
test_previous_major_is_one_behind() {
  # shellcheck disable=SC2016 # expanded in the container
  assert_eq 1 "$(docker run --rm --entrypoint sh "$IMAGE" -c 'echo $((PG_MAJOR - PG_PREVIOUS_MAJOR))')" "major gap"
}

test_upgrade_keeps_data_and_password_login() {
  new_volume
  seed_old
  start_new
  assert_eq 19 "$(sql 'show server_version_num' | cut -c1-2)" "server major"
  assert_eq 1000 "$(sql 'select count(*) from t')" "rows"
  assert_eq t_trgm "$(sql "select indexname from pg_indexes where tablename = 't'")" "index"
  local login=(docker run --rm --network "$NET" -e PGPASSWORD=secret "$IMAGE"
    psql -h postgres -U bagheera -d bagheera -XAtc 'select 1')
  assert_eq 1 "$("${login[@]}")" "password login over the network"
  login[6]=PGPASSWORD=wrong
  ! "${login[@]}" >/dev/null 2>&1 || fail "a wrong password was accepted"
  in_volume 'test -s /var/lib/postgresql/18/docker/PG_VERSION' || fail "the old cluster is gone"
  in_volume 'test ! -e /var/lib/postgresql/19/docker.upgrading' || fail "temporary directory left"
}

test_second_start_changes_nothing() {
  new_volume
  seed_old
  start_new
  stop_server
  local state='cat /var/lib/postgresql/19/docker/bagheera_upgraded_from; pg_controldata /var/lib/postgresql/19/docker | grep "system identifier"'
  local before
  before=$(in_volume "$state")
  start_new
  assert_eq "$before" "$(in_volume "$state")" "record and cluster identity"
  # Not piped into grep -q: with pipefail, its early exit would hide a match.
  case $(docker logs "$C" 2>&1) in
    *'postgres-upgrade: step:'*) fail "an upgrade ran again" ;;
  esac
}

test_empty_volume_initialises() {
  new_volume
  start_new
  assert_eq 19 "$(sql 'show server_version_num' | cut -c1-2)" "server major"
  in_volume 'test ! -e /var/lib/postgresql/19/docker/bagheera_upgraded_from' || fail "recorded an upgrade"
}

test_locale_and_checksums_are_preserved() {
  new_volume
  seed_old -e 'POSTGRES_INITDB_ARGS=--locale-provider=builtin --builtin-locale=C.UTF-8 --no-data-checksums'
  start_new
  assert_eq 'b|C.UTF-8' "$(sql "select datlocprovider, datlocale from pg_database where datname = 'template0'")" "locale"
  assert_eq off "$(sql 'show data_checksums')" "checksums"
}

# The deployment's health check is this pg_isready, over the default socket: it
# must not answer before the server that stays up does.
test_healthcheck_waits_for_the_final_server() {
  new_volume
  seed_old
  docker run -d --name "$C" "${SERVER_ENV[@]}" -v "$VOL:/var/lib/postgresql" "$IMAGE" >/dev/null
  local ready=
  for _ in $(seq 1 1200); do
    if docker exec "$C" pg_isready -U bagheera -d bagheera >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 0.1
  done
  [ -n "$ready" ] || fail "never ready: $(docker logs "$C" 2>&1)"
  assert_contains "$(docker logs "$C" 2>&1)" 'upgrade from 18 to 19 complete' "logs at first readiness"
}

# The volume is writable by the postgres user, so root must not hand over
# whatever a link planted there points at.
test_a_linked_major_directory_is_not_followed() {
  new_volume
  in_volume 'mkdir /var/lib/postgresql/victim && su-exec postgres ln -s victim /var/lib/postgresql/19'
  docker run -d --name "$C" "${SERVER_ENV[@]}" -v "$VOL:/var/lib/postgresql" "$IMAGE" >/dev/null
  wait_ready
  assert_eq root "$(in_volume 'stat -c %U /var/lib/postgresql/victim')" "owner of the link's target"
}

test_another_command_does_not_upgrade() {
  new_volume
  seed_old
  docker run --rm -v "$VOL:/var/lib/postgresql" "$IMAGE" psql --version >/dev/null
  in_volume 'test ! -e /var/lib/postgresql/19/docker' || fail "upgraded for a non-server command"
}

run_tests
