#!/usr/bin/env bash
# Start backend + frontend in one terminal. Ctrl+C stops both.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# --- backend ---
cd backend
if [ ! -d .venv ]; then
  echo ">> Creating Python venv…"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  echo ">> Created backend/.env (edit it to enable LLM features)."
fi

uvicorn app.main:app --reload --port 8000 &
BACK_PID=$!
cd ..

# --- frontend ---
cd frontend
if [ ! -d node_modules ]; then
  echo ">> Installing npm deps…"
  npm install
fi
npm run dev &
FRONT_PID=$!
cd ..

trap "echo '>> shutting down'; kill $BACK_PID $FRONT_PID 2>/dev/null || true" EXIT INT TERM

echo ""
echo "=========================================="
echo " Backend  : http://localhost:8000"
echo " Frontend : http://localhost:5173"
echo "=========================================="
echo ""
wait
