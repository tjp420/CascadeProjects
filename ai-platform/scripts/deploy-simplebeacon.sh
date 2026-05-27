#!/usr/bin/env bash
# Deploy Simplebeacon dashboard stack on production server.
# Run from ai-platform/ directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[deploy] Running pre-deploy verification sequence..."
if ! npm run verify:predeploy; then
  echo "[deploy] Pre-deploy verification failed. Resolve blockers before deployment."
  exit 1
fi

echo "[deploy] Building Simplebeacon Docker stack..."
docker compose -f docker-compose.simplebeacon.yml -f docker-compose.simplebeacon.full.yml --profile full up -d --build

echo "[deploy] Waiting for dashboard health..."
TRIES=0
until curl -fsS http://127.0.0.1:54355/api/simplebeacon/baseline >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge 30 ]; then
    echo "[deploy] Dashboard failed to become healthy"
    docker logs simplebeacon_dashboard --tail 50 || true
    exit 1
  fi
  sleep 2
done

echo "[deploy] Running perimeter scan inside container..."
curl -fsS -X POST http://127.0.0.1:54355/api/simplebeacon/scan \
  -H "Content-Type: application/json" \
  -d '{}' >/dev/null

echo "[deploy] Audit endpoint check..."
curl -fsS http://127.0.0.1:54355/api/simplebeacon/audit | head -c 300
echo ""

echo "[deploy] Running route smoke suite..."
SMOKE_BASE_URL=http://127.0.0.1:54355 REQUIRE_AUTH=${REQUIRE_AUTH:-true} \
  node tools/run-route-smoke-suite.js

echo "[deploy] Done — https://simplebeacon.ai/ (coming soon) · dashboard: https://simplebeacon.ai/app"
