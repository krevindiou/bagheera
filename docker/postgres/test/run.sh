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

# The official image of the previous major starts and still has the rows.
assert_old_still_serves() {
  start_old
  assert_eq 1000 "$(sql 'select count(*) from t')" "rows on 18"
  stop_server
}

assert_no_new_cluster() {
  in_volume 'test ! -e /var/lib/postgresql/19/docker/PG_VERSION' || fail "a 19 cluster exists"
}

assert_diverged_refusal() {
  assert_refuses
  assert_contains "$ASSERT_OUTPUT" 'changed since the upgrade' "message"
  assert_contains "$ASSERT_OUTPUT" 'remove /var/lib/postgresql/18/docker' "way out: keep 19"
  assert_contains "$ASSERT_OUTPUT" 'remove /var/lib/postgresql/19/docker' "way out: upgrade again"
}

# fake_cluster <dir> <major>
fake_cluster() {
  in_volume "mkdir -p $1 && echo $2 > $1/PG_VERSION"
}

test_leftover_upgrade_is_discarded() {
  new_volume
  seed_old
  in_volume 'mkdir -p /var/lib/postgresql/19/docker.upgrading && echo junk > /var/lib/postgresql/19/docker.upgrading/PG_VERSION && chown -R postgres /var/lib/postgresql/19'
  start_new
  assert_eq 1000 "$(sql 'select count(*) from t')" "rows"
}

# What an earlier start of the official 19 image can leave behind.
test_empty_target_directory_is_replaced() {
  new_volume
  seed_old
  in_volume 'mkdir -p /var/lib/postgresql/19/docker && chown postgres /var/lib/postgresql/19/docker'
  start_new
  assert_eq 1000 "$(sql 'select count(*) from t')" "rows"
}

test_failed_upgrade_leaves_18_usable() {
  new_volume
  seed_old
  start_old
  sql 'create database locked' >/dev/null
  sql 'alter database locked allow_connections false' >/dev/null
  stop_server
  assert_refuses
  assert_contains "$ASSERT_OUTPUT" "failed at step 'check'" "message"
  assert_contains "$ASSERT_OUTPUT" 'allow connections' "pg_upgrade's reason"
  assert_no_new_cluster
  assert_old_still_serves
}

# pg_upgrade echoes the statements that restore the roles into its logs. A
# stand-in leaves such a log and fails, which the real one can't be made to do
# at that point.
test_failure_logs_hide_password_verifiers() {
  new_volume
  seed_old
  # shellcheck disable=SC2016 # expanded in the container
  in_volume 'cat > /var/lib/postgresql/fake_pg_upgrade <<"EOF"
#!/bin/sh
while [ "$1" != --new-datadir ]; do shift; done
mkdir -p "$2/pg_upgrade_output.d/now/log"
printf "%s\n" "ALTER ROLE bagheera WITH LOGIN PASSWORD '\''SCRAM-SHA-256\$4096:salt\$stored:server'\'';" "marker line" > "$2/pg_upgrade_output.d/now/log/pg_upgrade_utility.log"
exit 1
EOF
chmod 755 /var/lib/postgresql/fake_pg_upgrade'
  local fake
  fake="$(docker volume inspect -f '{{.Mountpoint}}' "$VOL")/fake_pg_upgrade"
  assert_refuses -v "$fake:/usr/local/bin/pg_upgrade:ro"
  assert_contains "$ASSERT_OUTPUT" 'marker line' "the log is printed"
  assert_contains "$ASSERT_OUTPUT" "PASSWORD '[redacted]'" "the verifier is replaced"
  case $ASSERT_OUTPUT in
    *SCRAM-SHA-256*) fail "a password verifier reached the logs: $ASSERT_OUTPUT" ;;
  esac
}

test_wrong_superuser_leaves_18_usable() {
  new_volume
  seed_old
  assert_refuses -e POSTGRES_USER=someone
  assert_contains "$ASSERT_OUTPUT" "failed at step 'read old cluster'" "message"
  assert_contains "$(in_volume '/usr/libexec/postgresql18/pg_controldata /var/lib/postgresql/18/docker')" 'shut down' "old cluster stopped cleanly"
  assert_no_new_cluster
  assert_old_still_serves
}

test_unclean_18_upgrades() {
  new_volume
  seed_old
  start_old
  sql "insert into t values ('late')" >/dev/null
  kill_server
  start_new
  assert_eq 1001 "$(sql 'select count(*) from t')" "rows"
}

test_write_to_18_after_upgrade_refuses() {
  new_volume
  seed_old
  start_new
  stop_server
  start_old
  sql "insert into t values ('rollback')" >/dev/null
  stop_server
  assert_diverged_refusal
  # Both ways out work.
  in_volume 'rm -rf /var/lib/postgresql/19/docker'
  start_new
  assert_eq 1001 "$(sql 'select count(*) from t')" "upgraded again"
  stop_server
  in_volume 'rm -rf /var/lib/postgresql/18/docker'
  start_new
  assert_eq 1001 "$(sql 'select count(*) from t')" "kept 19"
}

# Killed before any checkpoint: only the cluster state shows 18 ran again.
test_killed_18_after_upgrade_refuses() {
  new_volume
  seed_old
  start_new
  stop_server
  start_old
  kill_server
  assert_diverged_refusal
}

test_19_without_record_beside_18_refuses() {
  new_volume
  seed_old
  start_new
  stop_server
  in_volume 'rm /var/lib/postgresql/19/docker/bagheera_upgraded_from'
  assert_diverged_refusal
}

test_unsupported_old_major_refuses() {
  local dir
  for dir in /var/lib/postgresql/17/docker /var/lib/postgresql/data; do
    new_volume
    fake_cluster "$dir" 17
    assert_refuses
    assert_contains "$ASSERT_OUTPUT" "found a cluster in $dir" "message"
    assert_no_new_cluster
  done
}

test_newer_major_refuses() {
  new_volume
  seed_old
  fake_cluster /var/lib/postgresql/20/docker 20
  assert_refuses
  assert_contains "$ASSERT_OUTPUT" 'found a cluster in /var/lib/postgresql/20/docker' "message"
  assert_no_new_cluster
}

test_non_empty_target_is_not_deleted() {
  new_volume
  seed_old
  in_volume 'mkdir -p /var/lib/postgresql/19/docker && echo keep > /var/lib/postgresql/19/docker/file'
  assert_refuses
  assert_eq keep "$(in_volume 'cat /var/lib/postgresql/19/docker/file')" "file kept"
}

test_low_disk_space_refuses() {
  new_volume --driver local --opt type=tmpfs --opt device=tmpfs --opt o=size=400m
  # A tmpfs volume empties when its last container stops: hold it mounted.
  docker run -d --name "$C-holder" -v "$VOL:/v" --entrypoint sleep "$IMAGE" 600 >/dev/null
  seed_old
  # Leaves as much free as the old cluster uses: half of what is required.
  # shellcheck disable=SC2016 # expanded in the container
  docker exec "$C-holder" sh -c 'used=$(du -sk /v/18/docker | cut -f1); free=$(df -Pk /v | awk "NR==2{print \$4}"); dd if=/dev/zero of=/v/filler bs=1k count=$((free - used)) status=none'
  assert_refuses
  assert_contains "$ASSERT_OUTPUT" 'not enough free space' "message"
  in_volume 'test ! -e /var/lib/postgresql/19/docker.upgrading' || fail "wrote before refusing"
  assert_no_new_cluster
}

run_tests
