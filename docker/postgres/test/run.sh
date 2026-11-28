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

# After a later upgrade, going back to this image: its own cluster is the stale
# one.
test_newer_major_beside_the_own_cluster_refuses() {
  new_volume
  start_new
  stop_server
  fake_cluster /var/lib/postgresql/20/docker 20
  assert_refuses
  assert_contains "$ASSERT_OUTPUT" 'found a cluster in /var/lib/postgresql/20/docker' "message"
}

test_non_empty_target_is_not_deleted() {
  new_volume
  seed_old
  in_volume 'mkdir -p /var/lib/postgresql/19/docker && echo keep > /var/lib/postgresql/19/docker/file'
  assert_refuses
  assert_contains "$ASSERT_OUTPUT" '/var/lib/postgresql/19/docker holds files but no cluster' "message"
  case $ASSERT_OUTPUT in
    *'postgres-upgrade: step:'*) fail "refused only after starting the upgrade: $ASSERT_OUTPUT" ;;
  esac
  assert_eq keep "$(in_volume 'cat /var/lib/postgresql/19/docker/file')" "file kept"
  in_volume 'test ! -e /var/lib/postgresql/19/docker.upgrading' || fail "wrote before refusing"
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

# Uncloud can leave the previous container running while it starts the new one:
# two servers on one volume would corrupt it.
test_a_running_server_blocks_the_start() {
  new_volume
  seed_old
  start_old
  local status=0 output
  output=$(timeout 60 docker run --name "$C-holder" --network "$NET" --network-alias postgres \
    "${SERVER_ENV[@]}" -v "$VOL:/var/lib/postgresql" "$IMAGE" 2>&1) || status=$?
  [ "$status" -ne 124 ] || fail "started beside the running server: $output"
  [ "$status" -ne 0 ] || fail "did not refuse: $output"
  assert_contains "$output" "a server already answers at 'postgres'" "message"
  in_volume 'test ! -e /var/lib/postgresql/19/docker && test ! -e /var/lib/postgresql/19/docker.upgrading' || fail "wrote to the volume"
  assert_eq 1000 "$(sql 'select count(*) from t')" "the running server still serves"
}

# wait_for_log <text>
wait_for_log() {
  for _ in $(seq 1 600); do
    case $(docker logs "$C" 2>&1) in
      *"$1"*) return 0 ;;
    esac
    sleep 0.1
  done
  fail "[$1] never logged: $(docker logs "$C" 2>&1)"
}

# assert_volume_is_held: a second container on the volume, which the first can't
# be reached from over the network, refuses to start.
assert_volume_is_held() {
  local status=0 output
  output=$(timeout 60 docker run --name "$C-holder" "${SERVER_ENV[@]}" \
    -v "$VOL:/var/lib/postgresql" "$IMAGE" 2>&1) || status=$?
  docker rm -f -v "$C-holder" >/dev/null 2>&1 || true
  [ "$status" -ne 124 ] || fail "started beside the other container: $output"
  [ "$status" -ne 0 ] || fail "did not refuse: $output"
  assert_contains "$output" 'another container holds the data volume' "message"
}

# An upgrade's servers listen on no network: only a lock shows it is running.
test_a_second_container_during_an_upgrade_refuses() {
  new_volume
  seed_old
  in_volume 'printf "#!/bin/sh\necho stand-in running\nsleep 600\n" > /var/lib/postgresql/fake_pg_upgrade
chmod 755 /var/lib/postgresql/fake_pg_upgrade'
  local fake
  fake="$(docker volume inspect -f '{{.Mountpoint}}' "$VOL")/fake_pg_upgrade"
  docker run -d --name "$C" "${SERVER_ENV[@]}" -v "$VOL:/var/lib/postgresql" \
    -v "$fake:/usr/local/bin/pg_upgrade:ro" "$IMAGE" >/dev/null
  wait_for_log 'stand-in running'
  assert_volume_is_held
  in_volume 'test -e /var/lib/postgresql/19/docker.upgrading/PG_VERSION' || fail "the running upgrade's directory was removed"
}

