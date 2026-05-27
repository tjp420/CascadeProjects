#!/usr/bin/env sh
# Move generated reports into archive folders (safe, non-destructive).
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p "ai-platform/archive/reports" "ai-platform/archive/coverage"

move_if_present() {
  src="$1"
  dst_dir="$2"
  if [ -f "$src" ]; then
    mv "$src" "$dst_dir/"
    printf "Archived %s -> %s/\n" "$src" "$dst_dir"
  fi
}

move_if_present "eslint-report.json" "ai-platform/archive/reports"
move_if_present "eslint-report-after.json" "ai-platform/archive/reports"
move_if_present "ai-platform/eslint-report.json" "ai-platform/archive/reports"
move_if_present "ai-platform/eslint-report-after.json" "ai-platform/archive/reports"

# Archive common Python coverage HTML reports if present.
for file in \
  "htmlcov/z_1bf0b52a2c83e01c_analysis_py.html" \
  "htmlcov/z_4fcf7437780e8ff7_export_tasks_py.html" \
  "htmlcov/z_6a31816d04deed5f_technical_debt_reducer_py.html"
do
  move_if_present "$file" "ai-platform/archive/coverage"
done

printf "Archive step complete.\n"
