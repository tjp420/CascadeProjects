#!/usr/bin/env bash
# readiness-probe.sh <url> [bearer_token]
# Returns 0 when service is healthy, non-zero otherwise
set -euo pipefail
URL=${1:-https://localhost:3007/health}
TOKEN=${2:-}
TIMEOUT=${3:-5}

CURL_OPTS=(--max-time "$TIMEOUT" -sS -o /dev/null -w "%{http_code}")
if [[ "$URL" == https:* ]]; then
  # allow self-signed certs in local testing
  CURL_OPTS=("-k" "${CURL_OPTS[@]}")
fi
if [[ -n "$TOKEN" ]]; then
  CODE=$(curl "${CURL_OPTS[@]}" -H "Authorization: Bearer $TOKEN" "$URL" || true)
else
  CODE=$(curl "${CURL_OPTS[@]}" "$URL" || true)
fi
if [[ "$CODE" == "200" ]]; then
  echo "ok"
  exit 0
else
  echo "unhealthy (http $CODE)" >&2
  exit 2
fi
