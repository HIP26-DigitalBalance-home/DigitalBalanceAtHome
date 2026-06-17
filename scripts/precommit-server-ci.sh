#!/usr/bin/env bash
# Mirrors the GitHub Actions "server-lint" + "server-test" jobs, in a
# python:3.12 container (matching CI):
#
#   ruff check  ->  ruff format --check  ->  mypy  ->  pytest
#
# The virtualenv and pip cache live in named Docker volumes, so dependency
# install is only slow on the first run. Generated caches (.ruff_cache,
# .pytest_cache, .mypy_cache, *.egg-info, htmlcov) are git-ignored.
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker is not running. Start Docker Desktop and retry." >&2
  echo "  (To bypass for an emergency commit: git commit --no-verify — but CI will still run these checks.)" >&2
  exit 1
fi

REPO="$(git rev-parse --show-toplevel)"
echo "▶ server CI (python:3.12) — ruff check · ruff format --check · mypy · pytest"
docker run --rm \
  -v "$REPO/server":/app \
  -v dbah-server-venv:/opt/venv \
  -v dbah-pip-cache:/root/.cache/pip \
  -w /app \
  python:3.12 \
  bash -lc '
    python -m venv /opt/venv >/dev/null 2>&1 || true
    . /opt/venv/bin/activate
    pip install -q -e ".[dev]"
    ruff check app/ tests/
    ruff format --check app/ tests/
    mypy app/
    pytest
  '
