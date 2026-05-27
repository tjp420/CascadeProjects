#!/usr/bin/env sh
# Warn on large staged files (does not block commit by default).
set -eu

MAX_SIZE_KB="${MAX_SIZE_KB:-250}"
MAX_SIZE_BYTES=$((MAX_SIZE_KB * 1024))

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Collect staged files only.
staged_files="$(git diff --cached --name-only --diff-filter=AM)"
[ -n "$staged_files" ] || exit 0

large_files=""
for file in $staged_files; do
  [ -f "$file" ] || continue
  size_bytes="$(wc -c < "$file" | tr -d ' ')"
  if [ "$size_bytes" -gt "$MAX_SIZE_BYTES" ]; then
    size_kb=$((size_bytes / 1024))
    large_files="${large_files}${file} (${size_kb}KB)\n"
  fi
done

[ -n "$large_files" ] || exit 0

printf "⚠️  Large staged files (> %sKB):\n" "$MAX_SIZE_KB"
printf "%b" "$large_files"
printf "Consider archiving/generated-ignore or splitting these files.\n"

# Set BLOCK_LARGE_FILES=true to enforce.
if [ "${BLOCK_LARGE_FILES:-false}" = "true" ]; then
  printf "❌ Commit blocked by BLOCK_LARGE_FILES=true.\n"
  exit 1
fi

exit 0
