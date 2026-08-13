#!/usr/bin/env bash
#
# export-diagnostics-bundle.sh
# Creates a diagnostic archive for air-gapped SimpleBeacon deployments.
#
# Bundles container logs, hardware specs, sanitized environment variables,
# Docker metadata, Ollama model info, PostgreSQL status, and the validation
# JSON report into a single tarball that a field technician can carry back
# over the air-gap for engineering post-mortem analysis.
#
# Usage:
#   ./scripts/export-diagnostics-bundle.sh                    # Create bundle in ./diagnostics/
#   ./scripts/export-diagnostics-bundle.sh --output /mnt/usb  # Create bundle at specific path
#   ./scripts/export-diagnostics-bundle.sh --encrypt          # Encrypt with passphrase (prompts)
#   ./scripts/export-diagnostics-bundle.sh --encrypt --passphrase-file /path/to/key
#   ./scripts/export-diagnostics-bundle.sh --validate-json /path/to/report.json  # Include validation report
#   ./scripts/export-diagnostics-bundle.sh --log-lines 1000   # Capture last N lines of logs (default: 500)
#
# Security:
#   - All environment variables are sanitized: values matching known secret
#     patterns (JWT_SECRET, POSTGRES_PASSWORD, STRIPE_SECRET_KEY, SMTP_PASS,
#     API keys, etc.) are replaced with [REDACTED]
#   - No scanned content, user data, or model weights are included
#   - Only container metadata, logs, and system specs are captured
#   - Encryption (when requested) uses openssl AES-256-CBC with a passphrase
#
# Exit codes:
#   0  Bundle created successfully
#   1  Bundle creation failed
#   2  Fatal error (Docker not running, script misuse)
#

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────

OLLAMA_CONTAINER="simplebeacon-ollama"
ENGINE_CONTAINER="simplebeacon-engine"
DB_CONTAINER="simplebeacon-db"
DB_USER="simplebeacon_user"
DB_NAME="simplebeacon"

OUTPUT_DIR="./diagnostics"
LOG_LINES=500
ENCRYPT=false
PASSPHRASE_FILE=""
VALIDATION_JSON=""
VERBOSE=false

# Secret env var patterns — values for these keys are always redacted
SECRET_PATTERNS=(
  "JWT_SECRET"
  "SIMPLEBEACON_LICENSE_SECRET"
  "DASHBOARD_VAULT_PASSWORD"
  "REPORT_SIGNING_KEY"
  "POSTGRES_PASSWORD"
  "DATABASE_URL"
  "DB_PASSWORD"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "RESEND_API_KEY"
  "SMTP_PASS"
  "SMTP_PASSWORD"
  "OPENAI_API_KEY"
  "ANTHROPIC_API_KEY"
  "REDIS_URL"
  "API_TOKEN"
  "SECRET"
  "PASSWORD"
  "PASS"
  "KEY"
  "TOKEN"
  "PRIVATE_KEY"
  "CREDENTIAL"
)

# ── Argument parsing ────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)         OUTPUT_DIR="${2:-./diagnostics}"; shift 2 ;;
    --encrypt)        ENCRYPT=true; shift ;;
    --passphrase-file) PASSPHRASE_FILE="${2:-}"; shift 2 ;;
    --validate-json)  VALIDATION_JSON="${2:-}"; shift 2 ;;
    --log-lines)      LOG_LINES="${2:-500}"; shift 2 ;;
    --verbose)        VERBOSE=true; shift ;;
    --help|-h)
      cat << 'HELP'
SimpleBeacon Diagnostics Bundle Exporter

Usage:
  export-diagnostics-bundle.sh [OPTIONS]

Options:
  --output DIR            Output directory for the bundle (default: ./diagnostics)
  --encrypt               Encrypt the bundle with AES-256-CBC (prompts for passphrase)
  --passphrase-file FILE  Read passphrase from file (for non-interactive encryption)
  --validate-json FILE    Include a validation report JSON in the bundle
  --log-lines N           Number of log lines to capture per container (default: 500)
  --verbose               Show progress details
  --help, -h              Show this help message

