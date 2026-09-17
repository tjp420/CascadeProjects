#!/usr/bin/env bash
# Cross-platform POSIX pre-push hook wrapper
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_CMD="node"
if ! command -v "$NODE_CMD" >/dev/null 2>&1; then
  echo "node not found in PATH. Install Node.js to run the secret guard." >&2
  exit 1
fi

node "$SCRIPT_DIR/secret-guard.js"
EXIT=$?
if [ $EXIT -ne 0 ]; then
  echo "pre-push secret guard blocked the push (exit $EXIT)" >&2
  exit $EXIT
fi
exit 0
