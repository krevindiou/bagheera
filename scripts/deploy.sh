#!/usr/bin/env bash
# Manual production deploy: rolls the images the Release workflow pushed to
# GitHub Container Registry out to the Uncloud cluster, over SSH, with the local `uc` CLI
# (https://uncloud.run/docs/getting-started/install-cli).
#
# Usage: scripts/deploy.sh [<version>] [uc deploy flags...]
#   <version>  a released version as the Release workflow tagged its images
#              (x.y.z; a leading v, as in the git tag, is dropped); an older
#              one rolls back. Defaults to the latest release tag on `origin`.
#
# Settings: docker/prod.env (git-ignored, see docker/prod.env.example), a
# shell file sourced here; anything already in the environment is used when
# the file doesn't set it. The cluster is whatever `uc` points at: its
# current context, or UNCLOUD_CONTEXT / UNCLOUD_CONNECT.
set -euo pipefail

cd "$(dirname "$0")/.."

version='[0-9]+\.[0-9]+\.[0-9]+'

# Anything that isn't a version is left for `uc deploy`, e.g. `-y` or service names.
if [[ "${1:-}" =~ ^v?$version$ ]]; then
	tag="${1#v}"
	shift
else
	# Asks the remote, not the local tags, which may not be fetched yet. Other
	# tags starting with v (v2-beta) are skipped.
	tags=$(git ls-remote --tags --refs --sort=-v:refname origin 'v*' | grep -E "refs/tags/v$version$" || true)
	if [ -z "$tags" ]; then
		echo "no release tag on origin: pass a version, or merge a release PR first" >&2
		exit 1
	fi
	tag="${tags%%$'\n'*}"
	tag="${tag##*refs/tags/v}"
	echo "Deploying the latest release, $tag"
fi

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
: "${IMAGE_NAMESPACE:?set IMAGE_NAMESPACE in docker/prod.env}"

# All images must exist for the tag: a publish cancelled halfway leaves some,
# and rolling out only those would pair them with the previous release.
for image in bagheera-api bagheera-web bagheera-backup bagheera-postgres; do
	if ! docker manifest inspect "$IMAGE_NAMESPACE/$image:$tag" >/dev/null 2>&1; then
		echo "$IMAGE_NAMESPACE/$image:$tag is not published, or not public: wait for the Release workflow, make the package public (docs/deploying.md), or pick another version" >&2
		exit 1
	fi
done

# Uncloud leaves a container that failed to turn healthy behind, stopped. With a
# second postgres container around, the next deploy may start the new one without
# stopping the running one: two servers on one volume. At most one may exist.
containers=$(uc ps)
postgres=$(awk '$1 == "postgres"' <<<"$containers")
if [ "$(grep -c . <<<"$postgres")" -gt 1 ]; then
	{
		echo "more than one postgres container exists:"
		echo "$postgres"
		echo "remove those that are not Up, on their host: ssh <user>@<host> docker rm <container id>"
		echo "then deploy again (docs/deploying.md, \"Postgres major upgrades\")"
	} >&2
	exit 1
fi

export TAG="$tag"
exec uc deploy -f docker/compose.prod.yml "$@"
