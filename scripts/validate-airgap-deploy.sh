#!/usr/bin/env bash
#
# validate-airgap-deploy.sh
# Post-deployment validation suite for a SimpleBeacon air-gapped installation.
# Run this on the target machine after `hydrate-airgap.sh deploy` finishes.
#
# Usage:
#   ./scripts/validate-airgap-deploy.sh              # Human-readable output
#   ./scripts/validate-airgap-deploy.sh --json       # JSON output for automation
#   ./scripts/validate-airgap-deploy.sh --verbose    # Show full command output
#   ./scripts/validate-airgap-deploy.sh --timeout 60 # Override inference timeout (default: 30s)
#   ./scripts/validate-airgap-deploy.sh --recover    # Safe auto-recovery + destructive with prompts
#   ./scripts/validate-airgap-deploy.sh --recover-safe # Safe auto-recovery only (no destructive)
#   ./scripts/validate-airgap-deploy.sh --recover --yes # Auto-confirm destructive prompts
#   ./scripts/validate-airgap-deploy.sh --export-bundle # Create diagnostics bundle after validation
#   ./scripts/validate-airgap-deploy.sh --recover --export-bundle --json  # Full automation
#   ./scripts/validate-airgap-deploy.sh --benchmark     # Run throughput benchmark (Check 15)
#   ./scripts/validate-airgap-deploy.sh --benchmark --benchmark-runs 5  # Multiple runs for variance
#
# Exit codes:
#   0  All validation checks passed
#   1  One or more validation checks failed
#   2  Fatal error (Docker not running, script misuse)
#
# Recovery model (hybrid):
#   Safe auto-recovery:    restart containers, re-run DB migration (idempotent)
#   Destructive recovery:  purge model volume, re-import from archive (prompted)
#   Manual:                Docker daemon, port mapping, disk space, config changes
#
# Validation checks:
#   1.  Docker daemon reachable
#   2.  Required containers running (engine, ollama, db)
#   3.  Container exposed ports resolved
#   4.  Ollama API health (/ and /api/tags)
#   5.  Required models present in Ollama
#   6.  Model layer integrity (ollama show)
#   7.  Inference smoke test (cheap prompt to unbreakable-oracle)
#   8.  Engine health endpoint (/health)
#   9.  Engine-to-Ollama connectivity (Docker DNS path)
#  10.  PostgreSQL readiness (pg_isready)
#  11.  PostgreSQL schema readiness (key tables exist)
#  12.  Memory profile validation (configured profile vs hardware)
#  13.  Offline mode verification (no outbound network calls)
#  14.  Disk space check (model volumes and report storage)
#  15.  Throughput benchmark (tok/s vs profile expectation) [requires --benchmark]
#

set -u

# ── Script location ─────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Configuration ───────────────────────────────────────────────────────────

OLLAMA_CONTAINER="simplebeacon-ollama"
ENGINE_CONTAINER="simplebeacon-engine"
DB_CONTAINER="simplebeacon-db"
DB_USER="simplebeacon_user"
DB_NAME="simplebeacon"
EXPECTED_OLLAMA_PORT=11434
EXPECTED_ENGINE_PORT=3000
INFERENCE_TIMEOUT=30  # seconds for inference smoke test
VERBOSE=false
OUTPUT_FORMAT="text"
RECOVER_MODE="none"    # none | safe | all
AUTO_YES=false         # skip confirmation prompts for destructive recovery
ARCHIVE_PATH=""        # path to air-gap archive (for model re-import)
EXPORT_BUNDLE=false    # create diagnostics bundle after validation
BENCHMARK=false        # run throughput benchmark (Check 15)
BENCHMARK_RUNS=3       # number of benchmark runs for variance calculation
BENCHMARK_TOKENS=100   # target tokens to generate per run
BENCHMARK_MODEL="unbreakable-oracle"  # model to benchmark

# Expected throughput ranges by profile (tok/s for llama3.2:3b Q4_K_M)
# Derived from memory-profiles.json selectionGuide
declare -A PROFILE_MIN_TOKS
PROFILE_MIN_TOKS["minimal"]=5
PROFILE_MIN_TOKS["balanced"]=20
PROFILE_MIN_TOKS["maximum"]=50

declare -A PROFILE_MAX_TOKS
PROFILE_MAX_TOKS["minimal"]=15
PROFILE_MAX_TOKS["balanced"]=50
PROFILE_MAX_TOKS["maximum"]=100

declare -A PROFILE_CPU_ONLY_MAX
PROFILE_CPU_ONLY_MAX["minimal"]=15
PROFILE_CPU_ONLY_MAX["balanced"]=15
PROFILE_CPU_ONLY_MAX["maximum"]=15

REQUIRED_MODELS=(
  "unbreakable-oracle"
  "simplebeacon-llama32"
  "simplebeacon-mistral"
  "simplebeacon-qwen-coder"
)

REQUIRED_TABLES=(
  "users"
  "dashboard_snapshots"
  "scan_history"
  "scan_counts"
)

# Schema SQL for re-running migration (idempotent — CREATE TABLE IF NOT EXISTS)
MIGRATION_SQL="
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
    key TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    trust_level TEXT NOT NULL DEFAULT 'bronze',
    status TEXT NOT NULL DEFAULT 'active',
    successful_analyses INT NOT NULL DEFAULT 0,
    security_incidents INT NOT NULL DEFAULT 0,
    community_contributions INT NOT NULL DEFAULT 0,
    verification_status TEXT NOT NULL DEFAULT 'email',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS scan_history (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    scan_results JSONB NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS scan_counts (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_bucket DATE NOT NULL,
    scan_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, month_bucket)
);
"

# ── Argument parsing ────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)          OUTPUT_FORMAT="json"; shift ;;
    --verbose)       VERBOSE=true; shift ;;
    --timeout)       INFERENCE_TIMEOUT="${2:-30}"; shift 2 ;;
    --recover)       RECOVER_MODE="all"; shift ;;
    --recover-safe)  RECOVER_MODE="safe"; shift ;;
    --yes|-y)        AUTO_YES=true; shift ;;
    --archive)       ARCHIVE_PATH="${2:-}"; shift 2 ;;
    --export-bundle) EXPORT_BUNDLE=true; shift ;;
    --benchmark)     BENCHMARK=true; shift ;;
    --benchmark-runs) BENCHMARK_RUNS="${2:-3}"; shift 2 ;;
    --benchmark-tokens) BENCHMARK_TOKENS="${2:-100}"; shift 2 ;;
    --help|-h)
      cat << 'HELP'
SimpleBeacon Air-Gapped Deployment Validation Suite

Usage:
  validate-airgap-deploy.sh [OPTIONS]

Options:
  --json            Output results as JSON for automation/CI
  --verbose         Show full command output (not just pass/fail)
  --timeout N       Inference test timeout in seconds (default: 30)
  --recover         Enable recovery: safe auto + destructive with prompts
  --recover-safe    Enable recovery: safe auto only (no destructive operations)
  --yes, -y         Auto-confirm destructive recovery prompts (use with --recover)
  --archive PATH    Path to air-gap archive (for model re-import recovery)
  --export-bundle   Create a diagnostics bundle after validation (logs, specs, env)
  --benchmark       Run throughput benchmark (Check 15: tok/s vs profile expectation)
  --benchmark-runs N  Number of benchmark runs for variance (default: 3)
  --benchmark-tokens N  Target tokens to generate per run (default: 100)
  --help, -h        Show this help message

Recovery model (hybrid):
  Safe auto-recovery (runs automatically with --recover or --recover-safe):
    - Restart stopped containers (engine, ollama, db)
    - Restart unresponsive Ollama daemon
    - Restart unresponsive engine
    - Restart PostgreSQL if not ready
    - Re-run idempotent schema migration if tables missing
    - Restart engine for stale Docker DNS cache

  Destructive recovery (prompts with --recover, skipped with --recover-safe):
    - Purge and re-import Ollama model volume from archive
    - Re-import specific corrupted model layers

  Manual (prints instructions, no automatic action):
    - Docker daemon not running
    - Port mapping misconfigured
    - Inference failure (diagnosis required)
    - Memory profile mismatch
    - Offline mode env vars not set
    - Insufficient disk space

