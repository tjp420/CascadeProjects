#!/usr/bin/env bash
# scripts/start-mcp.sh
# Unix Wrapper to launch the SimpleBeacon local MCP tool server

set -euo pipefail

echo -e "\033[0;36m[*] Checking local Node environment dependencies...\033[0m"
if ! command -v npx &> /dev/null; then
    echo -e "\033[0;31m❌ Error: Node.js/npx runtime not detected on your system PATH.\033[0m"
    echo -e "\033[0;33m💡 Fix: Please install Node.js via your package manager or https://nodejs.org\033[0m"
    exit 1
fi

echo -e "\033[0;32m[+] Initializing SimpleBeacon MCP Engine in offline sandbox mode...\033[0m"

# Execute the local tool binary wrapper
npx simplebeacon-mcp --offline