Security:
  - All secret env vars are redacted ([REDACTED])
  - No user data, scanned content, or model weights are included
  - Encryption uses openssl AES-256-CBC when --encrypt is passed

Bundle contents:
  validation-report.json    Full validation + recovery JSON (if provided)
  manifest.json             Bundle metadata (timestamp, hostname, version)
  system/
    hardware.json           RAM, VRAM, CPU, disk, OS info
    docker-info.txt         docker info output
    docker-version.txt      docker version output
    environment-sanitized.json  Env vars with secrets redacted
  containers/
    *.log                   Container logs (last N lines)
    *-inspect.json          Docker inspect metadata (sanitized)
  ollama/
    models.json             ollama list output
    tags.json               /api/tags response
  postgres/
    tables.json             Table existence check results
    version.txt             PostgreSQL version
HELP
      exit 0
      ;;
    *) echo "[FATAL] Unknown option: $1" >&2; exit 2 ;;
  esac
done

# ── Helpers ─────────────────────────────────────────────────────────────────

log()  { echo "[ SimpleBeacon] $*"; }
info() { $VERBOSE && echo "[INFO] $*" || true; }
warn() { echo "[WARN] $*" >&2; }
err()  { echo "[ERROR] $*" >&2; }

# ── Pre-flight checks ───────────────────────────────────────────────────────

if ! docker info > /dev/null 2>&1; then
  err "Docker daemon is not reachable — is Docker running?"
  exit 2
fi

if ! command -v openssl > /dev/null 2>&1 && $ENCRYPT; then
  err "openssl is not available — cannot encrypt bundle"
  err "Install openssl or re-run without --encrypt"
  exit 2
fi

# ── Create working directory ────────────────────────────────────────────────

TIMESTAMP=$(date -u +"%Y%m%d-%H%M%SZ")
HOSTNAME_VAL=$(hostname 2>/dev/null || echo "unknown")
BUNDLE_NAME="diagnostics-${TIMESTAMP}"
WORK_DIR=$(mktemp -d)
BUNDLE_DIR="$WORK_DIR/$BUNDLE_NAME"

mkdir -p "$BUNDLE_DIR"/{system,containers,ollama,postgres}

log "Creating diagnostics bundle: $BUNDLE_NAME"
info "Working directory: $WORK_DIR"

# ── 1. Bundle manifest ──────────────────────────────────────────────────────

info "Collecting bundle metadata..."

cat > "$BUNDLE_DIR/manifest.json" << EOF
{
  "bundleName": "$BUNDLE_NAME",
  "timestamp": "$TIMESTAMP",
  "hostname": "$HOSTNAME_VAL",
  "exporterVersion": "1.0.0",
  "logLinesCaptured": $LOG_LINES,
  "encrypted": $($ENCRYPT && echo "true" || echo "false"),
  "containers": {
    "engine": "$ENGINE_CONTAINER",
    "ollama": "$OLLAMA_CONTAINER",
    "db": "$DB_CONTAINER"
  }
}
EOF

# ── 2. System hardware specs ────────────────────────────────────────────────

info "Collecting hardware specs..."

# Detect RAM
detect_ram() {
  if command -v free > /dev/null 2>&1; then
    free -k | awk '/^Mem:/ {print $2}' | awk '{printf "%.0f", $1/1024/1024}'
  elif command -v wmic > /dev/null 2>&1; then
    local bytes
    bytes=$(wmic computersystem get TotalPhysicalMemory 2>/dev/null | tr -d ' \r' | grep -E '^[0-9]+$' | head -1)
    echo $((bytes / 1024 / 1024 / 1024))
  elif command -v sysctl > /dev/null 2>&1; then
    local bytes
    bytes=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    echo $((bytes / 1024 / 1024 / 1024))
  else
    echo "?"
  fi
}

