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
#
# Exit codes:
#   0  All validation checks passed
#   1  One or more validation checks failed
#   2  Fatal error (Docker not running, script misuse)
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
#

set -u

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

# ── Argument parsing ────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)     OUTPUT_FORMAT="json"; shift ;;
    --verbose)  VERBOSE=true; shift ;;
    --timeout)  INFERENCE_TIMEOUT="${2:-30}"; shift 2 ;;
    --help|-h)
      cat << 'HELP'
SimpleBeacon Air-Gapped Deployment Validation Suite

Usage:
  validate-airgap-deploy.sh [--json] [--verbose] [--timeout N]

  --json      Output results as JSON for automation/CI
  --verbose   Show full command output (not just pass/fail)
  --timeout N Inference test timeout in seconds (default: 30)
  --help      Show this help message

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
json_results=""

# Colors (disabled in JSON mode)
if [ "$OUTPUT_FORMAT" = "text" ] && [ -t 1 ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  GREEN='' RED='' YELLOW='' BLUE='' NC=''
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

# Run a command quietly or verbosely depending on --verbose flag
run_cmd() {
  if $VERBOSE; then
    "$@"
  else
    "$@" > /dev/null 2>&1
  fi
}

# ── Check 1: Docker daemon reachable ────────────────────────────────────────

info "=== SimpleBeacon Air-Gapped Deployment Validation ==="
info ""

info "Check 1/14: Docker daemon"
if docker info > /dev/null 2>&1; then
  ok "docker-daemon: Docker daemon is reachable"
else
  die "Docker daemon is not reachable — is Docker running?"
fi

# ── Check 2: Required containers running ────────────────────────────────────

info "Check 2/14: Container status"
for c in "$ENGINE_CONTAINER" "$OLLAMA_CONTAINER" "$DB_CONTAINER"; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then
    ok "container-$c: $c container is running"
  else
    fail "container-$c" "$c container is NOT running"
  fi
done

# ── Check 3: Exposed ports ──────────────────────────────────────────────────

info "Check 3/14: Exposed ports"
ollama_host_port=""
engine_host_port=""

if docker ps --format '{{.Names}}' | grep -qx "$OLLAMA_CONTAINER"; then
  ollama_host_port=$(docker port "$OLLAMA_CONTAINER" 11434 2>/dev/null | head -n1 | awk -F: '{print $NF}' | tr -d '[:space:]')
  if [ -n "$ollama_host_port" ]; then
    ok "port-ollama: Ollama exposed on host port $ollama_host_port"
  else
    fail "port-ollama" "Could not determine Ollama host port"
  fi
else
  fail "port-ollama" "Ollama container not running — cannot check port"
fi

if docker ps --format '{{.Names}}' | grep -qx "$ENGINE_CONTAINER"; then
  engine_host_port=$(docker port "$ENGINE_CONTAINER" 3000 2>/dev/null | head -n1 | awk -F: '{print $NF}' | tr -d '[:space:]')
  if [ -n "$engine_host_port" ]; then
    ok "port-engine: Engine exposed on host port $engine_host_port"
  else
    fail "port-engine" "Could not determine Engine host port"
  fi
else
  fail "port-engine" "Engine container not running — cannot check port"
fi

# ── Check 4: Ollama API health ──────────────────────────────────────────────

info "Check 4/14: Ollama API health"
if docker ps --format '{{.Names}}' | grep -qx "$OLLAMA_CONTAINER"; then
  if docker exec "$OLLAMA_CONTAINER" curl -s "http://localhost:11434/" > /dev/null 2>&1; then
    ok "ollama-api: Ollama daemon responds on /"
  else
    fail "ollama-api" "Ollama daemon is not responding on /"
  fi

  if docker exec "$OLLAMA_CONTAINER" curl -s "http://localhost:11434/api/tags" > /dev/null 2>&1; then
    ok "ollama-tags: Ollama /api/tags is reachable"
  else
    fail "ollama-tags" "Ollama /api/tags is not reachable"
  fi
else
  fail "ollama-api" "Ollama container not running"
  fail "ollama-tags" "Ollama container not running"
fi

# ── Check 5: Required models present ────────────────────────────────────────

info "Check 5/14: Required models"
if docker ps --format '{{.Names}}' | grep -qx "$OLLAMA_CONTAINER"; then
  ollama_tags=$(docker exec "$OLLAMA_CONTAINER" curl -s "http://localhost:11434/api/tags" 2>/dev/null || echo "")
  for model in "${REQUIRED_MODELS[@]}"; do
    if echo "$ollama_tags" | grep -q "\"name\":\"$model"; then
      ok "model-$model: Model present"
    else
      fail "model-$model" "Model missing: $model"
    fi
  done
else
  for model in "${REQUIRED_MODELS[@]}"; do
    fail "model-$model" "Ollama container not running"
  done
fi

# ── Check 6: Model layer integrity ──────────────────────────────────────────

info "Check 6/14: Model layer integrity"
if docker ps --format '{{.Names}}' | grep -qx "$OLLAMA_CONTAINER"; then
  for model in "${REQUIRED_MODELS[@]}"; do
    if docker exec "$OLLAMA_CONTAINER" ollama show "$model" > /dev/null 2>&1; then
      ok "layers-$model: Layer integrity OK"
    else
      fail "layers-$model" "Layer integrity FAILED — model may be corrupted"
    fi
  done
else
  for model in "${REQUIRED_MODELS[@]}"; do
    fail "layers-$model" "Ollama container not running"
  done
fi

# ── Check 7: Inference smoke test ───────────────────────────────────────────

info "Check 7/14: Inference smoke test (timeout: ${INFERENCE_TIMEOUT}s)"
if docker ps --format '{{.Names}}' | grep -qx "$OLLAMA_CONTAINER"; then
  # Send a tiny prompt to the default model — just verify it generates output
  # "Reply with exactly: OK" is a minimal prompt that any working model can handle
  inference_response=$(docker exec "$OLLAMA_CONTAINER" curl -s --max-time "$INFERENCE_TIMEOUT" \
    -X POST "http://localhost:11434/api/generate" \
    -H "Content-Type: application/json" \
    -d '{"model":"unbreakable-oracle","prompt":"Reply with exactly: OK","stream":false,"options":{"num_predict":5,"temperature":0}}' \
    2>/dev/null || echo "")

  if [ -n "$inference_response" ]; then
    # Check if the response contains a "response" field with content
    inference_text=$(echo "$inference_response" | grep -o '"response":"[^"]*"' | head -1 | sed 's/"response":"//;s/"$//')
    if [ -n "$inference_text" ]; then
      ok "inference: Model generated output (response: \"${inference_text:0:50}\")"
    else
      # Check for error in response
      if echo "$inference_response" | grep -q '"error"'; then
        err_msg=$(echo "$inference_response" | grep -o '"error":"[^"]*"' | head -1)
        fail "inference" "Model returned error: $err_msg"
      else
        fail "inference" "Model returned empty response"
      fi
    fi
  else
    fail "inference" "Inference request timed out or failed (timeout: ${INFERENCE_TIMEOUT}s)"
  fi
else
  fail "inference" "Ollama container not running"
fi

# ── Check 8: Engine health endpoint ─────────────────────────────────────────

info "Check 8/14: Engine health endpoint"
if [ -n "$engine_host_port" ]; then
  if curl -s --max-time 10 "http://localhost:$engine_host_port/health" > /dev/null 2>&1; then
    ok "engine-health: Engine /health responds (localhost:$engine_host_port)"
  else
    # Fallback to internal network check from Ollama container
    if docker exec "$OLLAMA_CONTAINER" curl -s --max-time 10 "http://$ENGINE_CONTAINER:3000/health" > /dev/null 2>&1; then
      ok "engine-health: Engine /health responds (internal Docker DNS)"
    else
      fail "engine-health" "Engine /health endpoint is not responding"
    fi
  fi
else
  fail "engine-health" "No engine port available — cannot check health"
fi

# ── Check 9: Engine-to-Ollama connectivity (Docker DNS) ─────────────────────

info "Check 9/14: Engine-to-Ollama connectivity (Docker DNS)"
# The engine connects to Ollama via OLLAMA_BASE_URL=http://simplebeacon-ollama:11434
# Verify this path works from inside the engine container
if docker ps --format '{{.Names}}' | grep -qx "$ENGINE_CONTAINER"; then
  if docker exec "$ENGINE_CONTAINER" curl -s --max-time 10 "http://simplebeacon-ollama:11434/api/tags" > /dev/null 2>&1; then
    ok "engine-to-ollama: Engine can reach Ollama via Docker DNS"
  else
    fail "engine-to-ollama" "Engine cannot reach Ollama via Docker DNS (http://simplebeacon-ollama:11434)"
  fi

  # Also verify the engine's OLLAMA_BASE_URL env var is set correctly
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
fi

# ── Check 10: PostgreSQL readiness ──────────────────────────────────────────

info "Check 10/14: PostgreSQL readiness"
if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    ok "pg-ready: PostgreSQL is ready"
  else
    fail "pg-ready" "PostgreSQL is not ready"
  fi
else
  fail "pg-ready" "Database container not running"
fi

# ── Check 11: PostgreSQL schema readiness ───────────────────────────────────

info "Check 11/14: PostgreSQL schema readiness"
if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  for table in "${REQUIRED_TABLES[@]}"; do
    table_exists=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null | tr -d '[:space:]' || echo "f")
    if [ "$table_exists" = "t" ]; then
      ok "pg-table-$table: Table exists"
    else
      fail "pg-table-$table" "Table missing — schema migration may not have run"
    fi
  done
