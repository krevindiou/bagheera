#!/bin/sh
# Derives the Content-Security-Policy's Sentry origin (scheme://host) from
# SENTRY_DSN, so a deployment sets one variable. Caddy can't capture a
# regex group into a placeholder, hence this script.
set -eu

if [ -n "${SENTRY_DSN:-}" ]; then
	SENTRY_INGEST_ORIGIN=$(printf '%s' "$SENTRY_DSN" | sed -n 's#^\(https://\)[^@/]*@\([^/]*\)/.*#\1\2#p')
	export SENTRY_INGEST_ORIGIN
fi

exec "$@"
