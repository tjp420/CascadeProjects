#!/bin/bash
# Simplebeacon Zorin Linux Setup Script
# Works from thumb drive, home folder, or any path — auto-detects repo root.

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
# Auto-detect if script is inside ai-platform/ — jump to parent repo root
if [ "$(basename "$REPO_ROOT")" = "ai-platform" ]; then
    REPO_ROOT="$(cd "$REPO_ROOT/.." && pwd)"
fi
CLI_PKG="$REPO_ROOT/packages/simplebeacon-cli"
PLATFORM_DIR="$REPO_ROOT/ai-platform"
LOG_FILE="$REPO_ROOT/setup-zorin.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; }

# Clear previous log
> "$LOG_FILE"

echo "============================================"
echo "  Simplebeacon Zorin Linux Setup"
echo "============================================"
echo ""
log_info "Detected repo path: $REPO_ROOT"

# Detect thumb drive + warn about FAT32 noexec
if echo "$REPO_ROOT" | grep -q '/media/'; then
    log_info "Running from a removable drive (thumb drive / external disk)."
    MOUNT_TYPE=$(findmnt -n -o FSTYPE -T "$REPO_ROOT" 2>/dev/null || echo "unknown")
    if echo "$MOUNT_TYPE" | grep -qiE 'fat|exfat|ntfs'; then
        log_warn "Thumb drive is $MOUNT_TYPE — may not support execute permissions."
        log_warn "If ./setup-zorin.sh fails with 'Permission denied', run instead:"
        log_warn "  bash setup-zorin.sh"
    fi
fi

# 1. Check OS
if ! grep -qi "zorin\|ubuntu\|debian" /etc/os-release 2>/dev/null; then
    log_warn "This script is tuned for Zorin/Ubuntu/Debian derivatives."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 2. Check Node.js
log_info "Checking Node.js..."
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 16 ]; then
        log_info "Node.js v$NODE_VERSION found (>= 16 OK)"
    else
        log_warn "Node.js v$NODE_VERSION found (need >= 16)"
        INSTALL_NODE=1
    fi
else
    log_warn "Node.js not found"
    INSTALL_NODE=1
fi

# 3. Install Node.js if needed
if [ "$INSTALL_NODE" = "1" ]; then
    log_info "Installing Node.js 20.x via NodeSource..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
    sudo apt-get update
    sudo apt-get install -y nodejs
    log_info "Node.js installed: $(node -v)"
fi

# 4. Check npm
if ! command -v npm >/dev/null 2>&1; then
    log_error "npm is missing. Installing..."
    sudo apt-get install -y npm
fi
log_info "npm: $(npm -v)"

# 5. Check curl (required for scan-website.sh and NodeSource)
if ! command -v curl >/dev/null 2>&1; then
    log_info "Installing curl..."
    sudo apt-get install -y curl
fi
log_info "curl: $(curl --version | head -1 | awk '{print $2}')"

# 6. Check Git
if ! command -v git >/dev/null 2>&1; then
    log_info "Installing git..."
    sudo apt-get install -y git
fi

# 7. Verify repo structure
if [ ! -f "$CLI_PKG/package.json" ]; then
    log_error "CLI package not found at $CLI_PKG"
    log_error "Make sure you copied the entire repo (including packages/simplebeacon-cli/)"
    exit 1
fi

# 8. Install CLI package dependencies
log_info "Installing CLI package dependencies..."
cd "$CLI_PKG"
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

# 9. Symlink CLI binaries to /usr/local/bin
log_info "Linking simplebeacon CLI to /usr/local/bin..."
CLI_BIN="$CLI_PKG/bin/simplebeacon.js"
MCP_BIN="$CLI_PKG/bin/simplebeacon-mcp.js"

if [ -f "$CLI_BIN" ]; then
    sudo ln -sf "$CLI_BIN" /usr/local/bin/simplebeacon
    sudo chmod +x "$CLI_BIN"
    log_info "simplebeacon -> $CLI_BIN"
fi

if [ -f "$MCP_BIN" ]; then
    sudo ln -sf "$MCP_BIN" /usr/local/bin/simplebeacon-mcp
    sudo chmod +x "$MCP_BIN"
    log_info "simplebeacon-mcp -> $MCP_BIN"
fi

# 10. Initialize simplebeacon config
log_info "Initializing simplebeacon config..."
cd "$REPO_ROOT"
if [ ! -d "$REPO_ROOT/.simplebeacon" ]; then
    mkdir -p "$REPO_ROOT/.simplebeacon"
fi

# Create a minimal config if none exists
if [ ! -f "$REPO_ROOT/.simplebeacon/config.json" ]; then
    node "$CLI_BIN" init --starter 2>/dev/null || true
fi

# 11. Verify installation
log_info "Verifying installation..."
if simplebeacon scan --gate --offline >/dev/null 2>&1; then
    log_info "Simplebeacon CLI is working!"
else
    log_warn "CLI test had warnings (this is normal if the repo has findings)"
fi

# 12. Optional: Install ai-platform dependencies
if [ -d "$PLATFORM_DIR" ] && [ -f "$PLATFORM_DIR/package.json" ]; then
    echo ""
    read -p "Install ai-platform dashboard dependencies too? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Installing ai-platform dependencies..."
        cd "$PLATFORM_DIR"
        if [ -f "package-lock.json" ]; then
            npm ci
        else
            npm install
        fi
        log_info "ai-platform dependencies installed."
        log_info "Start dashboard with: cd ai-platform && npm start"
    fi
fi

# 13. Create desktop entry (optional)
echo ""
read -p "Create Zorin desktop launcher for simplebeacon dashboard? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DESKTOP_FILE="$HOME/.local/share/applications/simplebeacon-dashboard.desktop"
    mkdir -p "$(dirname "$DESKTOP_FILE")"
    cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=Simplebeacon Dashboard
Comment=Local AI safety scanning dashboard
Exec=bash -c 'cd "$PLATFORM_DIR" && npm start'
Icon=utilities-terminal
Type=Application
Terminal=true
Categories=Development;
EOF
    chmod +x "$DESKTOP_FILE"
    log_info "Desktop launcher created: $DESKTOP_FILE"
fi

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "Quick commands:"
echo "  simplebeacon scan --gate --offline       # Scan current directory"
echo "  simplebeacon-mcp --offline               # Start MCP server"
echo "  simplebeacon init --starter              # Re-initialize config"
echo ""
if [ -d "$PLATFORM_DIR" ]; then
    echo "Dashboard:"
    echo "  ./start-dashboard.sh                    # Start web dashboard + open browser"
    echo "  cd ai-platform && npm start             # Manual start"
    echo "  cd ai-platform && npm run simplebeacon   # Run scan via npm"

    # Ask to start dashboard now
    echo ""
    read -p "Start the dashboard now and open browser? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$REPO_ROOT"
        if [ -f "$REPO_ROOT/start-dashboard.sh" ]; then
            chmod +x "$REPO_ROOT/start-dashboard.sh"
            "$REPO_ROOT/start-dashboard.sh"
        else
            log_warn "start-dashboard.sh not found. Start manually with: cd ai-platform && npm start"
        fi
    fi
fi
echo ""
echo "Log saved to: $LOG_FILE"
