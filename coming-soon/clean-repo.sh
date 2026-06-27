#!/usr/bin/env bash
# SimpleBeacon Workspace Sanitizer for coming-soon project
set -e

echo -e "\033[0;34m[SimpleBeacon] Purging workspace debris for coming-soon project...\033[0m"

# 1. Clear out local extension testing artifacts and tmp tracks safely
if [ -d "./.vscode-test" ]; then
    echo "Wiping temporary VS Code extension build artifacts: ./.vscode-test"
    rm -rf "./.vscode-test"
fi

# Locate and flush out stray runtime temporary files from the active path root
find . -maxdepth 2 -name "tmp-*.js" -type f -print -delete

# 2. Append immutable Git filters to local mapping layers
echo "Updating .gitignore policies..."
cat << 'EOF' >> .gitignore

# SimpleBeacon Local Workspace Guards
.simplebeacon/
.vscode-test/
tmp-*.js
*.log
EOF

# 3. Fire the schema recalculation engine across the active download file path
REAL_REPORT="c:/Users/Trevor/.windsurf-next/extensions/simplebeacon.simplebeacon-3.0.309/downloads/1782588232913-report.json"
if [ -f "$REAL_REPORT" ]; then
    node -e "require('./FilterAndRecalculate.js').filterAndRecalculate('$REAL_REPORT', '$REAL_REPORT-filtered.json')"
else
    echo -e "\033[0;33m⚠️ Targeted download report file not found on disk. Re-check file path.\033[0m"
fi

echo -e "\033[0;32m✔ Workspace stabilization complete.\033[0m"
