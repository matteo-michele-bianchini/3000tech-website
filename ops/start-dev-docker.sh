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
bash "$RUN" --port 3000 "$@"
