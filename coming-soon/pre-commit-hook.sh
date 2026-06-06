#!/bin/sh
# SimpleBeacon Pre-Commit Hook
# Place this in .git/hooks/pre-commit to run gate scan before each commit

echo "[SimpleBeacon] Running pre-commit gate scan..."

# Run gate scan (fails if blocking issues found)
if command -v npx >/dev/null 2>&1; then
    npx simplebeacon scan --gate --format json --output .simplebeacon/pre-commit-report.json
    EXIT_CODE=$?
else
    echo "[SimpleBeacon] npx not found — skipping scan"
    exit 0
fi

if [ $EXIT_CODE -ne 0 ]; then
    echo "[SimpleBeacon] GATE FAILED — commit blocked."
    echo "[SimpleBeacon] Run 'npx simplebeacon scan --gate' for details."
    exit 1
fi

echo "[SimpleBeacon] Gate passed — commit allowed."
exit 0
