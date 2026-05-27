#!/usr/bin/env sh
# Safe cleanup for generated reports/logs at monorepo root.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p "ai-platform/archive/reports" "ai-platform/archive/coverage" "archive/old-logs"

# Archive generated eslint reports at root.
for file in eslint-report.json eslint-report-after.json; do
  if [ -f "$file" ]; then
    mv "$file" "ai-platform/archive/reports/"
    echo "Archived $file -> ai-platform/archive/reports/"
  fi
done

# Archive root htmlcov reports if present.
if [ -d "htmlcov" ]; then
  find "htmlcov" -maxdepth 1 -type f -name "*.html" -exec mv {} "ai-platform/archive/coverage/" \;
fi

# Archive old log files from root-level logs folder if present.
if [ -d "logs" ]; then
  find "logs" -type f -name "*.log" -mtime +30 -exec mv {} "archive/old-logs/" \;
fi

echo "Cleanup complete."