else
  for table in "${REQUIRED_TABLES[@]}"; do
    fail "pg-table-$table" "Database container not running"
  done
fi

# ── Check 12: Memory profile validation ─────────────────────────────────────

info "Check 12/14: Memory profile validation"
if docker ps --format '{{.Names}}' | grep -qx "$OLLAMA_CONTAINER"; then
  configured_profile=$(docker exec "$OLLAMA_CONTAINER" printenv OLLAMA_MEMORY_PROFILE 2>/dev/null || echo "balanced")
  configured_num_gpu=$(docker exec "$OLLAMA_CONTAINER" printenv OLLAMA_NUM_GPU 2>/dev/null || echo "-1")
  configured_num_ctx=$(docker exec "$OLLAMA_CONTAINER" printenv OLLAMA_NUM_CTX 2>/dev/null || echo "8192")

  ok "profile-config: OLLAMA_MEMORY_PROFILE=$configured_profile, NUM_GPU=$configured_num_gpu, NUM_CTX=$configured_num_ctx"

  # Validate profile name is one of the known profiles
  case "$configured_profile" in
    minimal|balanced|maximum)
      ok "profile-valid: Profile name is recognized"
      ;;
    *)
      fail "profile-valid" "Unknown profile: $configured_profile (expected: minimal, balanced, or maximum)"
      ;;
  esac

  # Warn if minimal profile is used with GPU offload enabled (contradictory)
  if [ "$configured_profile" = "minimal" ] && [ "$configured_num_gpu" != "0" ]; then
    warn_msg "profile-gpu-mismatch" "minimal profile with NUM_GPU=$configured_num_gpu — minimal should use NUM_GPU=0 for CPU-only"
  fi

  # Warn if maximum profile is used with CPU-only (contradictory)
  if [ "$configured_profile" = "maximum" ] && [ "$configured_num_gpu" = "0" ]; then
    warn_msg "profile-gpu-mismatch" "maximum profile with NUM_GPU=0 — maximum should use NUM_GPU=999 for full GPU offload"
  fi
