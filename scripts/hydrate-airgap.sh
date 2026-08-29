#!/bin/bash
#
# SimpleBeacon Air-Gapped Hydration Script
#
# Packages the entire SimpleBeacon enterprise stack into a portable
# archive, then deploys it in an air-gapped environment with no internet
# connectivity.
#
# ── Packager Phase (on internet-connected build machine) ──────────────────
#   ./hydrate-airgap.sh package [output-dir]
#
#   1. Builds Docker images (engine, ollama, postgres)
#   2. Pulls base Ollama models with Q4_K_M quantization (llama3.2:3b, mistral:7b, qwen2.5-coder:7b)
#   3. Creates SimpleBeacon-optimized models from Modelfiles
#   4. Saves all images + models into a compressed tar archive
#   5. Includes .env.enterprise.example and docker-compose files
#
# ── Deployer Phase (on air-gapped target machine) ─────────────────────────
#   ./hydrate-airgap.sh deploy [archive-path] [config-env-file]
#
#   1. Loads Docker images from the archive
#   2. Copies docker-compose files and env template
#   3. Starts the stack with docker compose up
#
# ── Verify Phase (on air-gapped target machine) ───────────────────────────
#   ./hydrate-airgap.sh verify [--json] [--verbose]
#
#   Delegates to validate-airgap-deploy.sh which runs 14 checks:
#   1. Docker daemon reachable
#   2. Required containers running
#   3. Container exposed ports
#   4. Ollama API health
#   5. Required models present
#   6. Model layer integrity
#   7. Inference smoke test (cheap prompt)
#   8. Engine health endpoint
#   9. Engine-to-Ollama connectivity (Docker DNS)
#  10. PostgreSQL readiness
#  11. PostgreSQL schema (key tables)
#  12. Memory profile validation
#  13. Offline mode verification
#  14. Disk space check
#
# Requirements:
#   - Docker 24+ with BuildKit
#   - Docker Compose v2
#   - curl, jq (for verification)
#   - ~10GB free disk space (for images + models)
#

set -euo pipefail

# Prevent MSYS2/Git Bash from converting container paths (e.g. /out, /data, /models)
# into Windows paths like C:/.../out, which breaks docker run -v, tar, and ollama create.
export MSYS_NO_PATHCONV=1

# ── Configuration ──────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="docker-compose.enterprise.yml"
GPU_OVERRIDE="docker-compose.enterprise.gpu.yml"
ENV_TEMPLATE=".env.enterprise.example"
ARCHIVE_NAME="simplebeacon-airgap-v1.tar.gz"
IMAGE_NAMES=("simplebeacon-engine:latest" "simplebeacon-ollama:latest" "postgres:16-alpine" "alpine:latest")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[SimpleBeacon]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
info() { echo -e "${BLUE}[INFO]${NC} $*"; }

# ── Helper functions ───────────────────────────────────────────────────────

check_prerequisites() {
  local missing=0
  for cmd in docker curl; do
    if ! command -v "$cmd" &> /dev/null; then
      err "$cmd is required but not installed."
      missing=1
    fi
  done
  if ! docker compose version &> /dev/null; then
    err "Docker Compose v2 is required (plugin not found)."
    missing=1
  fi
  if [ $missing -ne 0 ]; then
    exit 1
  fi
}

check_airgap_prerequisites() {
  local missing=0
  for cmd in docker curl; do
    if ! command -v "$cmd" &> /dev/null; then
      err "$cmd is required but not installed."
      missing=1
    fi
  done
  if ! docker compose version &> /dev/null; then
    err "Docker Compose v2 is required (plugin not found)."
    missing=1
  fi
  if [ $missing -ne 0 ]; then
    exit 1
  fi
}

# ── Package Phase ──────────────────────────────────────────────────────────

