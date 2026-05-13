#!/usr/bin/env bash

# bash /mnt/c/Users/matte/Documents/software/3000tech/website/ops/start-dev-docker.sh

set -euo pipefail

PROJECT="/mnt/c/Users/matte/Documents/software/3000tech/website"
RUN="/mnt/c/Users/matte/Documents/software/personal/dev-tools/docker/node/run.sh"

cd "$PROJECT"
# Default label; overridden if launcher passes --label
if [[ ! " $* " =~ " --label " ]]; then
  set -- --label 3000tech "$@"
fi

# Open Chrome on localhost:5173 once the dev server responds (runs parallel to blocking docker run)
(
  for _ in {1..30}; do
    curl -sf http://localhost:5173 >/dev/null 2>&1 && break
    sleep 1
  done
  cmd.exe /c start chrome http://localhost:5173 >/dev/null 2>&1
) &
disown 2>/dev/null || true

bash "$RUN" --port 5173 "$@"
