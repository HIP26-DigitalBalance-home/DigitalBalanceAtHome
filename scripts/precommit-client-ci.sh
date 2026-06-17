#!/usr/bin/env bash
# Mirrors the GitHub Actions "client-lint" job exactly, in a node:20 container
# (CI uses node 20 / npm 10). Running locally under a different node/npm version
# is what previously let package-lock drift slip past into a failing CI.
#
#   npm ci  ->  tsc --noEmit  ->  expo lint
#
# node_modules and the npm cache live in named Docker volumes, so the host's
# client/node_modules is never touched.
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker is not running. Start Docker Desktop and retry." >&2
  echo "  (To bypass for an emergency commit: git commit --no-verify — but CI will still run these checks.)" >&2
  exit 1
fi

REPO="$(git rev-parse --show-toplevel)"
echo "▶ client CI (node:20) — npm ci · tsc --noEmit · expo lint"
docker run --rm \
  -v "$REPO/client":/app \
  -v dbah-client-node-modules:/app/node_modules \
  -v dbah-npm-cache:/root/.npm \
  -e EXPO_NO_TELEMETRY=1 \
  -e CI=1 \
  -w /app \
  node:20 \
  bash -lc 'npm ci --no-audit --no-fund && npx tsc --noEmit && npx expo lint'
