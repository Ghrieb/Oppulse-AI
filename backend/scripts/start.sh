#!/bin/sh
set -eu

uv run alembic upgrade head
exec uv run uvicorn app.main:app --host "${OPPULSE_HOST:-0.0.0.0}" --port "${OPPULSE_PORT:-8000}"