test_a_second_container_beside_a_running_server_refuses() {
  new_volume
  start_new
  assert_volume_is_held
  assert_eq 1 "$(sql 'select 1')" "the running server still serves"
  stop_server
  start_new
}

# A stand-in setsid that never makes the process group: the moment between the
# launch of the upgrade and the group's creation, held open.
test_a_stop_before_the_upgrade_has_its_process_group_is_obeyed() {
  new_volume
  in_volume 'printf "#!/bin/sh\necho stand-in running\nsleep 600\n" > /var/lib/postgresql/fake_setsid
chmod 755 /var/lib/postgresql/fake_setsid'
  local fake
  fake="$(docker volume inspect -f '{{.Mountpoint}}' "$VOL")/fake_setsid"
  docker run -d --name "$C" "${SERVER_ENV[@]}" -v "$VOL:/var/lib/postgresql" \
    -v "$fake:/usr/local/bin/setsid:ro" "$IMAGE" >/dev/null
  wait_for_log 'stand-in running'
  local started=$SECONDS
  docker stop -t 60 "$C" >/dev/null
  [ $((SECONDS - started)) -lt 30 ] || fail "the stop was lost: killed after the grace period"
  assert_eq 1 "$(docker inspect -f '{{.State.ExitCode}}' "$C")" "exit code"
}

# As with the official image, a secret only root can read works.
test_a_root_only_password_file_is_read() {
  new_volume
  seed_old
  in_volume 'echo secret > /var/lib/postgresql/password && chmod 400 /var/lib/postgresql/password'
  docker run -d --name "$C" -e POSTGRES_USER=bagheera -e POSTGRES_DB=bagheera \
    -e POSTGRES_PASSWORD_FILE=/var/lib/postgresql/password \
    -v "$VOL:/var/lib/postgresql" "$IMAGE" >/dev/null
  wait_ready
  assert_eq 1000 "$(sql 'select count(*) from t')" "rows"
}

# A stop during an upgrade reaches it: the servers it runs shut down cleanly
# instead of being killed once the grace period ends. A stand-in pg_upgrade
# starts the old server, as the real one does, and hangs.
test_a_stop_during_an_upgrade_shuts_down_cleanly() {
  new_volume
  seed_old
  in_volume 'cat > /var/lib/postgresql/fake_pg_upgrade <<"EOF"
#!/bin/sh
/usr/libexec/postgresql18/pg_ctl -D /var/lib/postgresql/18/docker -o "-c listen_addresses= -c unix_socket_directories=/tmp" -w start
echo "stand-in running"
sleep 600
EOF
chmod 755 /var/lib/postgresql/fake_pg_upgrade'
  local fake
  fake="$(docker volume inspect -f '{{.Mountpoint}}' "$VOL")/fake_pg_upgrade"
  docker run -d --name "$C" "${SERVER_ENV[@]}" -v "$VOL:/var/lib/postgresql" \
    -v "$fake:/usr/local/bin/pg_upgrade:ro" "$IMAGE" >/dev/null
  wait_for_log 'stand-in running'
  local started=$SECONDS
  docker stop -t 60 "$C" >/dev/null
  [ $((SECONDS - started)) -lt 30 ] || fail "the stop was ignored: killed after the grace period"
  assert_eq 1 "$(docker inspect -f '{{.State.ExitCode}}' "$C")" "exit code"
  assert_contains "$(docker logs "$C" 2>&1)" "failed at step 'check'" "message"
  docker rm -v "$C" >/dev/null
  assert_contains "$(in_volume '/usr/libexec/postgresql18/pg_controldata /var/lib/postgresql/18/docker')" 'shut down' "old cluster stopped cleanly"
  assert_no_new_cluster
  start_new
  assert_eq 1000 "$(sql 'select count(*) from t')" "the next start upgrades"
}

