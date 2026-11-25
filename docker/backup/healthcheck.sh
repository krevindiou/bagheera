#!/usr/bin/env bash
# Container healthcheck: healthy while the scheduler runs. In disabled mode no
# scheduler runs by design, so the container is healthy as it stands.
set -euo pipefail

# shellcheck source=lib.sh
. /usr/local/lib/backup/lib.sh

backup_disabled || pgrep -x supercronic >/dev/null
