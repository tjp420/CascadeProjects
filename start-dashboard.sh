#!/bin/bash
# Simplebeacon Dashboard Launcher
# Works from any path — thumb drive, home folder, or external disk.
# Auto-detects repo root, starts the server, and opens the browser.

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
# Auto-detect if script is inside ai-platform/ — jump to parent repo root
if [ "$(basename "$REPO_ROOT")" = "ai-platform" ]; then
    REPO_ROOT="$(cd "$REPO_ROOT/.." && pwd)"
fi
PLATFORM_DIR="$REPO_ROOT/ai-platform"
DASHBOARD_URL="http://localhost:54355/simplebeacon-dashboard/"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Verify ai-platform exists
if [ ! -d "$PLATFORM_DIR" ] || [ ! -f "$PLATFORM_DIR/package.json" ]; then
    echo "ERROR: ai-platform not found at $PLATFORM_DIR"
    echo "Make sure you are running this from the CascadeProjects repo root."
    exit 1
fi

log_info "Starting Simplebeacon dashboard..."
log_info "Repo: $REPO_ROOT"
log_info "URL:  $DASHBOARD_URL"

# Check if Node.js is available
if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js not found. Run ./setup-zorin.sh first."
    exit 1
fi

# Check if port is already in use
if ss -tlnp 2>/dev/null | grep -q ':54355 '; then
    log_warn "Port 54355 is already in use."
    log_warn "The dashboard may already be running, or another service is using this port."
    log_warn "Opening browser anyway..."
else
    log_info "Starting server in background..."
    cd "$PLATFORM_DIR"
    nohup npm start > "$REPO_ROOT/dashboard.log" 2>&1 &
    SERVER_PID=$!
    log_info "Server PID: $SERVER_PID"
    log_info "Logs: $REPO_ROOT/dashboard.log"

    # Wait for server to be ready
    log_info "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:54355/simplebeacon-dashboard/ | grep -q "200\|301\|302"; then
            log_info "Server is ready!"
            break
        fi
        sleep 1
    done
fi

# Open browser
log_info "Opening browser..."
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$DASHBOARD_URL"
elif command -v gnome-open >/dev/null 2>&1; then
    gnome-open "$DASHBOARD_URL"
else
    log_warn "Could not auto-open browser. Please open manually:"
    echo "  $DASHBOARD_URL"
fi

echo ""
echo "============================================"
echo "  Dashboard running!"
echo "  URL: $DASHBOARD_URL"
echo "============================================"
echo ""
echo "To stop the server:"
echo "  pkill -f 'node server/index.cjs'"
echo "  # or find PID: pgrep -f 'node server/index.cjs'"
echo ""

