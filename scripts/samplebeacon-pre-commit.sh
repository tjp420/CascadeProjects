#!/usr/bin/env sh
# Simplebeacon pre-commit integration.
# Default: lightweight/non-blocking visibility checks.
# Optional strict mode: SIMPLEBEACON_PRECOMMIT_STRICT=true
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
sh "$ROOT/scripts/check-large-files.sh"
sh "$ROOT/scripts/check-export-system-sync.sh"

cd "$ROOT/ai-platform"
echo "🛡️  Simplebeacon pre-commit quality checks..."
npm run simplebeacon -- --gate --fail-on high
npm run guard:fiction-kpi || true
npm run scan:kpi:source || true

# Optional heavier checks can be enabled locally/CI without forcing every commit.
if [ "${SIMPLEBEACON_ENFORCE_LOCAL_COMPLIANCE:-false}" = "true" ]; then
  sh "$ROOT/scripts/simplebeacon-compliance-check.sh"
fi

if [ "${SIMPLEBEACON_PRECOMMIT_STRICT:-false}" = "true" ]; then
  echo "🔒 Strict mode enabled: running full compliance check"
  sh "$ROOT/scripts/samplebeacon-compliance-check.sh"
fi

echo "✅ Simplebeacon pre-commit checks completed"