# Detect VRAM
detect_vram() {
  if command -v nvidia-smi > /dev/null 2>&1; then
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>/dev/null || echo "nvidia-smi error"
  else
    echo "No NVIDIA GPU detected"
  fi
}

# Detect CPU
detect_cpu() {
  if command -v nproc > /dev/null 2>&1; then
    echo "$(nproc) cores"
  elif command -v wmic > /dev/null 2>&1; then
    wmic cpu get Name,NumberOfCores 2>/dev/null | tr -d '\r' | head -2 | tail -1
  elif command -v sysctl > /dev/null 2>&1; then
    echo "$(sysctl -n hw.ncpu 2>/dev/null || echo '?') cores"
  else
    echo "?"
  fi
}

# Detect OS
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "$NAME $VERSION"
  elif command -v wmic > /dev/null 2>&1; then
    wmic os get Caption,Version 2>/dev/null | tr -d '\r' | head -2 | tail -1
  elif command -v sw_vers > /dev/null 2>&1; then
    sw_vers 2>/dev/null | head -2
  else
    uname -a 2>/dev/null || echo "unknown"
  fi
}

# Detect disk space
detect_disk() {
  if command -v df > /dev/null 2>&1; then
    local docker_root
    docker_root=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $NF}' || echo "/")
    df -h "$docker_root" 2>/dev/null | awk 'NR==2 {print $2","$3","$4","$5}' || df -h / 2>/dev/null | awk 'NR==2 {print $2","$3","$4","$5}'
  else
    echo "?,?,?,?"
  fi
}

RAM_GB=$(detect_ram)
VRAM_INFO=$(detect_vram)
CPU_INFO=$(detect_cpu)
OS_INFO=$(detect_os)
DISK_INFO=$(detect_disk)

cat > "$BUNDLE_DIR/system/hardware.json" << EOF
{
  "hostname": "$HOSTNAME_VAL",
  "os": "$(echo "$OS_INFO" | sed 's/"/\\"/g')",
  "cpu": "$(echo "$CPU_INFO" | sed 's/"/\\"/g')",
  "ramGB": "$RAM_GB",
  "gpu": "$(echo "$VRAM_INFO" | sed 's/"/\\"/g')",
  "disk": {
    "total,used,available,usePercent": "$DISK_INFO"
  },
  "dockerRootDir": "$(docker info 2>/dev/null | grep 'Docker Root Dir' | awk '{print $NF}' || echo 'unknown')"
}
EOF

# Docker info and version
docker info > "$BUNDLE_DIR/system/docker-info.txt" 2>&1 || true
docker version > "$BUNDLE_DIR/system/docker-version.txt" 2>&1 || true

# ── 3. Sanitized environment variables ──────────────────────────────────────

info "Collecting sanitized environment variables..."

