#!/bin/sh
# Periodic Simplebeacon scan trigger — POSTs to the dashboard API so
# .simplebeacon/report.json and history.json stay fresh for the live UI.
set -eu

INTERVAL="${SIMPLEBEACON_COLLECT_INTERVAL_SEC:-600}"
DASHBOARD_URL="${SIMPLEBEACON_DASHBOARD_URL:-http://dashboard:54355}"
TOKEN="${SIMPLEBEACON_DASHBOARD_TOKEN:-}"

wait_for_dashboard() {
  tries=0
  max=30
  while [ "$tries" -lt "$max" ]; do
    if curl -fsS "${DASHBOARD_URL}/api/simplebeacon/baseline" >/dev/null 2>&1; then
      # Dashboard ready at ${DASHBOARD_URL}
      return 0
    fi
    tries=$((tries + 1))
    # Waiting for dashboard (${tries}/${max})
    sleep 2
  done
  # Dashboard not reachable — exiting
  exit 1
}

run_scan() {
  # Triggering scan at $(date -u +"%Y-%m-%dT%H:%M:%SZ")
  if [ -n "$TOKEN" ]; then
    curl -fsS -X POST "${DASHBOARD_URL}/api/simplebeacon/scan" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{}' \
      || # Scan request failed (will retry)
  else
    curl -fsS -X POST "${DASHBOARD_URL}/api/simplebeacon/scan" \
      -H "Content-Type: application/json" \
      -d '{}' \
      || # Scan request failed (will retry)
  fi
}

wait_for_dashboard

while true; do
  run_scan
  sleep "$INTERVAL"
done