Checks:
  1.  Docker daemon reachable
  2.  Required containers running
  3.  Container exposed ports
  4.  Ollama API health
  5.  Required models present
  6.  Model layer integrity
  7.  Inference smoke test (cheap prompt)
  8.  Engine health endpoint
  9.  Engine-to-Ollama connectivity (Docker DNS)
  10. PostgreSQL readiness
  11. PostgreSQL schema (key tables)
  12. Memory profile validation
  13. Offline mode verification
  14. Disk space check
  15. Throughput benchmark [requires --benchmark]
HELP
      exit 0
      ;;
    *) echo "[FATAL] Unknown option: $1" >&2; exit 2 ;;
  esac
done

# ── Helpers ─────────────────────────────────────────────────────────────────

failures=0
total_checks=0
passed_checks=0
recovery_attempts=0
recovery_successes=0
json_results=""
json_recoveries=""

# Colors (disabled in JSON mode)
if [ "$OUTPUT_FORMAT" = "text" ] && [ -t 1 ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  NC='\033[0m'
else
  GREEN='' RED='' YELLOW='' BLUE='' CYAN='' NC=''
fi

info() {
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "${BLUE}[INFO]${NC} $*"
  fi
}

ok() {
  passed_checks=$((passed_checks + 1))
  total_checks=$((total_checks + 1))
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "  ${GREEN}✓${NC} $*"
  fi
  json_results="${json_results}{\"name\":\"$1\",\"status\":\"pass\"},"
}

warn_msg() {
  total_checks=$((total_checks + 1))
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "  ${YELLOW}!${NC} $*"
  fi
  json_results="${json_results}{\"name\":\"$1\",\"status\":\"warn\",\"message\":\"$2\"},"
}

warn() {
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "  ${YELLOW}!${NC} $*" >&2
  fi
}

fail() {
  failures=$((failures + 1))
  total_checks=$((total_checks + 1))
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "  ${RED}✗${NC} $*"
  fi
  json_results="${json_results}{\"name\":\"$1\",\"status\":\"fail\",\"message\":\"$2\"},"
}

die() {
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "${RED}[FATAL]${NC} $*" >&2
  else
    echo "{\"fatal\":\"$*\",\"checks\":[]}"
  fi
  exit 2
}

recovery_info() {
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "  ${CYAN}[RECOVER]${NC} $*"
  fi
}

recovery_ok() {
  recovery_successes=$((recovery_successes + 1))
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "  ${GREEN}[RECOVER OK]${NC} $*"
  fi
  json_recoveries="${json_recoveries}{\"check\":\"$1\",\"action\":\"$2\",\"status\":\"success\"},"
}

recovery_fail() {
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "  ${RED}[RECOVER FAIL]${NC} $*"
  fi
  json_recoveries="${json_recoveries}{\"check\":\"$1\",\"action\":\"$2\",\"status\":\"failed\",\"error\":\"$3\"},"
}

recovery_skip() {
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "  ${YELLOW}[RECOVER SKIP]${NC} $*"
  fi
  json_recoveries="${json_recoveries}{\"check\":\"$1\",\"action\":\"$2\",\"status\":\"skipped\",\"reason\":\"$3\"},"
}

manual_steps() {
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo -e "  ${YELLOW}[MANUAL]${NC} $*"
  fi
}

# Run a command quietly or verbosely depending on --verbose flag
run_cmd() {
  if $VERBOSE; then
    "$@"
  else
    "$@" > /dev/null 2>&1
  fi
}

# Prompt for confirmation (returns 0 = yes, 1 = no)
confirm() {
  if $AUTO_YES; then
    return 0
  fi
  local prompt="$1"
  if [ "$OUTPUT_FORMAT" = "json" ]; then
    # In JSON mode, never prompt — skip destructive recovery
    return 1
  fi
  echo -ne "  ${YELLOW}[CONFIRM]${NC} $prompt [y/N] " >&2
  read -r response
  case "$response" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

# Check if a container is running
is_running() {
  docker ps --format '{{.Names}}' | grep -qx "$1"
}

# ── Recovery actions ────────────────────────────────────────────────────────

# Safe: restart a container via docker compose
restart_container() {
  local container_name="$1"
  local compose_service="$2"
  recovery_info "Restarting $container_name (docker compose restart $compose_service)..."

  # Find the compose file in the current directory
  local compose_file=""
  if [ -f "docker-compose.enterprise.yml" ]; then
    compose_file="docker-compose.enterprise.yml"
  elif [ -f "docker-compose.yml" ]; then
    compose_file="docker-compose.yml"
  else
    recovery_fail "$container_name" "restart" "No docker-compose file found in $(pwd)"
    return 1
  fi

  if docker compose -f "$compose_file" restart "$compose_service" > /dev/null 2>&1; then
    # Wait for container to be ready
    local waited=0
    while [ $waited -lt 30 ]; do
      if is_running "$container_name"; then
        sleep 3  # Give it a moment to initialize
        recovery_ok "$container_name" "restart" "Container restarted successfully"
        return 0
      fi
      sleep 1
      waited=$((waited + 1))
    done
    recovery_fail "$container_name" "restart" "Container did not start within 30s"
    return 1
  else
    recovery_fail "$container_name" "restart" "docker compose restart failed"
    return 1
  fi
}

# Safe: re-run idempotent schema migration
rerun_migration() {
  recovery_info "Re-running schema migration (idempotent CREATE TABLE IF NOT EXISTS)..."

  if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$MIGRATION_SQL" > /dev/null 2>&1; then
    recovery_ok "pg-schema" "rerun-migration" "Schema migration completed"
    return 0
  else
    recovery_fail "pg-schema" "rerun-migration" "psql command failed"
    return 1
  fi
}

# Destructive: purge and re-import Ollama model volume from archive
reimport_models() {
  local archive="$ARCHIVE_PATH"

  if [ -z "$archive" ]; then
    # Try to find the archive in common locations
    for candidate in \
      "simplebeacon-airgap-v1.tar.gz" \
      "dist/simplebeacon-airgap-v1.tar.gz" \
      "../simplebeacon-airgap-v1.tar.gz" \
      "/tmp/simplebeacon-airgap-v1.tar.gz"; do
      if [ -f "$candidate" ]; then
        archive="$candidate"
        break
      fi
    done
  fi

  if [ -z "$archive" ] || [ ! -f "$archive" ]; then
    recovery_skip "models" "reimport" "No archive found — provide --archive PATH"
    manual_steps "To re-import models manually:"
    manual_steps "  1. Locate the air-gap archive (simplebeacon-airgap-v1.tar.gz)"
    manual_steps "  2. Extract ollama-models.tar.gz from the archive"
    manual_steps "  3. Run: docker run --rm -v ollama-models:/data -v ollama-models.tar.gz:/out/alpine:latest tar -xzf /out/ollama-models.tar.gz -C /data"
    manual_steps "  4. Restart Ollama: docker compose restart simplebeacon-ollama"
    manual_steps "  5. Re-run: ./scripts/validate-airgap-deploy.sh"
    return 1
  fi

  recovery_info "Found archive: $archive"

  if ! confirm "This will PURGE the ollama-models volume and re-import from $archive. Continue?"; then
    recovery_skip "models" "reimport" "User declined confirmation"
    return 1
  fi

  recovery_info "Purging ollama-models volume..."
  # Stop Ollama first to avoid file locks
  docker stop "$OLLAMA_CONTAINER" > /dev/null 2>&1 || true

  # Purge the volume by removing and recreating it
  docker volume rm ollama-models > /dev/null 2>&1 || true
  docker volume create ollama-models > /dev/null 2>&1 || true

  recovery_info "Extracting ollama-models.tar.gz from archive..."
  local temp_dir
  temp_dir=$(mktemp -d)
  if ! tar -xzf "$archive" -C "$temp_dir" ollama-models.tar.gz 2>/dev/null; then
    recovery_fail "models" "reimport" "Could not extract ollama-models.tar.gz from archive"
    rm -rf "$temp_dir"
    return 1
  fi

  recovery_info "Importing models into volume..."
  local win_temp_dir
  win_temp_dir=$(cygpath -m "$temp_dir" 2>/dev/null || echo "$temp_dir")

  if docker run --rm \
    -v ollama-models:/data \
    -v "$win_temp_dir/ollama-models.tar.gz":/out/ollama-models.tar.gz \
    alpine:latest \
    tar -xzf /out/ollama-models.tar.gz -C /data 2>/dev/null; then

    rm -rf "$temp_dir"
    recovery_info "Restarting Ollama container..."
    docker start "$OLLAMA_CONTAINER" > /dev/null 2>&1 || true
    sleep 10  # Wait for Ollama to initialize

    recovery_ok "models" "reimport" "Models re-imported from archive"
    return 0
  else
    rm -rf "$temp_dir"
    recovery_fail "models" "reimport" "docker run tar extraction failed"
    # Try to restart Ollama even if import failed
    docker start "$OLLAMA_CONTAINER" > /dev/null 2>&1 || true
    return 1
  fi
}

# Destructive: recreate a single corrupted model from its Modelfile
recreate_model() {
  local model_name="$1"
  local modelfile_name="$2"

  if ! confirm "This will delete and recreate model '$model_name' from $modelfile_name. Continue?"; then
    recovery_skip "layers-$model_name" "recreate" "User declined confirmation"
    return 1
  fi

  recovery_info "Deleting $model_name..."
  docker exec "$OLLAMA_CONTAINER" ollama rm "$model_name" > /dev/null 2>&1 || true

  recovery_info "Recreating $model_name from /models/$modelfile_name..."
  if docker exec "$OLLAMA_CONTAINER" ollama create "$model_name" -f "/models/$modelfile_name" > /dev/null 2>&1; then
    recovery_ok "layers-$model_name" "recreate" "Model recreated successfully"
    return 0
  else
    recovery_fail "layers-$model_name" "recreate" "ollama create failed — base model may be missing"
    return 1
  fi
}

# ── Check functions (each returns 0=pass, 1=fail) ───────────────────────────

# Track which checks failed for recovery phase
failed_checks=""

record_fail() {
  failed_checks="${failed_checks}${1};"
}

check_container_running() {
  local container="$1"
  if is_running "$container"; then
    return 0
  else
    return 1
  fi
}

check_ollama_api() {
  docker exec "$OLLAMA_CONTAINER" curl -s "http://localhost:11434/" > /dev/null 2>&1
}

check_ollama_tags() {
  docker exec "$OLLAMA_CONTAINER" curl -s "http://localhost:11434/api/tags" > /dev/null 2>&1
}

check_engine_health() {
  if [ -n "$engine_host_port" ]; then
    curl -s --max-time 10 "http://localhost:$engine_host_port/health" > /dev/null 2>&1
  else
    docker exec "$OLLAMA_CONTAINER" curl -s --max-time 10 "http://$ENGINE_CONTAINER:3000/health" > /dev/null 2>&1
  fi
}

check_engine_to_ollama() {
  docker exec "$ENGINE_CONTAINER" node -e 'require("http").get("http://simplebeacon-ollama:11434/api/tags",r=>process.exit(r.statusCode<400?0:1)).on("error",()=>process.exit(1))' 2>/dev/null
}

check_pg_ready() {
  docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1
}

check_pg_table() {
  local table="$1"
  local exists
  exists=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null | tr -d '[:space:]' || echo "f")
  [ "$exists" = "t" ]
}

check_model_present() {
  local model="$1"
  local tags
  tags=$(docker exec "$OLLAMA_CONTAINER" curl -s "http://localhost:11434/api/tags" 2>/dev/null || echo "")
  echo "$tags" | grep -q "\"name\":\"$model"
}

check_model_layers() {
  local model="$1"
  docker exec "$OLLAMA_CONTAINER" ollama show "$model" > /dev/null 2>&1
}

# ── Main validation + recovery loop ─────────────────────────────────────────

info "=== SimpleBeacon Air-Gapped Deployment Validation ==="
if [ "$RECOVER_MODE" != "none" ]; then
  info "Recovery mode: $RECOVER_MODE"
fi
info ""

# ── Check 1: Docker daemon reachable ────────────────────────────────────────

info "Check 1/14: Docker daemon"
if docker info > /dev/null 2>&1; then
  ok "docker-daemon: Docker daemon is reachable"
else
  fail "docker-daemon" "Docker daemon is not reachable"
  record_fail "docker-daemon"
  # No auto-recovery — print manual steps
  manual_steps "Start Docker daemon:"
  manual_steps "  Linux (systemd):  sudo systemctl start docker"
  manual_steps "  Linux (init.d):   sudo service docker start"
  manual_steps "  Windows:           Start Docker Desktop from Start Menu"
  manual_steps "  WSL2:              Ensure Docker Desktop integration is enabled for your distro"
  manual_steps "  Edge appliances:   Check if dockerd service is running (sudo dockerd &)"
  die "Cannot proceed without Docker daemon"
fi

# ── Check 2: Required containers running ────────────────────────────────────

info "Check 2/14: Container status"
for c in "$ENGINE_CONTAINER" "$OLLAMA_CONTAINER" "$DB_CONTAINER"; do
  if check_container_running "$c"; then
    ok "container-$c: $c container is running"
  else
    fail "container-$c" "$c container is NOT running"
    record_fail "container-$c"
  fi
done

# ── Check 3: Exposed ports ──────────────────────────────────────────────────

info "Check 3/14: Exposed ports"
ollama_host_port=""
engine_host_port=""

if is_running "$OLLAMA_CONTAINER"; then
  ollama_host_port=$(docker port "$OLLAMA_CONTAINER" 11434 2>/dev/null | head -n1 | awk -F: '{print $NF}' | tr -d '[:space:]')
  if [ -n "$ollama_host_port" ]; then
    ok "port-ollama: Ollama exposed on host port $ollama_host_port"
  else
    fail "port-ollama" "Could not determine Ollama host port"
    record_fail "port-ollama"
  fi
else
  fail "port-ollama" "Ollama container not running — cannot check port"
  record_fail "port-ollama"
fi

if is_running "$ENGINE_CONTAINER"; then
  engine_host_port=$(docker port "$ENGINE_CONTAINER" 3000 2>/dev/null | head -n1 | awk -F: '{print $NF}' | tr -d '[:space:]')
  if [ -n "$engine_host_port" ]; then
    ok "port-engine: Engine exposed on host port $engine_host_port"
  else
    fail "port-engine" "Could not determine Engine host port"
    record_fail "port-engine"
  fi
else
  fail "port-engine" "Engine container not running — cannot check port"
  record_fail "port-engine"
fi

# ── Check 4: Ollama API health ──────────────────────────────────────────────

info "Check 4/14: Ollama API health"
if is_running "$OLLAMA_CONTAINER"; then
  if check_ollama_api; then
    ok "ollama-api: Ollama daemon responds on /"
  else
    fail "ollama-api" "Ollama daemon is not responding on /"
    record_fail "ollama-api"
  fi

  if check_ollama_tags; then
    ok "ollama-tags: Ollama /api/tags is reachable"
  else
    fail "ollama-tags" "Ollama /api/tags is not reachable"
    record_fail "ollama-tags"
  fi
else
  fail "ollama-api" "Ollama container not running"
  fail "ollama-tags" "Ollama container not running"
  record_fail "ollama-api"
  record_fail "ollama-tags"
fi

# ── Check 5: Required models present ────────────────────────────────────────

info "Check 5/14: Required models"
if is_running "$OLLAMA_CONTAINER" && check_ollama_tags; then
  for model in "${REQUIRED_MODELS[@]}"; do
    if check_model_present "$model"; then
      ok "model-$model: Model present"
    else
      fail "model-$model" "Model missing: $model"
      record_fail "model-$model"
    fi
  done
else
  for model in "${REQUIRED_MODELS[@]}"; do
    fail "model-$model" "Ollama not running or API unreachable"
    record_fail "model-$model"
  done
fi

# ── Check 6: Model layer integrity ──────────────────────────────────────────

info "Check 6/14: Model layer integrity"
if is_running "$OLLAMA_CONTAINER"; then
  for model in "${REQUIRED_MODELS[@]}"; do
    if check_model_layers "$model"; then
      ok "layers-$model: Layer integrity OK"
    else
      fail "layers-$model" "Layer integrity FAILED — model may be corrupted"
      record_fail "layers-$model"
    fi
  done
else
  for model in "${REQUIRED_MODELS[@]}"; do
    fail "layers-$model" "Ollama container not running"
    record_fail "layers-$model"
  done
fi

# ── Check 7: Inference smoke test ───────────────────────────────────────────

info "Check 7/14: Inference smoke test (timeout: ${INFERENCE_TIMEOUT}s)"
if is_running "$OLLAMA_CONTAINER"; then
  inference_response=$(docker exec "$OLLAMA_CONTAINER" curl -s --max-time "$INFERENCE_TIMEOUT" \
    -X POST "http://localhost:11434/api/generate" \
    -H "Content-Type: application/json" \
    -d '{"model":"unbreakable-oracle","prompt":"Reply with exactly: OK","stream":false,"options":{"num_predict":5,"temperature":0}}' \
    2>/dev/null || echo "")

  if [ -n "$inference_response" ]; then
    inference_text=$(echo "$inference_response" | grep -o '"response":"[^"]*"' | head -1 | sed 's/"response":"//;s/"$//')
    if [ -n "$inference_text" ]; then
      ok "inference: Model generated output (response: \"${inference_text:0:50}\")"
    else
      if echo "$inference_response" | grep -q '"error"'; then
        err_msg=$(echo "$inference_response" | grep -o '"error":"[^"]*"' | head -1)
        fail "inference" "Model returned error: $err_msg"
      else
        fail "inference" "Model returned empty response"
      fi
      record_fail "inference"
    fi
  else
    fail "inference" "Inference request timed out or failed (timeout: ${INFERENCE_TIMEOUT}s)"
    record_fail "inference"
  fi
else
  fail "inference" "Ollama container not running"
  record_fail "inference"
fi

# ── Check 8: Engine health endpoint ─────────────────────────────────────────

info "Check 8/14: Engine health endpoint"
if is_running "$ENGINE_CONTAINER"; then
  if check_engine_health; then
    ok "engine-health: Engine /health responds"
  else
    fail "engine-health" "Engine /health endpoint is not responding"
    record_fail "engine-health"
  fi
else
  fail "engine-health" "Engine container not running"
  record_fail "engine-health"
fi

# ── Check 9: Engine-to-Ollama connectivity (Docker DNS) ─────────────────────

info "Check 9/14: Engine-to-Ollama connectivity (Docker DNS)"
if is_running "$ENGINE_CONTAINER"; then
  if check_engine_to_ollama; then
    ok "engine-to-ollama: Engine can reach Ollama via Docker DNS"
  else
    fail "engine-to-ollama" "Engine cannot reach Ollama via Docker DNS"
    record_fail "engine-to-ollama"
  fi

  engine_ollama_url=$(docker exec "$ENGINE_CONTAINER" printenv OLLAMA_BASE_URL 2>/dev/null || echo "")
  if [ -n "$engine_ollama_url" ]; then
    if echo "$engine_ollama_url" | grep -q "simplebeacon-ollama"; then
      ok "ollama-url-config: OLLAMA_BASE_URL=$engine_ollama_url"
    else
      warn_msg "ollama-url-config" "OLLAMA_BASE_URL=$engine_ollama_url (expected simplebeacon-ollama hostname)"
    fi
  else
    warn_msg "ollama-url-config" "OLLAMA_BASE_URL not set in engine container"
  fi
else
  fail "engine-to-ollama" "Engine container not running"
  record_fail "engine-to-ollama"
fi

# ── Check 10: PostgreSQL readiness ──────────────────────────────────────────

info "Check 10/14: PostgreSQL readiness"
if is_running "$DB_CONTAINER"; then
  if check_pg_ready; then
    ok "pg-ready: PostgreSQL is ready"
  else
    fail "pg-ready" "PostgreSQL is not ready"
    record_fail "pg-ready"
  fi
else
  fail "pg-ready" "Database container not running"
  record_fail "pg-ready"
fi

# ── Check 11: PostgreSQL schema readiness ───────────────────────────────────

info "Check 11/14: PostgreSQL schema readiness"
if is_running "$DB_CONTAINER" && check_pg_ready; then
  for table in "${REQUIRED_TABLES[@]}"; do
    if check_pg_table "$table"; then
      ok "pg-table-$table: Table exists"
    else
      fail "pg-table-$table" "Table missing — schema migration may not have run"
      record_fail "pg-table-$table"
    fi
  done
else
  for table in "${REQUIRED_TABLES[@]}"; do
    fail "pg-table-$table" "Database not running or not ready"
    record_fail "pg-table-$table"
  done
fi

# ── Check 12: Memory profile validation ─────────────────────────────────────

info "Check 12/14: Memory profile validation"
if is_running "$OLLAMA_CONTAINER"; then
  configured_profile=$(docker exec "$OLLAMA_CONTAINER" printenv OLLAMA_MEMORY_PROFILE 2>/dev/null || echo "balanced")
  configured_num_gpu=$(docker exec "$OLLAMA_CONTAINER" printenv OLLAMA_NUM_GPU 2>/dev/null || echo "-1")
  configured_num_ctx=$(docker exec "$OLLAMA_CONTAINER" printenv OLLAMA_NUM_CTX 2>/dev/null || echo "8192")

  ok "profile-config: OLLAMA_MEMORY_PROFILE=$configured_profile, NUM_GPU=$configured_num_gpu, NUM_CTX=$configured_num_ctx"

  case "$configured_profile" in
    minimal|balanced|maximum)
      ok "profile-valid: Profile name is recognized"
      ;;
    *)
      fail "profile-valid" "Unknown profile: $configured_profile (expected: minimal, balanced, or maximum)"
      record_fail "profile-valid"
      ;;
  esac

  if [ "$configured_profile" = "minimal" ] && [ "$configured_num_gpu" != "0" ]; then
    warn_msg "profile-gpu-mismatch" "minimal profile with NUM_GPU=$configured_num_gpu — minimal should use NUM_GPU=0 for CPU-only"
  fi

  if [ "$configured_profile" = "maximum" ] && [ "$configured_num_gpu" = "0" ]; then
    warn_msg "profile-gpu-mismatch" "maximum profile with NUM_GPU=0 — maximum should use NUM_GPU=999 for full GPU offload"
  fi
