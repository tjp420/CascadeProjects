#!/usr/bin/env sh
# Optional compliance hardening checks for local/CI use.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/ai-platform"

echo "🔎 Running optional Simplebeacon compliance checks..."
npm run simplebeacon:report
npm run simplebeacon:assess -- --output .simplebeacon/assessment.json
npm run compliance:check
echo "✅ Optional compliance checks passed"
