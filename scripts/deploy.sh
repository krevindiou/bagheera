#!/usr/bin/env bash
# Manual production deploy: rolls the images the CI publish job pushed to
# Docker Hub out to the Uncloud cluster, over SSH, with the local `uc` CLI
# (https://uncloud.run/docs/getting-started/install-cli).
#
# Usage: scripts/deploy.sh <tag> [uc deploy flags...]
#   <tag>  the git SHA of a green main build, as the publish job tagged it;
#          an older SHA rolls back.
#
# Settings: docker/prod.env (git-ignored, see docker/prod.env.example), a
# shell file sourced here; anything already in the environment is used when
# the file doesn't set it. The cluster is whatever `uc` points at: its
# current context, or UNCLOUD_CONTEXT / UNCLOUD_CONNECT.
set -euo pipefail

cd "$(dirname "$0")/.."

tag="${1:?usage: scripts/deploy.sh <tag> [uc deploy flags...]}"
shift

if ! command -v uc >/dev/null; then
	echo "uc is not installed: https://uncloud.run/docs/getting-started/install-cli" >&2
	exit 1
fi

if [ -f docker/prod.env ]; then
	set -a
	# shellcheck source=/dev/null
	. docker/prod.env
	set +a
fi
: "${DOCKERHUB_USERNAME:?set DOCKERHUB_USERNAME in docker/prod.env}"

# Both images must exist for the tag: a publish cancelled halfway leaves one,
# and rolling out only that one would pair it with the previous release.
for image in bagheera-api bagheera-web; do
	if ! docker manifest inspect "$DOCKERHUB_USERNAME/$image:$tag" >/dev/null 2>&1; then
		echo "$DOCKERHUB_USERNAME/$image:$tag is not on Docker Hub: wait for CI's publish job, or pick another tag" >&2
		exit 1
	fi
done

export TAG="$tag"
exec uc deploy -f docker/compose.prod.yml "$@"