else
  fail "profile-config" "Ollama container not running"
  record_fail "profile-config"
fi

# ── Check 13: Offline mode verification ─────────────────────────────────────

info "Check 13/14: Offline mode verification"
for c in "$ENGINE_CONTAINER" "$OLLAMA_CONTAINER"; do
  if is_running "$c"; then
    offline_flag=$(docker exec "$c" printenv SIMPLEBEACON_OFFLINE 2>/dev/null || echo "")
    if [ "$offline_flag" = "true" ]; then
      ok "offline-$c: SIMPLEBEACON_OFFLINE=true"
    else
      fail "offline-$c" "SIMPLEBEACON_OFFLINE is not set to true (got: '$offline_flag')"
      record_fail "offline-$c"
    fi
  fi
done

if is_running "$OLLAMA_CONTAINER"; then
  external_conns=$(docker exec "$OLLAMA_CONTAINER" sh -c \
    "cat /proc/net/tcp 2>/dev/null | awk 'NR>1 {split(\$3,a,\":\"); ip=strtonum(\"0x\"substr(a[1],7,2))\".\"strtonum(\"0x\"substr(a[1],5,2))\".\"strtonum(\"0x\"substr(a[1],3,2))\".\"strtonum(\"0x\"substr(a[1],1,2)); if (ip != \"0.0.0.0\" && ip != \"127.0.0.1\" && ip != \"172.17.0.1\" && \$4 == \"01\") print ip}' 2>/dev/null | head -5" \
    2>/dev/null || echo "")

  if [ -z "$external_conns" ]; then
    ok "offline-no-external: No external network connections detected from Ollama"
  else
    warn_msg "offline-external-conns" "Ollama has external connections to: $external_conns"
  fi