# run_deploy <uc ps output> [deploy flags...]: scripts/deploy.sh in a container
# with no network and no uc, with stand-ins for uc and docker.
run_deploy() {
  # shellcheck disable=SC2016 # expanded in the container
  local ps_output=$1
  shift
  docker run --rm --network none -e PS_OUTPUT="$ps_output" -e IMAGE_NAMESPACE=ghcr.io/example \
    -v "$PWD/scripts/deploy.sh:/repo/scripts/deploy.sh:ro" --entrypoint bash "$IMAGE" -c '
      mkdir /tmp/bin
      cat >/tmp/bin/uc <<"EOF"
#!/bin/sh
if [ "$1" = ps ]; then echo "RAN uc $*" >&2; printf "%s\n" "$PS_OUTPUT"; else echo "RAN uc $*"; fi
EOF
      printf "#!/bin/sh\nexit 0\n" >/tmp/bin/docker
      chmod +x /tmp/bin/uc /tmp/bin/docker
      PATH=/tmp/bin:$PATH /repo/scripts/deploy.sh 3.0.0 "$@"' deploy "$@"
}

# The shape of `uc ps`.
ps_others='SERVICE    CONTAINER ID   IMAGE            CREATED      STATUS                  HOOK         IP ADDRESS    MACHINE
api        60d11a41b098   example/api:1    2 days ago   Up 34 hours (healthy)                10.210.0.5    host
api        3f147b9380b1   example/api:1    2 days ago   Exited (0) 2 days ago   pre-deploy                 host'
ps_running='postgres   f0ffad99a989   postgres:18      2 days ago   Up 34 hours (healthy)                10.210.0.7    host'
ps_stopped='postgres   0badc0ffee00   postgres:19      1 hour ago   Exited (1) 1 hour ago                              host'

# Uncloud could start the new container without stopping the running one.
test_deploy_refuses_a_leftover_postgres_container() {
  local status=0 output
  output=$(run_deploy "$ps_others
$ps_stopped
$ps_running" 2>&1) || status=$?
  [ "$status" -ne 0 ] || fail "deployed: $output"
  assert_contains "$output" '0badc0ffee00' "the containers are listed"
  assert_contains "$output" 'docker rm' "how to remove one"
  case $output in
    *'RAN uc deploy'*) fail "uc deploy ran: $output" ;;
  esac
}

test_deploy_proceeds_with_at_most_one_postgres_container() {
  local rows output
  for rows in "$ps_running" "$ps_stopped" ""; do
    output=$(run_deploy "$ps_others
$rows" 2>&1) || fail "refused with [$rows]: $output"
    assert_contains "$output" 'RAN uc deploy' "uc deploy with [$rows]"
  done
}

# assert_checked_cluster <uc ps arguments> <deploy flags...>
assert_checked_cluster() {
  local expected=$1 output
  shift
  output=$(run_deploy "$ps_running" "$@" 2>&1) || fail "refused with [$*]: $output"
  assert_contains "$output" "RAN uc ps$expected
RAN uc deploy -f docker/compose.prod.yml $*" "uc ps for [$*]"
}

# The containers checked must be those of the cluster deployed to.
test_deploy_checks_the_cluster_it_deploys_to() {
  assert_checked_cluster '' -y api
  assert_checked_cluster ' --context prod' --context prod -y
  assert_checked_cluster ' -c prod' -y -c prod
  assert_checked_cluster ' -cprod' -cprod
  assert_checked_cluster ' -c prod' -yc prod
  assert_checked_cluster ' -cprod' -ycprod
  assert_checked_cluster ' --context=prod --connect=ssh://a@b' --context=prod --connect=ssh://a@b
  assert_checked_cluster ' --connect ssh://a@b --uncloud-config /tmp/c.yaml' --connect ssh://a@b --uncloud-config /tmp/c.yaml api
  assert_checked_cluster ' --uncloud-config=/tmp/c.yaml' --uncloud-config=/tmp/c.yaml
}

run_tests
