#!/usr/bin/env sh
# Simplebeacon pre-push — gate plus Jest baseline comparison (slower).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/ai-platform"
echo "🛡️  Simplebeacon pre-push (gate + Jest baseline)..."
npm run simplebeacon:full
echo "✅ Simplebeacon pre-push passed"