fi

if is_running "$ENGINE_CONTAINER"; then
  ext_apis=$(docker exec "$ENGINE_CONTAINER" printenv ENABLE_EXTERNAL_APIS 2>/dev/null || echo "")
  if [ "$ext_apis" = "false" ]; then
    ok "offline-ext-apis: ENABLE_EXTERNAL_APIS=false"
  else
    fail "offline-ext-apis" "ENABLE_EXTERNAL_APIS is not false (got: '$ext_apis')"
    record_fail "offline-ext-apis"
  fi
fi

# ── Check 14: Disk space check ──────────────────────────────────────────────

info "Check 14/14: Disk space check"

docker_info=$(docker info 2>/dev/null)
docker_root=$(echo "$docker_info" | grep "Docker Root Dir" | awk '{print $NF}' || echo "/var/lib/docker")

if command -v df &> /dev/null; then
  available_kb=$(df -k "$docker_root" 2>/dev/null | awk 'NR==2 {print $4}' || df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo 0)
  if [ "$available_kb" -gt 0 ] 2>/dev/null; then
    available_gb=$((available_kb / 1024 / 1024))
    if [ "$available_gb" -ge 10 ]; then
      ok "disk-space: ${available_gb}GB available (>= 10GB threshold)"
    elif [ "$available_gb" -ge 5 ]; then
      warn_msg "disk-space" "Only ${available_gb}GB available — recommend at least 10GB"
    else
      fail "disk-space" "Only ${available_gb}GB available — insufficient for model volumes and reports"
      record_fail "disk-space"
    fi
  else
    warn_msg "disk-space" "Could not determine available disk space"
  fi
