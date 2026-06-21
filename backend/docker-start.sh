#!/bin/sh
set -e

PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"

mkdir -p /app/backend/data

echo "Iniciando YouTube Playlist em ${HOST}:${PORT}"
echo "Banco SQLite em: ${DATABASE_URL:-sqlite:///./data/youtubeplaylist.db}"
echo "Persistência: monte o volume em /app/backend/data para não perder dados no redeploy"

exec python -m uvicorn app.main:app --host "$HOST" --port "$PORT"
