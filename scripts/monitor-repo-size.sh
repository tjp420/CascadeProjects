#!/usr/bin/env sh
# Monorepo size monitor (excludes .git, node_modules, archive).
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Monorepo Size Report ==="
echo "Root: $ROOT"
echo "Total files: $(find . -type f | wc -l | tr -d ' ')"
echo "Total size: $(du -sh . | awk '{print $1}')"
echo ""
echo "Oversized files (>250KB, excluding .git/node_modules/archive):"
find . -type f -size +250k \
  ! -path "*/.git/*" \
  ! -path "*/node_modules/*" \
  ! -path "*/archive/*" \
  -print
