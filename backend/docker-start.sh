#!/bin/sh
set -e

PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"

echo "Iniciando YouTube Playlist em ${HOST}:${PORT}"

exec python -m uvicorn app.main:app --host "$HOST" --port "$PORT"
