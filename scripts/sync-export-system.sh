#!/usr/bin/env sh
# Keep a lightweight src/web compatibility shim for export-system.js.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/ai-platform/src/web/export-system.js"
RUNTIME="$ROOT/ai-platform/web/scripts/export-system.js"

if [ ! -f "$RUNTIME" ]; then
  echo "Runtime file missing: $RUNTIME" >&2
  exit 1
fi

mkdir -p "$(dirname "$SRC")"
cat >"$SRC" <<'EOF'
/**
 * Compatibility shim for legacy pages that load `/export-system.js`.
 * Canonical implementation lives at `/scripts/export-system.js`.
 */
(function loadExportSystemCompatibilityShim() {
  const scriptId = 'export-system-runtime-script';
  if (document.getElementById(scriptId)) {
    return;
  }

  const script = document.createElement('script');
  script.id = scriptId;
  script.src = '/scripts/export-system.js';
  script.defer = true;
  document.head.appendChild(script);
})();
EOF

echo "Wrote lightweight src/web/export-system.js compatibility shim"