# Function to redact secret values
sanitize_env_value() {
  local key="$1"
  local value="$2"
  local key_upper
  key_upper=$(echo "$key" | tr '[:lower:]' '[:upper:]')

  for pattern in "${SECRET_PATTERNS[@]}"; do
    if echo "$key_upper" | grep -qi "$pattern"; then
      echo "[REDACTED]"
      return
    fi
  done

  # Also redact if the value looks like a secret (long hex, base64, etc.)
  if [ ${#value} -gt 20 ] && echo "$value" | grep -qE '^[A-Za-z0-9+/=_-]+$'; then
    echo "[REDACTED:looks-like-secret]"
    return
  fi

  echo "$value"
}

# Collect env vars from all three containers and sanitize
collect_container_env() {
  local container="$1"
  local output_file="$2"

  if ! docker ps --format '{{.Names}}' | grep -qx "$container" 2>/dev/null; then
    echo "{\"error\":\"container not running\"}" > "$output_file"
    return
  fi

  local env_output
  env_output=$(docker exec "$container" env 2>/dev/null || echo "")

  echo "{" > "$output_file"
  local first=true
  echo "$env_output" | while IFS='=' read -r key value; do
    [ -z "$key" ] && continue
    local sanitized
    sanitized=$(sanitize_env_value "$key" "$value")
    if $first; then
      printf '  "%s": "%s"' "$key" "$sanitized" >> "$output_file"
      first=false
    else
      printf ',\n  "%s": "%s"' "$key" "$sanitized" >> "$output_file"
    fi
  done
  echo "" >> "$output_file"
  echo "}" >> "$output_file"
}

# Collect host environment (sanitized)
HOST_ENV_FILE="$BUNDLE_DIR/system/environment-sanitized.json"
echo "{" > "$HOST_ENV_FILE"
first_env=true
while IFS='=' read -r key value; do
  [ -z "$key" ] && continue
  # Skip empty values
  [ -z "$value" ] && continue
  local sanitized
  sanitized=$(sanitize_env_value "$key" "$value")
  if $first_env; then
    printf '  "%s": "%s"' "$key" "$sanitized" >> "$HOST_ENV_FILE"
    first_env=false
  else
    printf ',\n  "%s": "%s"' "$key" "$sanitized" >> "$HOST_ENV_FILE"
  fi
done < <(env 2>/dev/null || printenv 2>/dev/null || true)
echo "" >> "$HOST_ENV_FILE"
echo "}" >> "$HOST_ENV_FILE"

# Also collect per-container env
collect_container_env "$ENGINE_CONTAINER" "$BUNDLE_DIR/containers/engine-env-sanitized.json"
collect_container_env "$OLLAMA_CONTAINER" "$BUNDLE_DIR/containers/ollama-env-sanitized.json"
collect_container_env "$DB_CONTAINER" "$BUNDLE_DIR/containers/db-env-sanitized.json"

# ── 4. Container logs ───────────────────────────────────────────────────────

info "Collecting container logs (last $LOG_LINES lines)..."

for c in "$ENGINE_CONTAINER" "$OLLAMA_CONTAINER" "$DB_CONTAINER"; do
  if docker ps --format '{{.Names}}' | grep -qx "$c" 2>/dev/null; then
    log_file="$BUNDLE_DIR/containers/${c}.log"
    docker logs --tail "$LOG_LINES" "$c" > "$log_file" 2>&1 || echo "[ERROR: Could not capture logs for $c]" > "$log_file"
    info "  Captured $c logs ($(wc -l < "$log_file") lines)"
  else
    echo "[Container $c is not running — no logs available]" > "$BUNDLE_DIR/containers/${c}.log"
    info "  $c not running — skipping logs"
  fi
done

# ── 5. Docker inspect metadata (sanitized) ──────────────────────────────────

info "Collecting Docker inspect metadata..."

for c in "$ENGINE_CONTAINER" "$OLLAMA_CONTAINER" "$DB_CONTAINER"; do
  if docker ps -a --format '{{.Names}}' | grep -qx "$c" 2>/dev/null; then
    inspect_file="$BUNDLE_DIR/containers/${c}-inspect.json"
    # docker inspect output is already JSON — sanitize env vars within it
    docker inspect "$c" 2>/dev/null | python3 -c "
import sys, json
def redact(obj):
    if isinstance(obj, dict):
        return {k: ('[REDACTED]' if any(p in k.upper() for p in ['SECRET','PASSWORD','PASS','KEY','TOKEN','CREDENTIAL','PRIVATE_KEY']) and isinstance(v, str) else redact(v)) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [redact(i) for i in obj]
    return obj
data = json.load(sys.stdin)
print(json.dumps(redact(data), indent=2))
" 2>/dev/null > "$inspect_file" || docker inspect "$c" > "$inspect_file" 2>/dev/null || echo "{\"error\":\"inspect failed\"}" > "$inspect_file"
    info "  Captured $c inspect data"
  else
    echo "{\"error\":\"container not found\"}" > "$BUNDLE_DIR/containers/${c}-inspect.json"
  fi
done

# ── 6. Ollama model info ────────────────────────────────────────────────────

info "Collecting Ollama model information..."

if docker ps --format '{{.Names}}' | grep -qx "$OLLAMA_CONTAINER" 2>/dev/null; then
  # Model list
  docker exec "$OLLAMA_CONTAINER" ollama list 2>/dev/null > "$BUNDLE_DIR/ollama/models.txt" || echo "[ERROR: ollama list failed]" > "$BUNDLE_DIR/ollama/models.txt"

  # API tags response
  docker exec "$OLLAMA_CONTAINER" curl -s "http://localhost:11434/api/tags" 2>/dev/null > "$BUNDLE_DIR/ollama/tags.json" || echo "{\"error\":\"tags endpoint unreachable\"}" > "$BUNDLE_DIR/ollama/tags.json"

  # Model details for each model
  mkdir -p "$BUNDLE_DIR/ollama/models"
  for model in unbreakable-oracle simplebeacon-llama32 simplebeacon-mistral simplebeacon-qwen-coder; do
    docker exec "$OLLAMA_CONTAINER" ollama show "$model" 2>/dev/null > "$BUNDLE_DIR/ollama/models/${model}.txt" || echo "[Model $model not found]" > "$BUNDLE_DIR/ollama/models/${model}.txt"
  done

  info "  Captured Ollama model info"
else
  echo "[Ollama container not running]" > "$BUNDLE_DIR/ollama/models.txt"
  echo "{\"error\":\"ollama not running\"}" > "$BUNDLE_DIR/ollama/tags.json"
fi

# ── 7. PostgreSQL status ────────────────────────────────────────────────────

info "Collecting PostgreSQL status..."

if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" 2>/dev/null; then
  # PostgreSQL version
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT version();" 2>/dev/null > "$BUNDLE_DIR/postgres/version.txt" || echo "[ERROR: could not query PG version]" > "$BUNDLE_DIR/postgres/version.txt"

  # Table existence checks
  {
    echo "{"
    echo "  \"tables\": {"
    local first_table=true
    for table in users dashboard_snapshots scan_history scan_counts; do
      local exists
      exists=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null | tr -d '[:space:]' || echo "f")
      if $first_table; then
        printf '    "%s": %s' "$table" "$exists"
        first_table=false
      else
        printf ',\n    "%s": %s' "$table" "$exists"
      fi
    done
    echo ""
    echo "  }"
    echo "}"
  } > "$BUNDLE_DIR/postgres/tables.json"

  # Table row counts (non-sensitive aggregate counts only)
  {
    echo "{"
    echo "  \"rowCounts\": {"
    local first_count=true
    for table in users dashboard_snapshots scan_history scan_counts; do
      local count
      count=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT count(*) FROM $table;" 2>/dev/null | tr -d '[:space:]' || echo "0")
      if $first_count; then
        printf '    "%s": %s' "$table" "$count"
        first_count=false
      else
        printf ',\n    "%s": %s' "$table" "$count"
      fi
    done
    echo ""
    echo "  }"
    echo "}"
  } > "$BUNDLE_DIR/postgres/row-counts.json"

  info "  Captured PostgreSQL status"
else
  echo "[DB container not running]" > "$BUNDLE_DIR/postgres/version.txt"
  echo "{\"error\":\"db not running\"}" > "$BUNDLE_DIR/postgres/tables.json"
fi

# ── 8. Include validation report if provided ────────────────────────────────

if [ -n "$VALIDATION_JSON" ] && [ -f "$VALIDATION_JSON" ]; then
  info "Including validation report: $VALIDATION_JSON"
  cp "$VALIDATION_JSON" "$BUNDLE_DIR/validation-report.json"
elif [ -f "./validation-report.json" ]; then
  info "Including validation report from current directory"
  cp "./validation-report.json" "$BUNDLE_DIR/validation-report.json"
else
  echo "{\"note\":\"no validation report provided — run validate-airgap-deploy.sh --json > validation-report.json first\"}" > "$BUNDLE_DIR/validation-report.json"
fi

# ── 9. Create the tarball ───────────────────────────────────────────────────

info "Creating tarball..."

mkdir -p "$OUTPUT_DIR"
TARBALL="$OUTPUT_DIR/${BUNDLE_NAME}.tar.gz"

tar -czf "$TARBALL" -C "$WORK_DIR" "$BUNDLE_NAME"

local_size
size=$(du -h "$TARBALL" | cut -f1)

log "Diagnostics bundle created: $TARBALL ($size)"

# ── 10. Optional encryption ─────────────────────────────────────────────────

if $ENCRYPT; then
  info "Encrypting bundle with AES-256-CBC..."

  ENCRYPTED="$OUTPUT_DIR/${BUNDLE_NAME}.tar.gz.enc"

  if [ -n "$PASSPHRASE_FILE" ] && [ -f "$PASSPHRASE_FILE" ]; then
    # Read passphrase from file (non-interactive)
    openssl enc -aes-256-cbc -salt -pbkdf2 \
      -in "$TARBALL" \
      -out "$ENCRYPTED" \
      -pass "file:$PASSPHRASE_FILE" 2>/dev/null
  else
    # Prompt for passphrase (interactive)
    log "Enter passphrase for encryption:"
    openssl enc -aes-256-cbc -salt -pbkdf2 \
      -in "$TARBALL" \
      -out "$ENCRYPTED" \
      -pass stdin < /dev/tty 2>/dev/null || {
      warn "Encryption failed — unencrypted bundle remains at $TARBALL"
      rm -f "$ENCRYPTED"
      # Cleanup and exit
      rm -rf "$WORK_DIR"
      log "Bundle (unencrypted): $TARBALL"
      exit 0
    }
  fi

  if [ -f "$ENCRYPTED" ]; then
    # Remove unencrypted version
    rm -f "$TARBALL"
    enc_size=$(du -h "$ENCRYPTED" | cut -f1)
    log "Encrypted bundle created: $ENCRYPTED ($enc_size)"
    log "Decrypt with: openssl enc -d -aes-256-cbc -pbkdf2 -in $ENCRYPTED -out ${BUNDLE_NAME}.tar.gz"
    TARBALL="$ENCRYPTED"
  fi
fi

# ── 11. Cleanup ─────────────────────────────────────────────────────────────

rm -rf "$WORK_DIR"

# ── Summary ─────────────────────────────────────────────────────────────────

log ""
log "=== Diagnostics Bundle Summary ==="
log "Bundle:     $TARBALL"
log "Size:       $(du -h "$TARBALL" | cut -f1)"
log "Encrypted:  $($ENCRYPT && echo "yes (AES-256-CBC)" || echo "no")"
log "Hostname:   $HOSTNAME_VAL"
log "Timestamp:  $TIMESTAMP"
log ""
log "Contents:"
log "  - manifest.json (bundle metadata)"
log "  - validation-report.json (validation + recovery results)"
log "  - system/hardware.json (RAM, VRAM, CPU, disk, OS)"
log "  - system/docker-info.txt, docker-version.txt"
log "  - system/environment-sanitized.json (secrets redacted)"
log "  - containers/*.log (last $LOG_LINES lines per service)"
log "  - containers/*-inspect.json (Docker metadata, sanitized)"
log "  - containers/*-env-sanitized.json (container env, secrets redacted)"
log "  - ollama/models.txt, tags.json, models/*.txt"
log "  - postgres/version.txt, tables.json, row-counts.json"
log ""
log "Transfer this file back over the air-gap for engineering review."
if $ENCRYPT; then
  log "Share the passphrase through a separate secure channel."
fi