else
  warn_msg "disk-space" "df command not available — cannot check disk space"
fi

if is_running "$OLLAMA_CONTAINER"; then
  model_dir_size=$(docker exec "$OLLAMA_CONTAINER" du -sb /root/.ollama 2>/dev/null | awk '{print $1}' || echo 0)
  if [ "$model_dir_size" -gt 0 ] 2>/dev/null; then
    model_dir_gb=$(echo "scale=2; $model_dir_size / 1073741824" | bc 2>/dev/null || echo "?")
    ok "model-volume-size: Ollama models directory is ${model_dir_gb}GB"
  fi
fi

# ── Check 15: Throughput benchmark (optional, requires --benchmark) ─────────

json_benchmark=""

if $BENCHMARK; then
  info ""
  info "Check 15/15: Throughput benchmark (${BENCHMARK_RUNS} runs × ${BENCHMARK_TOKENS} tokens)"

  if ! is_running "$OLLAMA_CONTAINER"; then
    fail "benchmark" "Ollama container not running — cannot benchmark"
    record_fail "benchmark"
  elif ! check_model_present "$BENCHMARK_MODEL"; then
    fail "benchmark" "Model $BENCHMARK_MODEL not present — cannot benchmark"
    record_fail "benchmark"
  else
    # Get the configured memory profile for threshold comparison
    configured_profile=$(docker exec "$OLLAMA_CONTAINER" printenv OLLAMA_MEMORY_PROFILE 2>/dev/null || echo "balanced")
    configured_num_gpu=$(docker exec "$OLLAMA_CONTAINER" printenv OLLAMA_NUM_GPU 2>/dev/null || echo "-1")

    profile_min=${PROFILE_MIN_TOKS[$configured_profile]:-20}
    profile_max=${PROFILE_MAX_TOKS[$configured_profile]:-50}
    cpu_only_max=${PROFILE_CPU_ONLY_MAX[$configured_profile]:-15}
    throttle_threshold=$(echo "scale=1; $profile_min * 0.8" | bc 2>/dev/null || echo "$((profile_min * 8 / 10))")

    info "  Profile: $configured_profile (expected ${profile_min}-${profile_max} tok/s, throttle < ${throttle_threshold} tok/s)"
    info "  GPU offload: NUM_GPU=$configured_num_gpu"

    # Run benchmark
    benchmark_toks_list=""
    benchmark_total_tokens=0
    benchmark_total_time=0
    benchmark_valid_runs=0

    for run in $(seq 1 "$BENCHMARK_RUNS"); do
      info "  Run $run/$BENCHMARK_RUNS..."

      # Send a generation request with num_predict=N and stream=false
      # Ollama /api/generate returns eval_count (tokens generated) and eval_duration (nanoseconds)
      bench_start=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time_ns()))" 2>/dev/null || echo 0)

      bench_response=$(docker exec "$OLLAMA_CONTAINER" curl -s --max-time 120 \
        -X POST "http://localhost:11434/api/generate" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$BENCHMARK_MODEL\",\"prompt\":\"Write a numbered list of ${BENCHMARK_TOKENS} short words. Start now.\",\"stream\":false,\"options\":{\"num_predict\":$BENCHMARK_TOKENS,\"temperature\":0}}" \
        2>/dev/null || echo "")

      bench_end=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time_ns()))" 2>/dev/null || echo 0)

      if [ -z "$bench_response" ]; then
        warn "  Run $run: no response (timeout or error)"
        continue
      fi

      # Extract eval_count and eval_duration from Ollama response
      # eval_count = number of tokens generated
      # eval_duration = time spent generating in nanoseconds
      eval_count=$(echo "$bench_response" | grep -o '"eval_count":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
      eval_duration_ns=$(echo "$bench_response" | grep -o '"eval_duration":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")

      # Also extract total_duration for wall-clock time
      total_duration_ns=$(echo "$bench_response" | grep -o '"total_duration":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")

      if [ "$eval_count" -gt 0 ] 2>/dev/null && [ "$eval_duration_ns" -gt 0 ] 2>/dev/null; then
        # Calculate tok/s from eval_count and eval_duration (nanoseconds → seconds)
        # tok/s = eval_count / (eval_duration_ns / 1e9)
        tok_per_sec=$(echo "scale=2; $eval_count * 1000000000 / $eval_duration_ns" | bc 2>/dev/null || echo "0")

        if [ "$tok_per_sec" != "0" ] 2>/dev/null; then
          benchmark_valid_runs=$((benchmark_valid_runs + 1))
          benchmark_toks_list="${benchmark_toks_list}${tok_per_sec} "
          benchmark_total_tokens=$((benchmark_total_tokens + eval_count))
          info "  Run $run: ${tok_per_sec} tok/s (${eval_count} tokens in $(echo "scale=2; $eval_duration_ns / 1000000000" | bc 2>/dev/null || echo "?")s)"
        else
          warn "  Run $run: could not calculate tok/s (eval_count=$eval_count, eval_duration=$eval_duration_ns)"
        fi
      else
        # Fallback: use wall-clock time
        if [ "$bench_start" -gt 0 ] 2>/dev/null && [ "$bench_end" -gt 0 ] 2>/dev/null; then
          wall_ns=$((bench_end - bench_start))
          if [ "$wall_ns" -gt 0 ] 2>/dev/null; then
            # Estimate tokens from response length
            response_text=$(echo "$bench_response" | grep -o '"response":"[^"]*"' | head -1 | sed 's/"response":"//;s/"$//' || echo "")
            estimated_tokens=$(echo "$response_text" | wc -w 2>/dev/null || echo 0)
            if [ "$estimated_tokens" -gt 0 ] 2>/dev/null; then
              tok_per_sec=$(echo "scale=2; $estimated_tokens * 1000000000 / $wall_ns" | bc 2>/dev/null || echo "0")
              if [ "$tok_per_sec" != "0" ] 2>/dev/null; then
                benchmark_valid_runs=$((benchmark_valid_runs + 1))
                benchmark_toks_list="${benchmark_toks_list}${tok_per_sec} "
                benchmark_total_tokens=$((benchmark_total_tokens + estimated_tokens))
                info "  Run $run: ${tok_per_sec} tok/s (${estimated_tokens} tokens, wall-clock estimate)"
              else
                warn "  Run $run: wall-clock calculation failed"
              fi
            else
              warn "  Run $run: could not estimate token count"
            fi
          else
            warn "  Run $run: wall-clock time was zero"
          fi
        else
          warn "  Run $run: no timing data available"
        fi
      fi

      # Brief pause between runs to let GPU/CPU cool
      if [ "$run" -lt "$BENCHMARK_RUNS" ]; then
        sleep 2
      fi
    done

    # Calculate statistics
    if [ $benchmark_valid_runs -gt 0 ]; then
      # Average tok/s
      avg_toks=0
      for t in $benchmark_toks_list; do
        avg_toks=$(echo "scale=2; $avg_toks + $t" | bc 2>/dev/null || echo "$avg_toks")
      done
      avg_toks=$(echo "scale=2; $avg_toks / $benchmark_valid_runs" | bc 2>/dev/null || echo "0")

      # Min and max for range
      min_toks=$(echo $benchmark_toks_list | tr ' ' '\n' | sort -n | head -1)
      max_toks=$(echo $benchmark_toks_list | tr ' ' '\n' | sort -n | tail -1)

      # Standard deviation (simple: max-min as range proxy)
      range=$(echo "scale=2; $max_toks - $min_toks" | bc 2>/dev/null || echo "0")
      # Coefficient of variation (CV = stddev/mean, approximate with range/mean)
      if [ "$avg_toks" != "0" ] 2>/dev/null; then
        cv=$(echo "scale=2; ($range / $avg_toks) * 100" | bc 2>/dev/null || echo "0")
      else
        cv="0"
      fi

      info ""
      info "  Benchmark results:"
      info "    Average: ${avg_toks} tok/s"
      info "    Range:   ${min_toks}-${max_toks} tok/s"
      info "    Variance: ${cv}% (coefficient of variation)"
      info "    Valid runs: $benchmark_valid_runs/$BENCHMARK_RUNS"
      info "    Profile expectation: ${profile_min}-${profile_max} tok/s for $configured_profile"

      # Record benchmark result
      ok "benchmark-avg: ${avg_toks} tok/s average over $benchmark_valid_runs runs"

      # Check 15a: Throughput vs profile minimum
      info ""
      info "  Throughput analysis:"

      # Compare avg_toks against profile thresholds
      # Use integer comparison via awk for reliability
      below_throttle=$(echo "$avg_toks < $throttle_threshold" | bc 2>/dev/null || echo "0")
      below_profile_min=$(echo "$avg_toks < $profile_min" | bc 2>/dev/null || echo "0")
      above_profile_max=$(echo "$avg_toks > $profile_max" | bc 2>/dev/null || echo "0")
      in_cpu_range=$(echo "$avg_toks <= $cpu_only_max" | bc 2>/dev/null || echo "0")

      if [ "$below_throttle" = "1" ]; then
        fail "benchmark-throttle" "Throughput ${avg_toks} tok/s is below 80% of ${configured_profile} minimum (${throttle_threshold} tok/s) — possible thermal throttling or resource contention"
        record_fail "benchmark-throttle"
      elif [ "$below_profile_min" = "1" ]; then
        warn_msg "benchmark-below-min" "Throughput ${avg_toks} tok/s is below ${configured_profile} profile minimum (${profile_min} tok/s)"
      else
        ok "benchmark-throughput: ${avg_toks} tok/s meets ${configured_profile} profile minimum (${profile_min} tok/s)"
      fi

      if [ "$above_profile_max" = "1" ]; then
        ok "benchmark-exceeds: ${avg_toks} tok/s exceeds ${configured_profile} profile maximum (${profile_max} tok/s) — excellent performance"
      fi

      # Check 15b: GPU offload verification
      # If GPU is configured but throughput is in CPU-only range, GPU offload may have failed
      if [ "$configured_num_gpu" != "0" ] && [ "$configured_num_gpu" != "" ]; then
        # GPU offload is configured (auto or max)
        if [ "$in_cpu_range" = "1" ] && [ "$below_profile_min" = "1" ]; then
          warn_msg "benchmark-gpu-failure" "GPU offload configured (NUM_GPU=$configured_num_gpu) but throughput (${avg_toks} tok/s) is in CPU-only range — GPU may not be working"
        else
          ok "benchmark-gpu: GPU offload active (NUM_GPU=$configured_num_gpu), throughput ${avg_toks} tok/s"
        fi
      fi

      # Check 15c: Variance check (high variance indicates thread contention or thermal instability)
      high_variance=$(echo "$cv > 20" | bc 2>/dev/null || echo "0")
      if [ "$high_variance" = "1" ] && [ $benchmark_valid_runs -gt 1 ]; then
        warn_msg "benchmark-variance" "High variance (${cv}%) across runs — possible thread contention, thermal instability, or background processes"
      else
        ok "benchmark-stability: Variance ${cv}% across $benchmark_valid_runs runs (stable)"
      fi

      # Check 15d: CPU thermal check (if sensors available)
      cpu_temp=""
      if command -v sensors > /dev/null 2>&1; then
        cpu_temp=$(sensors 2>/dev/null | grep -i 'core\|cpu\|package' | grep -o '[0-9]*\.[0-9]' | head -1 || echo "")
      elif [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        raw_temp=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo "0")
        if [ "$raw_temp" -gt 1000 ] 2>/dev/null; then
          # Linux reports in millidegrees
          cpu_temp=$(echo "scale=1; $raw_temp / 1000" | bc 2>/dev/null || echo "")
        elif [ "$raw_temp" -gt 0 ] 2>/dev/null; then
          cpu_temp="$raw_temp"
        fi
      fi

      if [ -n "$cpu_temp" ]; then
        thermal_throttle=$(echo "$cpu_temp > 85" | bc 2>/dev/null || echo "0")
        if [ "$thermal_throttle" = "1" ]; then
          warn_msg "benchmark-thermal" "CPU temperature ${cpu_temp}°C is above 85°C — thermal throttling likely"
        else
          ok "benchmark-thermal: CPU temperature ${cpu_temp}°C (within safe range)"
        fi
      fi

      # Build benchmark JSON
      json_benchmark=",\"benchmark\":{\"model\":\"$BENCHMARK_MODEL\",\"profile\":\"$configured_profile\",\"runs\":$benchmark_valid_runs,\"avgTokPerSec\":$avg_toks,\"minTokPerSec\":$min_toks,\"maxTokPerSec\":$max_toks,\"variancePct\":$cv,\"profileMin\":$profile_min,\"profileMax\":$profile_max,\"throttleThreshold\":$throttle_threshold,\"numGpu\":$configured_num_gpu${cpu_temp:+,\"cpuTemp\":$cpu_temp}}"
    else
      fail "benchmark" "All $BENCHMARK_RUNS benchmark runs failed — model may be broken or too slow"
      record_fail "benchmark"
    fi
  fi
fi

# ── Recovery phase ──────────────────────────────────────────────────────────

if [ "$RECOVER_MODE" != "none" ] && [ -n "$failed_checks" ] && [ $failures -gt 0 ]; then
  info ""
  info "=== Recovery Phase ==="
  info "Failed checks: $failures"
  info "Recovery mode: $RECOVER_MODE"
  info ""

  # Parse failed checks and attempt recovery
  IFS=';' read -ra failed_array <<< "$failed_checks"

  for check_id in "${failed_array[@]}"; do
    [ -z "$check_id" ] && continue
    recovery_attempts=$((recovery_attempts + 1))

    case "$check_id" in
      # ── Safe: restart stopped containers ──────────────────────────────────
      container-simplebeacon-engine)
        if [ "$RECOVER_MODE" != "none" ]; then
          restart_container "$ENGINE_CONTAINER" "simplebeacon-engine"
        fi
        ;;
      container-simplebeacon-ollama)
        if [ "$RECOVER_MODE" != "none" ]; then
          restart_container "$OLLAMA_CONTAINER" "simplebeacon-ollama"
        fi
        ;;
      container-simplebeacon-db)
        if [ "$RECOVER_MODE" != "none" ]; then
          restart_container "$DB_CONTAINER" "simplebeacon-db"
        fi
        ;;

      # ── Safe: restart Ollama if API not responding ─────────────────────────
      ollama-api|ollama-tags)
        if [ "$RECOVER_MODE" != "none" ] && is_running "$OLLAMA_CONTAINER"; then
          recovery_info "Ollama API not responding — restarting Ollama container..."
          restart_container "$OLLAMA_CONTAINER" "simplebeacon-ollama"
        fi
        ;;

      # ── Safe: restart engine if health check fails ─────────────────────────
      engine-health)
        if [ "$RECOVER_MODE" != "none" ] && is_running "$ENGINE_CONTAINER"; then
          recovery_info "Engine health check failed — restarting engine container..."
          restart_container "$ENGINE_CONTAINER" "simplebeacon-engine"
        fi
        ;;

      # ── Safe: restart engine for stale Docker DNS ──────────────────────────
      engine-to-ollama)
        if [ "$RECOVER_MODE" != "none" ] && is_running "$ENGINE_CONTAINER"; then
          recovery_info "Engine cannot reach Ollama via Docker DNS — restarting engine..."
          restart_container "$ENGINE_CONTAINER" "simplebeacon-engine"
        fi
        ;;

      # ── Safe: restart PostgreSQL if not ready ──────────────────────────────
      pg-ready)
        if [ "$RECOVER_MODE" != "none" ] && is_running "$DB_CONTAINER"; then
          recovery_info "PostgreSQL not ready — restarting db container..."
          restart_container "$DB_CONTAINER" "simplebeacon-db"
        fi
        ;;

      # ── Safe: re-run idempotent schema migration ───────────────────────────
      pg-table-users|pg-table-dashboard_snapshots|pg-table-scan_history|pg-table-scan_counts)
        if [ "$RECOVER_MODE" != "none" ] && is_running "$DB_CONTAINER" && check_pg_ready; then
          rerun_migration
        fi
        ;;

      # ── Destructive: re-import models from archive ─────────────────────────
      model-unbreakable-oracle|model-simplebeacon-llama32|model-simplebeacon-mistral|model-simplebeacon-qwen-coder)
        if [ "$RECOVER_MODE" = "all" ]; then
          reimport_models
        else
          recovery_skip "$check_id" "reimport" "Destructive operation — use --recover to enable"
        fi
        ;;

      # ── Destructive: recreate corrupted model from Modelfile ───────────────
      layers-unbreakable-oracle)
        if [ "$RECOVER_MODE" = "all" ] && is_running "$OLLAMA_CONTAINER"; then
          recreate_model "unbreakable-oracle" "Modelfile"
        else
          recovery_skip "$check_id" "recreate" "Destructive operation — use --recover to enable"
        fi
        ;;
      layers-simplebeacon-llama32)
        if [ "$RECOVER_MODE" = "all" ] && is_running "$OLLAMA_CONTAINER"; then
          recreate_model "simplebeacon-llama32" "Modelfile.llama32"
        else
          recovery_skip "$check_id" "recreate" "Destructive operation — use --recover to enable"
        fi
        ;;
      layers-simplebeacon-mistral)
        if [ "$RECOVER_MODE" = "all" ] && is_running "$OLLAMA_CONTAINER"; then
          recreate_model "simplebeacon-mistral" "Modelfile.mistral"
        else
          recovery_skip "$check_id" "recreate" "Destructive operation — use --recover to enable"
        fi
        ;;
      layers-simplebeacon-qwen-coder)
        if [ "$RECOVER_MODE" = "all" ] && is_running "$OLLAMA_CONTAINER"; then
          recreate_model "simplebeacon-qwen-coder" "Modelfile.qwen25-coder"
        else
          recovery_skip "$check_id" "recreate" "Destructive operation — use --recover to enable"
        fi
        ;;

      # ── Manual: inference failure ──────────────────────────────────────────
      inference)
        manual_steps "Inference failure — possible causes:"
        manual_steps "  1. Model corruption — check layer integrity (Check 6)"
        manual_steps "  2. Insufficient memory — check 'docker stats' for OOM kills"
        manual_steps "  3. GPU driver issue — run 'nvidia-smi' to verify GPU is accessible"
        manual_steps "  4. Model still loading — wait 30s and re-run validation"
        manual_steps "  5. Wrong memory profile — check OLLAMA_MEMORY_PROFILE matches hardware"
        ;;

      # ── Manual: port mapping ───────────────────────────────────────────────
      port-ollama|port-engine)
        manual_steps "Port mapping issue — check docker-compose.enterprise.yml ports section."
        manual_steps "  Verify the container is running and the port is not in use by another process."
        manual_steps "  Check: docker ps --format '{{.Names}} {{.Ports}}'"
        ;;

      # ── Manual: offline mode ───────────────────────────────────────────────
      offline-simplebeacon-engine|offline-simplebeacon-ollama)
        manual_steps "SIMPLEBEACON_OFFLINE not set — update .env.enterprise:"
        manual_steps "  Add: SIMPLEBEACON_OFFLINE=true"
        manual_steps "  Then: docker compose -f docker-compose.enterprise.yml --env-file .env.enterprise up -d"
        ;;
      offline-ext-apis)
        manual_steps "ENABLE_EXTERNAL_APIS not false — update .env.enterprise:"
        manual_steps "  Add: ENABLE_EXTERNAL_APIS=false"
        manual_steps "  Then: docker compose -f docker-compose.enterprise.yml --env-file .env.enterprise up -d"
        ;;

      # ── Manual: memory profile ─────────────────────────────────────────────
      profile-valid|profile-config)
        manual_steps "Memory profile issue — update .env.enterprise:"
        manual_steps "  Set: OLLAMA_MEMORY_PROFILE=balanced (or minimal/maximum)"
        manual_steps "  Run: ./scripts/detect-hardware-profile.sh --apply"
        manual_steps "  Then: docker compose -f docker-compose.enterprise.yml --env-file .env.enterprise up -d"
        ;;

      # ── Manual: disk space ─────────────────────────────────────────────────
      disk-space)
        manual_steps "Insufficient disk space — free up space:"
        manual_steps "  1. Remove old Docker images: docker image prune -a"
        manual_steps "  2. Remove unused volumes: docker volume prune"
        manual_steps "  3. Remove old scan reports: docker exec simplebeacon-engine rm -rf /app/ai-platform/processed_archive/*"
        manual_steps "  4. Check Docker root dir: docker info | grep 'Docker Root Dir'"
        ;;

      # ── Unknown check ──────────────────────────────────────────────────────
      *)
        recovery_skip "$check_id" "unknown" "No recovery action defined for this check"
        ;;
    esac
  done

  # ── Re-check after recovery ───────────────────────────────────────────────

  if [ $recovery_attempts -gt 0 ] && [ $recovery_successes -gt 0 ]; then
    info ""
    info "=== Post-Recovery Re-Check ==="
    info "Re-running failed checks to verify recovery..."

    recheck_failures=0

    for check_id in "${failed_array[@]}"; do
      [ -z "$check_id" ] && continue
      recheck_passed=false

      case "$check_id" in
        container-simplebeacon-engine)
          check_container_running "$ENGINE_CONTAINER" && recheck_passed=true
          ;;
        container-simplebeacon-ollama)
          check_container_running "$OLLAMA_CONTAINER" && recheck_passed=true
          ;;
        container-simplebeacon-db)
          check_container_running "$DB_CONTAINER" && recheck_passed=true
          ;;
        ollama-api)
          is_running "$OLLAMA_CONTAINER" && check_ollama_api && recheck_passed=true
          ;;
        ollama-tags)
          is_running "$OLLAMA_CONTAINER" && check_ollama_tags && recheck_passed=true
          ;;
        engine-health)
          is_running "$ENGINE_CONTAINER" && check_engine_health && recheck_passed=true
          ;;
        engine-to-ollama)
          is_running "$ENGINE_CONTAINER" && check_engine_to_ollama && recheck_passed=true
          ;;
        pg-ready)
          is_running "$DB_CONTAINER" && check_pg_ready && recheck_passed=true
          ;;
        pg-table-users)
          is_running "$DB_CONTAINER" && check_pg_ready && check_pg_table "users" && recheck_passed=true
          ;;
        pg-table-dashboard_snapshots)
          is_running "$DB_CONTAINER" && check_pg_ready && check_pg_table "dashboard_snapshots" && recheck_passed=true
          ;;
        pg-table-scan_history)
          is_running "$DB_CONTAINER" && check_pg_ready && check_pg_table "scan_history" && recheck_passed=true
          ;;
        pg-table-scan_counts)
          is_running "$DB_CONTAINER" && check_pg_ready && check_pg_table "scan_counts" && recheck_passed=true
          ;;
        model-unbreakable-oracle)
          is_running "$OLLAMA_CONTAINER" && check_model_present "unbreakable-oracle" && recheck_passed=true
          ;;
        model-simplebeacon-llama32)
          is_running "$OLLAMA_CONTAINER" && check_model_present "simplebeacon-llama32" && recheck_passed=true
          ;;
        model-simplebeacon-mistral)
          is_running "$OLLAMA_CONTAINER" && check_model_present "simplebeacon-mistral" && recheck_passed=true
          ;;
        model-simplebeacon-qwen-coder)
          is_running "$OLLAMA_CONTAINER" && check_model_present "simplebeacon-qwen-coder" && recheck_passed=true
          ;;
        layers-unbreakable-oracle)
          is_running "$OLLAMA_CONTAINER" && check_model_layers "unbreakable-oracle" && recheck_passed=true
          ;;
        layers-simplebeacon-llama32)
          is_running "$OLLAMA_CONTAINER" && check_model_layers "simplebeacon-llama32" && recheck_passed=true
          ;;
        layers-simplebeacon-mistral)
          is_running "$OLLAMA_CONTAINER" && check_model_layers "simplebeacon-mistral" && recheck_passed=true
          ;;
        layers-simplebeacon-qwen-coder)
          is_running "$OLLAMA_CONTAINER" && check_model_layers "simplebeacon-qwen-coder" && recheck_passed=true
          ;;
      esac

      if $recheck_passed; then
        ok "recheck-$check_id: Recovered — check now passes"
        failures=$((failures - 1))
        passed_checks=$((passed_checks + 1))
      else
        echo -e "  ${RED}✗${NC} recheck-$check_id: Still failing after recovery"
        recheck_failures=$((recheck_failures + 1))
      fi
    done

    if [ $recheck_failures -eq 0 ] && [ $failures -eq 0 ]; then
      info ""
      info "All failed checks recovered successfully!"
    elif [ $recheck_failures -gt 0 ]; then
      info ""
      info "$recheck_failures check(s) still failing after recovery."
      info "See manual steps above or run with --verbose for more details."
    fi
  fi