else
  fail "profile-config" "Ollama container not running"
fi

# ── Check 13: Offline mode verification ─────────────────────────────────────

info "Check 13/14: Offline mode verification"
offline_issues=0

# Check SIMPLEBEACON_OFFLINE is set on both engine and ollama containers
for c in "$ENGINE_CONTAINER" "$OLLAMA_CONTAINER"; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then
    offline_flag=$(docker exec "$c" printenv SIMPLEBEACON_OFFLINE 2>/dev/null || echo "")
    if [ "$offline_flag" = "true" ]; then
      ok "offline-$c: SIMPLEBEACON_OFFLINE=true"
    else
      fail "offline-$c" "SIMPLEBEACON_OFFLINE is not set to true (got: '$offline_flag')"
      offline_issues=$((offline_issues + 1))
    fi
  fi
done

# Check that containers don't have unexpected outbound network connections
# We verify by checking that no external DNS lookups are happening
# (this is a lightweight check — a true air-gap test requires network isolation)
if docker ps --format '{{.Names}}' | grep -qx "$OLLAMA_CONTAINER"; then
  # Check if Ollama has any established connections to external IPs
  # (connections to 127.0.0.1 and internal Docker network are expected)
  external_conns=$(docker exec "$OLLAMA_CONTAINER" sh -c \
    "cat /proc/net/tcp 2>/dev/null | awk 'NR>1 {split(\$3,a,\":\"); ip=strtonum(\"0x\"substr(a[1],7,2))\".\"strtonum(\"0x\"substr(a[1],5,2))\".\"strtonum(\"0x\"substr(a[1],3,2))\".\"strtonum(\"0x\"substr(a[1],1,2)); if (ip != \"0.0.0.0\" && ip != \"127.0.0.1\" && ip != \"172.17.0.1\" && \$4 == \"01\") print ip}' 2>/dev/null | head -5" \
    2>/dev/null || echo "")

  if [ -z "$external_conns" ]; then
    ok "offline-no-external: No external network connections detected from Ollama"
  else
    warn_msg "offline-external-conns" "Ollama has external connections to: $external_conns"
  fi
