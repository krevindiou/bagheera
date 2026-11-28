#!/usr/bin/env bash
# `make test-backup`: builds the backup image, starts a throwaway Postgres and
# Mailpit on a private network, runs run.sh in the image against them, and
# removes everything. Only the docker CLI runs on the host. The service images
# are pinned by digest where Renovate keeps them current: Postgres as the
# backup image's base, Mailpit in docker/compose.yml.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."

# pinned_image <name> <file>: the digest-pinned reference of <name> in <file>.
pinned_image() {
  local ref
  ref=$(grep -m1 -oE "$1:[^[:space:]'\"]+@sha256:[0-9a-f]{64}" "$2") || {
    echo "no digest-pinned $1 image in $2" >&2
    return 1
  }
  printf '%s\n' "$ref"
}

POSTGRES_IMAGE=$(pinned_image postgres docker/Dockerfile.backup)
MAILPIT_IMAGE=$(pinned_image axllent/mailpit docker/compose.yml)
NAME=bagheera-backup-test-$$
IMAGE=bagheera-backup:test

# shellcheck disable=SC2317,SC2329 # run by the EXIT trap below
cleanup() {
  docker rm -f -v "$NAME-postgres" "$NAME-mailpit" >/dev/null 2>&1 || true
  docker network rm "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# wait_ready <container> <command...>: runs the command in the container until it succeeds.
wait_ready() {
  local container=$1
  shift
  for _ in $(seq 1 60); do
    if docker exec "$container" "$@" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "$container did not become ready" >&2
  docker logs "$container" >&2 || true
  return 1
}

docker build -q -f docker/Dockerfile.backup -t "$IMAGE" . >/dev/null
docker network create "$NAME" >/dev/null

docker run -d --name "$NAME-postgres" --network "$NAME" --network-alias postgres \
  -e POSTGRES_USER=bagheera -e POSTGRES_DB=bagheera -e POSTGRES_PASSWORD=test \
  "$POSTGRES_IMAGE" >/dev/null
docker run -d --name "$NAME-mailpit" --network "$NAME" --network-alias mailpit \
  -e MP_SMTP_AUTH_ACCEPT_ANY=1 -e MP_SMTP_AUTH_ALLOW_INSECURE=1 \
  "$MAILPIT_IMAGE" >/dev/null

# Over TCP, which the temporary server of the initialisation never listens on:
# its socket answers before the server the tests connect to is up.
wait_ready "$NAME-postgres" pg_isready -h 127.0.0.1 -U bagheera -d bagheera
wait_ready "$NAME-mailpit" wget -qO- http://localhost:8025/readyz

# Not `bagheera`, the host name the backup pins its snapshots to: the tests of
# that need the two to differ.
status=0
docker run --rm --network "$NAME" --hostname backup-test --entrypoint bash \
  -e POSTGRES_PASSWORD=test -e MAILPIT_URL=http://mailpit:8025 \
  -v "$PWD/docker/backup/test:/tests:ro" \
  "$IMAGE" /tests/run.sh || status=$?
exit "$status"