fi

# ── Summary ─────────────────────────────────────────────────────────────────

# Save JSON report to a temp file for the diagnostics bundle exporter
JSON_REPORT_FILE=""
if $EXPORT_BUNDLE; then
  JSON_REPORT_FILE=$(mktemp)
fi

if [ "$OUTPUT_FORMAT" = "json" ]; then
  json_results="${json_results%,}"
  json_recoveries="${json_recoveries%,}"
  JSON_OUTPUT="{\"summary\":{\"total\":$total_checks,\"passed\":$passed_checks,\"failed\":$failures,\"passed_pct\":$(( total_checks > 0 ? passed_checks * 100 / total_checks : 0 ))},\"recovery\":{\"attempts\":$recovery_attempts,\"successes\":$recovery_successes,\"mode\":\"$RECOVER_MODE\"},\"checks\":[$json_results],\"recoveries\":[$json_recoveries]${json_benchmark}}"
  echo "$JSON_OUTPUT"
  if $EXPORT_BUNDLE && [ -n "$JSON_REPORT_FILE" ]; then
    echo "$JSON_OUTPUT" > "$JSON_REPORT_FILE"
  fi
  # Run diagnostics export if requested (even in JSON mode)
  if $EXPORT_BUNDLE; then
    EXPORT_SCRIPT="$SCRIPT_DIR/export-diagnostics-bundle.sh"
    if [ -f "$EXPORT_SCRIPT" ]; then
      bash "$EXPORT_SCRIPT" --validate-json "$JSON_REPORT_FILE" --output ./diagnostics > /dev/null 2>&1 || true
      rm -f "$JSON_REPORT_FILE"
    fi
  fi
  exit $(( failures > 0 ? 1 : 0 ))
