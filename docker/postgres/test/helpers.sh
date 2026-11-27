#!/usr/bin/env bash
# Helpers for the postgres image's tests: each test gets its own volume,
# network and server container, removed when its subshell exits.
# The helpers are run by the test_* functions and the cleanup trap: ShellCheck
# sees some as never called (SC2329 since 0.11.0, SC2317 before it).
# shellcheck disable=SC2317,SC2329
# shellcheck source-path=SCRIPTDIR
set -euo pipefail

# fail, assert_eq, assert_contains and run_tests.
# shellcheck source=../../backup/test/helpers.sh
. "$(dirname "${BASH_SOURCE[0]}")/../../backup/test/helpers.sh"

# The images under test, set by the script that sources this file.
: "${IMAGE:?}" "${OLD_IMAGE:?}"

SERVER_ENV=(-e POSTGRES_USER=bagheera -e POSTGRES_DB=bagheera -e POSTGRES_PASSWORD=secret)
C=

cleanup() {
  [ -n "$C" ] || return 0
  docker rm -f -v "$C" "$C-holder" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  docker volume rm "$VOL" >/dev/null 2>&1 || true
}

# new_volume [docker volume create args]: sets VOL, C and NET for this test.
new_volume() {
  cleanup
  C=bagheera-postgres-test-$BASHPID-$RANDOM
  VOL=$C-data
  NET=$C-net
  trap cleanup EXIT
  docker volume create "$@" "$VOL" >/dev/null
  docker network create "$NET" >/dev/null
}

# Over TCP, which the temporary servers of an initialisation or an upgrade
# never listen on: only the final server answers.
wait_ready() {
  for _ in $(seq 1 240); do
    if docker exec "$C" pg_isready -h 127.0.0.1 -U bagheera -d bagheera >/dev/null 2>&1; then
      return 0
    fi
    [ "$(docker inspect -f '{{.State.Running}}' "$C")" = true ] || break
    sleep 0.5
  done
  fail "server not ready: $(docker logs "$C" 2>&1)"
}

# start_server <image> [docker run args]
start_server() {
  local image=$1
  shift
  docker run -d --name "$C" --network "$NET" --network-alias postgres "${SERVER_ENV[@]}" \
    -v "$VOL:/var/lib/postgresql" "$@" "$image" >/dev/null
  wait_ready
}

start_old() {
  start_server "$OLD_IMAGE" "$@"
}

start_new() {
  start_server "$IMAGE" "$@"
}

stop_server() {
  docker stop -t 60 "$C" >/dev/null
  docker rm -v "$C" >/dev/null
}

kill_server() {
  docker kill -s KILL "$C" >/dev/null
  docker rm -v "$C" >/dev/null
}

sql() {
  docker exec "$C" psql -U bagheera -d bagheera -v ON_ERROR_STOP=1 -XAtq -c "$1"
}

# A previous-major volume with an extension, rows and an index that uses it.
seed_old() {
  start_old "$@"
  sql 'create extension pg_trgm' >/dev/null
  sql 'create table t(name text)' >/dev/null
  sql 'insert into t select md5(i::text) from generate_series(1, 1000) i' >/dev/null
  sql 'create index t_trgm on t using gin (name gin_trgm_ops)' >/dev/null
  stop_server
}

# A one-off root shell on the volume, without the image's entrypoint.
in_volume() {
  docker run --rm -v "$VOL:/var/lib/postgresql" --entrypoint sh "$IMAGE" -c "$1"
}

# assert_refuses [docker run args]: the new image must exit with an error
# instead of serving; its output ends up in $ASSERT_OUTPUT.
assert_refuses() {
  local status=0
  ASSERT_OUTPUT=$(timeout 120 docker run --name "$C" "${SERVER_ENV[@]}" \
    -v "$VOL:/var/lib/postgresql" "$@" "$IMAGE" 2>&1) || status=$?
  docker rm -f -v "$C" >/dev/null 2>&1 || true
  [ "$status" -ne 124 ] || fail "still running after 120 s: $ASSERT_OUTPUT"
  [ "$status" -ne 0 ] || fail "the server exited successfully: $ASSERT_OUTPUT"
}
