#!/bin/bash
# Simplebeacon Website Analyzer
# Downloads a website's source and runs Simplebeacon rules against it.
# Thin wrapper around curl + the existing local file scanner.
# No new rule engine — just fetch, save, scan.

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
# Auto-detect if script is inside ai-platform/ — jump to parent repo root
if [ "$(basename "$REPO_ROOT")" = "ai-platform" ]; then
    REPO_ROOT="$(cd "$REPO_ROOT/.." && pwd)"
fi
CLI_BIN="$REPO_ROOT/packages/simplebeacon-cli/bin/simplebeacon.js"
TEMP_DIR=""
URL=""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat <<EOF
Usage: $0 <URL> [options]

Examples:
  $0 https://example.com
  $0 https://example.com --depth 2
  $0 https://example.com --output report.json

Options:
  --depth <n>        Pages to fetch (default: 1, just the homepage)
  --output <file>    Write JSON report to file
  --gate             Exit 1 on blocking issues
  --offline          Fail if network activity detected (inverted for fetch)
  --keep             Keep downloaded files in /tmp for inspection
  --help             Show this help

EOF
    exit 0
}

# Parse arguments
DEPTH=1
OUTPUT=""
GATE_FLAG=""
KEEP=0

if [ $# -eq 0 ]; then
    usage
fi

URL="$1"
shift

while [ $# -gt 0 ]; do
    case "$1" in
        --depth)
            DEPTH="$2"
            shift 2
            ;;
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        --gate)
            GATE_FLAG="--gate"
            shift
            ;;
        --keep)
            KEEP=1
            shift
            ;;
        --help|-h)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate URL
if [ -z "$URL" ]; then
    log_error "No URL provided."
    usage
fi

if ! echo "$URL" | grep -qE '^https?://'; then
    log_warn "URL missing scheme. Assuming https://"
    URL="https://$URL"
fi

# Check for curl or wget
FETCH_CMD=""
if command -v curl >/dev/null 2>&1; then
    FETCH_CMD="curl"
elif command -v wget >/dev/null 2>&1; then
    FETCH_CMD="wget"
else
    log_error "Neither curl nor wget found. Install one first:"
    log_error "  sudo apt install curl"
    exit 1
fi

# Check simplebeacon CLI exists
if [ ! -f "$CLI_BIN" ]; then
    log_error "Simplebeacon CLI not found at $CLI_BIN"
    log_error "Run ./setup-zorin.sh first."
    exit 1
fi

# Create temp directory
TEMP_DIR="$(mktemp -d /tmp/simplebeacon-website.XXXXXX)"
DOMAIN=$(echo "$URL" | sed -E 's|https?://||' | sed -E 's|/.*||')
FETCH_DIR="$TEMP_DIR/$DOMAIN"
mkdir -p "$FETCH_DIR"

log_info "Fetching: $URL"
log_info "Save dir: $FETCH_DIR"

# Fetch homepage
if [ "$FETCH_CMD" = "curl" ]; then
    curl -sL --max-time 30 \
        -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
        "$URL" > "$FETCH_DIR/index.html" 2>/dev/null || {
        log_error "Failed to fetch $URL"
        rm -rf "$TEMP_DIR"
        exit 1
    }
else
    wget -q --timeout=30 --user-agent="Mozilla/5.0" \
        -O "$FETCH_DIR/index.html" "$URL" 2>/dev/null || {
        log_error "Failed to fetch $URL"
        rm -rf "$TEMP_DIR"
        exit 1
    }
fi

# Extract linked CSS/JS from the HTML for deeper analysis
if command -v grep >/dev/null 2>&1; then
    # Pull out href/src URLs that look like local assets
    grep -oE '(href|src)="[^"]+\.(css|js)"' "$FETCH_DIR/index.html" 2>/dev/null | \
        sed 's/.*="//;s/"$//' | \
        while read -r asset; do
            # Skip external URLs and data URIs
            if echo "$asset" | grep -qE '^https?://'; then
                asset_url="$asset"
            elif echo "$asset" | grep -qE '^data:|^//'; then
                continue
            else
                # Relative URL — resolve against base
                asset_url="${URL%/}/$asset"
            fi
            asset_file=$(basename "$asset" | sed 's/[?#].*//')
            [ -n "$asset_file" ] || continue
            ext="${asset_file##*.}"
            out_path="$FETCH_DIR/$asset_file"
            if [ "$FETCH_CMD" = "curl" ]; then
                curl -sL --max-time 15 "$asset_url" > "$out_path" 2>/dev/null || true
            else
                wget -q --timeout=15 -O "$out_path" "$asset_url" 2>/dev/null || true
            fi
        done
fi

# Count what we got
FILE_COUNT=$(find "$FETCH_DIR" -type f | wc -l)
log_info "Downloaded $FILE_COUNT file(s)."

# Run Simplebeacon scan on the fetched files
log_info "Running Simplebeacon scan..."
SCAN_ARGS="--path $FETCH_DIR"
if [ -n "$OUTPUT" ]; then
    SCAN_ARGS="$SCAN_ARGS --format json --output $OUTPUT"
fi
if [ -n "$GATE_FLAG" ]; then
    SCAN_ARGS="$SCAN_ARGS --gate"
fi

# Build a minimal config for website scanning
CONFIG_DIR="$TEMP_DIR/.simplebeacon"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/config.json" <<'CFGEOF'
{
  "profile": "minimal",
  "scanPaths": ["."],
  "productionPaths": ["."],
  "exclude": ["node_modules", ".git"],
  "gate": {
    "failOn": ["high", "critical"]
  },
  "rules": {
    "fiction-kpi-patterns": true,
    "token-bleed-patterns": true,
    "credential-patterns": true,
    "production-leak-patterns": true
  }
}
CFGEOF

SCAN_ARGS="$SCAN_ARGS --config $CONFIG_DIR/config.json"

set +e
node "$CLI_BIN" scan $SCAN_ARGS
SCAN_EXIT=$?
set -e

# Cleanup
if [ "$KEEP" -eq 0 ]; then
    rm -rf "$TEMP_DIR"
    log_info "Cleaned up temp files."
else
    log_info "Kept files for inspection: $FETCH_DIR"
fi

if [ "$SCAN_EXIT" -ne 0 ] && [ -n "$GATE_FLAG" ]; then
    log_warn "Gate failed — issues found in downloaded website source."
fi

exit $SCAN_EXIT