package() {
  local output_dir="${1:-$SCRIPT_DIR/dist}"
  log "Starting air-gap packaging..."
  info "Output directory: $output_dir"
  info "Project root: $PROJECT_ROOT"

  check_prerequisites

  mkdir -p "$output_dir"
  output_dir="$(cd "$output_dir" && pwd)"

  # Step 1: Build Docker images
  log "Step 1/5: Building Docker images..."
  cd "$PROJECT_ROOT"

  # Build engine image
  info "Building simplebeacon-engine..."
  docker build -t simplebeacon-engine:latest -f Dockerfile.enterprise .

  # Build ollama image
  info "Building simplebeacon-ollama..."
  docker build -t simplebeacon-ollama:latest -f Dockerfile.ollama .

  # Pull postgres image
  info "Pulling postgres:16-alpine..."
  docker pull postgres:16-alpine

  # Pull alpine image (used for volume archive/restore in air-gapped deploy)
  info "Pulling alpine:latest..."
  docker pull alpine:latest

  # Step 2: Start Ollama and pre-load models
  log "Step 2/5: Pre-loading Ollama models..."
  info "Starting temporary Ollama container for model baking..."

  # Purge any stale bake container from a previous interrupted run
  docker rm -f sb-ollama-bake 2>/dev/null || true

  docker run -d --name sb-ollama-bake --entrypoint ollama -v ollama-models:/home/ollama/.ollama simplebeacon-ollama:latest serve
  sleep 10

  # Wait for Ollama to be ready
  info "Waiting for Ollama daemon..."
  local ollama_ready=false
  for i in $(seq 1 60); do
    if docker exec sb-ollama-bake curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
      info "Ollama daemon is ready."
      ollama_ready=true
      break
    fi
    sleep 1
  done

  if ! $ollama_ready; then
    warn "Ollama daemon not ready after 60s — skipping model pull and creation."
    warn "Models will need to be created manually on the target machine."
    # Stop and clean up the bake container before exiting the model step
    docker stop sb-ollama-bake 2>/dev/null || true
    docker rm sb-ollama-bake 2>/dev/null || true
    # Continue to image save step — the archive will still have the images,
    # just without pre-baked models
  fi

  # Pull base models with explicit quantization tags (requires internet on build machine)
  # Quantization tags ensure reproducible builds — without them, Ollama may resolve
  # to a different quantization when the registry adds new variants.
  # Q4_K_M (4.84 bits/weight) is the recommended balance for production:
  #   - ~4.4 GB VRAM for 7B models
  #   - Minimal quality loss vs FP16
  #   - Fits on 6GB VRAM cards (RTX 3060, RTX 4060, A2000)
  if $ollama_ready; then
    info "Pulling base models with Q4_K_M quantization..."
    for model in \
      "llama3.2:3b-instruct-q4_K_M" \
      "mistral:7b-instruct-q4_K_M" \
      "qwen2.5-coder:7b-instruct-q4_K_M"; do
      info "  Pulling $model..."
      docker exec sb-ollama-bake ollama pull "$model" || warn "  Failed to pull $model — it may need to be pulled manually."
    done

    # Create SimpleBeacon-optimized models
    info "Creating SimpleBeacon-optimized models from Modelfiles..."
    docker exec sb-ollama-bake ollama create unbreakable-oracle -f /models/Modelfile 2>&1 || warn "Failed to create unbreakable-oracle"
    docker exec sb-ollama-bake ollama create simplebeacon-llama32 -f /models/Modelfile.llama32 2>&1 || warn "Failed to create simplebeacon-llama32"
    docker exec sb-ollama-bake ollama create simplebeacon-mistral -f /models/Modelfile.mistral 2>&1 || warn "Failed to create simplebeacon-mistral"
    docker exec sb-ollama-bake ollama create simplebeacon-qwen-coder -f /models/Modelfile.qwen25-coder 2>&1 || warn "Failed to create simplebeacon-qwen-coder"

    # List created models
    info "Created models:"
    docker exec sb-ollama-bake ollama list 2>&1 || true
  fi

  # Verify all 4 required models were created before exporting
  if $ollama_ready; then
    info "Verifying required models..."
    local required_models=("unbreakable-oracle" "simplebeacon-llama32" "simplebeacon-mistral" "simplebeacon-qwen-coder")
    local missing_models=()
    local model_list
    model_list=$(docker exec sb-ollama-bake ollama list 2>/dev/null || echo "")
    for req_model in "${required_models[@]}"; do
      if echo "$model_list" | grep -q "$req_model"; then
        info "  ✓ $req_model"
      else
        warn "  ✗ $req_model — MISSING"
        missing_models+=("$req_model")
      fi
    done

    if [ ${#missing_models[@]} -gt 0 ]; then
      warn "WARNING: ${#missing_models[@]} model(s) missing from the archive."
      warn "The air-gapped deployment may not have all required models."
      warn "Missing: ${missing_models[*]}"
    fi
  else
    warn "Skipping model verification — Ollama daemon was not ready."
    warn "All 4 models will be missing from the archive."
  fi

  # Stop the bake container BEFORE exporting the volume to prevent
  # concurrent writes from corrupting the tar archive
  info "Stopping Ollama bake container..."
  docker stop sb-ollama-bake 2>/dev/null || true
  docker rm sb-ollama-bake 2>/dev/null || true
  sleep 2

  # Step 3: Export Ollama model volume (container stopped — no concurrent writes)
  log "Step 3/5: Exporting Ollama model data..."
  local win_output_dir
  win_output_dir=$(cygpath -m "$output_dir" 2>/dev/null || echo "$output_dir")
  docker run --rm -v ollama-models:/data -v "$win_output_dir":/out alpine:latest tar -czf /out/ollama-models.tar.gz -C /data .
  info "Exported Ollama models to: $output_dir/ollama-models.tar.gz"

  # Step 4: Save Docker images to archive
  log "Step 4/5: Saving Docker images to archive..."
  local images_archive="$output_dir/images.tar"
  local win_images_archive
  win_images_archive=$(cygpath -m "$images_archive" 2>/dev/null || echo "$images_archive")
  docker save "${IMAGE_NAMES[@]}" -o "$win_images_archive"
  info "Saved images to: $images_archive ($(du -h "$images_archive" | cut -f1))"

  # Step 5: Bundle compose files, env template, and Modelfiles
  log "Step 5/5: Bundling configuration files..."
  cp "$PROJECT_ROOT/$COMPOSE_FILE" "$output_dir/"
  cp "$PROJECT_ROOT/$GPU_OVERRIDE" "$output_dir/"
  cp "$PROJECT_ROOT/$ENV_TEMPLATE" "$output_dir/" 2>/dev/null || warn "Env template not found: $ENV_TEMPLATE"
  cp "$PROJECT_ROOT/coming-soon/public/models/manifest.json" "$output_dir/"
  cp "$PROJECT_ROOT/coming-soon/public/models/memory-profiles.json" "$output_dir/"
  cp "$PROJECT_ROOT/docs/PRODUCTION_ENV_VARS.md" "$output_dir/" 2>/dev/null || warn "Env var spec not found"
  cp "$PROJECT_ROOT/docs/FIELD_ENGINEER_RUNBOOK.md" "$output_dir/" 2>/dev/null || warn "Field Engineer Runbook not found"
  mkdir -p "$output_dir/scripts"
  cp "$PROJECT_ROOT/scripts/validate-airgap-deploy.sh" "$output_dir/scripts/"
  cp "$PROJECT_ROOT/scripts/detect-hardware-profile.sh" "$output_dir/scripts/"
  cp "$PROJECT_ROOT/scripts/export-diagnostics-bundle.sh" "$output_dir/scripts/"
  cp "$PROJECT_ROOT/scripts/test-airgap-faults.sh" "$output_dir/scripts/"
  cp "${BASH_SOURCE[0]}" "$output_dir/hydrate-airgap.sh"

  # Create the final compressed archive
  log "Creating compressed archive: $ARCHIVE_NAME"
  tar -czf "$output_dir/$ARCHIVE_NAME" \
    -C "$output_dir" \
    images.tar \
    ollama-models.tar.gz \
    "$COMPOSE_FILE" \
    "$GPU_OVERRIDE" \
    "$ENV_TEMPLATE" \
    manifest.json \
    memory-profiles.json \
    PRODUCTION_ENV_VARS.md \
    FIELD_ENGINEER_RUNBOOK.md \
    hydrate-airgap.sh \
    scripts/validate-airgap-deploy.sh \
    scripts/detect-hardware-profile.sh \
    scripts/export-diagnostics-bundle.sh \
    scripts/test-airgap-faults.sh

  rm -f "$images_archive"  # Remove intermediate tar

  local archive_size
  archive_size=$(du -h "$output_dir/$ARCHIVE_NAME" | cut -f1)
  log "Packaging complete!"
  info "Archive: $output_dir/$ARCHIVE_NAME ($archive_size)"
  info ""
  info "Transfer this archive to the air-gapped target machine via:"
  info "  - USB drive"
  info "  - Internal secure file share"
  info "  - Physical media (DVD/Blu-ray)"
  info ""
  info "Then run on the target machine:"
  info "  ./hydrate-airgap.sh deploy $ARCHIVE_NAME .env.enterprise"
}

# ── Deploy Phase ───────────────────────────────────────────────────────────

deploy() {
  local archive_path="${1:-$SCRIPT_DIR/dist/$ARCHIVE_NAME}"
  local env_file="${2:-.env.enterprise}"

  log "Starting air-gapped deployment..."
  info "Archive: $archive_path"
  info "Env file: $env_file"

  check_airgap_prerequisites

  if [ ! -f "$archive_path" ]; then
    err "Archive not found: $archive_path"
    exit 1
  fi

  # Step 1: Extract archive
  log "Step 1/4: Extracting archive..."
  local deploy_dir
  deploy_dir="$(mktemp -d)"
  tar -xzf "$archive_path" -C "$deploy_dir"
  info "Extracted to: $deploy_dir"

  # Step 2: Load Docker images
  log "Step 2/4: Loading Docker images..."
  docker load -i "$deploy_dir/images.tar" 2>/dev/null || {
    # If images.tar was not included (newer format), load from the archive directly
    warn "images.tar not found in archive — images may need to be loaded separately."
  }

  # Verify images are loaded
  for image in "${IMAGE_NAMES[@]}"; do
    if docker image inspect "$image" > /dev/null 2>&1; then
      info "  ✓ $image loaded"
    else
      err "  ✗ $image not found — archive may be incomplete."
      exit 1
    fi
  done

  # Step 3: Copy compose files to deployment directory
  log "Step 3/4: Copying configuration files..."
  local target_dir
  target_dir="$(pwd)"
  cp "$deploy_dir/$COMPOSE_FILE" "$target_dir/"
  cp "$deploy_dir/$GPU_OVERRIDE" "$target_dir/"

  if [ -f "$env_file" ]; then
    info "Using env file: $env_file"
  else
    warn "Env file not found: $env_file"
    if [ -f "$deploy_dir/$ENV_TEMPLATE" ]; then
      warn "Copying template — edit it before starting the stack."
      cp "$deploy_dir/$ENV_TEMPLATE" "$env_file"
    fi
  fi

  # Import bundled Ollama models into the named volume
  if [ -f "$deploy_dir/ollama-models.tar.gz" ]; then
    log "Importing Ollama models..."
    local win_deploy_dir
    win_deploy_dir=$(cygpath -m "$deploy_dir" 2>/dev/null || echo "$deploy_dir")
    docker run --rm -v ollama-models:/data -v "$win_deploy_dir/ollama-models.tar.gz":/out/ollama-models.tar.gz alpine:latest tar -xzf /out/ollama-models.tar.gz -C /data
    info "Ollama models imported."
  fi

  # Step 4: Start the stack
  log "Step 4/4: Starting Docker Compose stack..."
  cd "$target_dir"

  # Export ENV_FILE so docker-compose.enterprise.yml's env_file directive
  # (${ENV_FILE:-.env.enterprise}) resolves to the user-specified file
  export ENV_FILE="$env_file"

  # Check for GPU availability
  if docker info 2>/dev/null | grep -q "Runtimes:.*nvidia"; then
    info "NVIDIA GPU runtime detected — starting with GPU support."
    docker compose -f "$COMPOSE_FILE" -f "$GPU_OVERRIDE" --env-file "$env_file" up -d
  else
    info "No GPU runtime detected — starting in CPU-only mode."
    docker compose -f "$COMPOSE_FILE" --env-file "$env_file" up -d
  fi

  # Cleanup
  rm -rf "$deploy_dir"

  log "Deployment complete!"
  info ""

  # Run the validation suite automatically with safe recovery (non-blocking)
  local validate_script="$SCRIPT_DIR/validate-airgap-deploy.sh"
  if [ -f "$validate_script" ]; then
    info "Running post-deployment validation suite (with safe auto-recovery)..."
    # Wait for containers to settle before validating
    info "Waiting 10s for containers to initialize..."
    sleep 10
    if bash "$validate_script" --recover-safe; then
      log "Post-deployment validation passed — stack is healthy."
    else
      warn "Post-deployment validation reported failures."
      warn "Run './scripts/validate-airgap-deploy.sh --verbose --recover' for recovery attempts."
    fi
  else
    info "Verify the deployment with:"
    info "  ./scripts/validate-airgap-deploy.sh"
  fi
  info ""
  info "Access the dashboard at: http://localhost:3000"
  info "Ollama API at: http://localhost:11434"
}

# ── Verify Phase ───────────────────────────────────────────────────────────

verify() {
  local validate_script=""
  # Look for validate-airgap-deploy.sh in both layouts:
  # 1. Repo layout: scripts/validate-airgap-deploy.sh (SCRIPT_DIR is scripts/)
  # 2. Archive layout: scripts/validate-airgap-deploy.sh (SCRIPT_DIR is the
  #    archive root, so the script is in $SCRIPT_DIR/scripts/)
  if [ -f "$SCRIPT_DIR/validate-airgap-deploy.sh" ]; then
    validate_script="$SCRIPT_DIR/validate-airgap-deploy.sh"
  elif [ -f "$SCRIPT_DIR/scripts/validate-airgap-deploy.sh" ]; then
    validate_script="$SCRIPT_DIR/scripts/validate-airgap-deploy.sh"
  fi

  if [ -n "$validate_script" ] && [ -f "$validate_script" ]; then
    log "Running comprehensive validation suite..."
    bash "$validate_script" "$@"
  else
    # Fallback to basic checks if the validation script is not present
    log "Validation script not found — running basic checks..."
    local failures=0

    for container in simplebeacon-engine simplebeacon-ollama simplebeacon-db; do
      if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        info "  ✓ $container is running"
      else
        err "  ✗ $container is NOT running"
        failures=$((failures + 1))
      fi
    done

    if [ $failures -eq 0 ]; then
      log "All basic checks passed."
      info "Dashboard: http://localhost:3000"
      info "Ollama:    http://localhost:11434"
    else
      err "$failures check(s) failed."
      exit 1
    fi
  fi
}

# ── Help ───────────────────────────────────────────────────────────────────

show_help() {
  cat << 'HELP'
SimpleBeacon Air-Gapped Hydration Script

Usage:
  hydrate-airgap.sh <command> [options]

Commands:
  package [output-dir]    Build and package the entire stack into a portable archive
                          output-dir defaults to ./dist

  deploy [archive] [env]  Load and start the stack from an archive
                          archive defaults to ./dist/simplebeacon-airgap-v1.tar.gz
                          env defaults to .env.enterprise

  verify                  Run the full post-deployment validation suite
                          (delegates to validate-airgap-deploy.sh)
                          Pass --json for JSON output, --verbose for full output
                          Pass --recover or --recover-safe for auto-recovery
                          Pass --export-bundle to create a diagnostics archive
                          Pass --benchmark to run throughput benchmark (tok/s)

  help                    Show this help message

Examples:
  # On build machine (with internet):
  ./hydrate-airgap.sh package /tmp/airgap

  # On air-gapped target machine:
  ./hydrate-airgap.sh deploy /tmp/airgap/simplebeacon-airgap-v1.tar.gz .env.enterprise

  # Verify deployment:
  ./hydrate-airgap.sh verify

Environment:
  The script uses .env.enterprise for deployment configuration.
  See .env.enterprise.example for a template.

HELP
}

# ── Main ───────────────────────────────────────────────────────────────────

case "${1:-help}" in
  package)
    package "${2:-}"
    ;;
  deploy)
    deploy "${2:-}" "${3:-}"
    ;;
  verify)
    shift  # Remove the "verify" subcommand from $@
    verify "$@"
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    err "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