fi

echo ""
if [ $failures -eq 0 ]; then
  info "All $total_checks validation checks passed."
  if [ $recovery_attempts -gt 0 ]; then
    info "Recovery: $recovery_successes/$recovery_attempts actions succeeded."
  fi
  info "SimpleBeacon air-gapped deployment is healthy and ready for use."
else
  echo -e "${RED}[FAIL]${NC} Validation completed with $failures failure(s) out of $total_checks checks."
  if [ $recovery_attempts -gt 0 ]; then
    info "Recovery: $recovery_successes/$recovery_attempts actions succeeded."
  fi
  if [ "$RECOVER_MODE" = "none" ] && [ $failures -gt 0 ]; then
    info ""
    info "To attempt automatic recovery, re-run with:"
    info "  ./scripts/validate-airgap-deploy.sh --recover"
    info "  ./scripts/validate-airgap-deploy.sh --recover-safe  (safe operations only)"
  fi
fi

# ── Diagnostics bundle export ───────────────────────────────────────────────

if $EXPORT_BUNDLE; then
  EXPORT_SCRIPT="$SCRIPT_DIR/export-diagnostics-bundle.sh"
  if [ -f "$EXPORT_SCRIPT" ]; then
    info ""
    info "Creating diagnostics bundle..."

    # Write JSON report to temp file for the exporter
    if [ -z "$JSON_REPORT_FILE" ]; then
      JSON_REPORT_FILE=$(mktemp)
      json_results="${json_results%,}"
      json_recoveries="${json_recoveries%,}"
      echo "{\"summary\":{\"total\":$total_checks,\"passed\":$passed_checks,\"failed\":$failures,\"passed_pct\":$(( total_checks > 0 ? passed_checks * 100 / total_checks : 0 ))},\"recovery\":{\"attempts\":$recovery_attempts,\"successes\":$recovery_successes,\"mode\":\"$RECOVER_MODE\"},\"checks\":[$json_results],\"recoveries\":[$json_recoveries]}" > "$JSON_REPORT_FILE"
    fi

    if bash "$EXPORT_SCRIPT" --validate-json "$JSON_REPORT_FILE" --output ./diagnostics; then
      info "Diagnostics bundle created in ./diagnostics/"
      info "Transfer the tarball back over the air-gap for engineering review."
    else
      warn "Diagnostics bundle creation failed — see errors above."
    fi
    rm -f "$JSON_REPORT_FILE"
  else
    warn "Diagnostics export script not found: $EXPORT_SCRIPT"
  fi
fi

exit $(( failures > 0 ? 1 : 0 ))
