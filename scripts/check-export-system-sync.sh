#!/usr/bin/env sh
# Verify src/web/export-system.js remains a lightweight compatibility shim.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/ai-platform/src/web/export-system.js"
RUNTIME="$ROOT/ai-platform/web/scripts/export-system.js"

if [ ! -f "$SRC" ] || [ ! -f "$RUNTIME" ]; then
  echo "Missing export-system.js file(s)." >&2
  echo "Expected: $SRC and $RUNTIME" >&2
  exit 1
fi

if ! grep -q "/scripts/export-system.js" "$SRC"; then
  echo "src/web/export-system.js is not the expected compatibility shim." >&2
  echo "Run: sh scripts/sync-export-system.sh" >&2
  exit 1
fi

echo "export-system compatibility shim is in place."
exit 0