fi

# Check that ENABLE_EXTERNAL_APIS is false on the engine
if docker ps --format '{{.Names}}' | grep -qx "$ENGINE_CONTAINER"; then
  ext_apis=$(docker exec "$ENGINE_CONTAINER" printenv ENABLE_EXTERNAL_APIS 2>/dev/null || echo "")
  if [ "$ext_apis" = "false" ]; then
    ok "offline-ext-apis: ENABLE_EXTERNAL_APIS=false"
  else
    fail "offline-ext-apis" "ENABLE_EXTERNAL_APIS is not false (got: '$ext_apis') — external API calls may be attempted"
    offline_issues=$((offline_issues + 1))
  fi
fi

# ── Check 14: Disk space check ──────────────────────────────────────────────

info "Check 14/14: Disk space check"

# Check disk space on the Docker data directory (where volumes live)
docker_info=$(docker info 2>/dev/null)
docker_root=$(echo "$docker_info" | grep "Docker Root Dir" | awk '{print $NF}' || echo "/var/lib/docker")

# Get available disk space on the host
if command -v df &> /dev/null; then
  available_kb=$(df -k "$docker_root" 2>/dev/null | awk 'NR==2 {print $4}' || df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo 0)
  if [ "$available_kb" -gt 0 ] 2>/dev/null; then
    available_gb=$((available_kb / 1024 / 1024))
    if [ "$available_gb" -ge 10 ]; then
      ok "disk-space: ${available_gb}GB available (>= 10GB threshold)"
    elif [ "$available_gb" -ge 5 ]; then
      warn_msg "disk-space" "Only ${available_gb}GB available — recommend at least 10GB for model volumes and reports"
    else
      fail "disk-space" "Only ${available_gb}GB available — insufficient for model volumes and report storage"
    fi
  else
    warn_msg "disk-space" "Could not determine available disk space"
  fi
else
  warn_msg "disk-space" "df command not available — cannot check disk space"
fi

# Check Ollama model volume size
if docker ps --format '{{.Names}}' | grep -qx "$OLLAMA_CONTAINER"; then
  model_dir_size=$(docker exec "$OLLAMA_CONTAINER" du -sb /root/.ollama 2>/dev/null | awk '{print $1}' || echo 0)
  if [ "$model_dir_size" -gt 0 ] 2>/dev/null; then
    model_dir_gb=$(echo "scale=2; $model_dir_size / 1073741824" | bc 2>/dev/null || echo "?")
    ok "model-volume-size: Ollama models directory is ${model_dir_gb}GB"
  fi
fi

# ── Summary ─────────────────────────────────────────────────────────────────

if [ "$OUTPUT_FORMAT" = "json" ]; then
  # Remove trailing comma from json_results
  json_results="${json_results%,}"
  echo "{\"summary\":{\"total\":$total_checks,\"passed\":$passed_checks,\"failed\":$failures,\"passed_pct\":$(( total_checks > 0 ? passed_checks * 100 / total_checks : 0 ))},\"checks\":[$json_results]}"
  exit $(( failures > 0 ? 1 : 0 ))
fi

echo ""
if [ $failures -eq 0 ]; then
  info "All $total_checks validation checks passed."
  info "SimpleBeacon air-gapped deployment is healthy and ready for use."
  exit 0
else
  echo -e "${RED}[FAIL]${NC} Validation completed with $failures failure(s) out of $total_checks checks."
  info "Review the failed checks above before proceeding."
  exit 1
fi
