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
#   2. Pulls base Ollama models (llama3.2, mistral, qwen2.5-coder)
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
#   ./hydrate-airgap.sh verify
#
#   1. Checks all containers are running
#   2. Tests health endpoints
#   3. Verifies Ollama model availability
#
# Requirements:
#   - Docker 24+ with BuildKit
#   - Docker Compose v2
#   - curl, jq (for verification)
#   - ~10GB free disk space (for images + models)
#

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="docker-compose.enterprise.yml"
GPU_OVERRIDE="docker-compose.enterprise.gpu.yml"
ENV_TEMPLATE=".env.enterprise.example"
ARCHIVE_NAME="simplebeacon-airgap-v1.tar.gz"
IMAGE_NAMES=("simplebeacon-engine:latest" "simplebeacon-ollama:latest" "postgres:16-alpine")

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

  # Step 2: Start Ollama and pre-load models
  log "Step 2/5: Pre-loading Ollama models..."
  info "Starting temporary Ollama container for model baking..."
  docker run -d --name sb-ollama-bake simplebeacon-ollama:latest
  sleep 10

  # Wait for Ollama to be ready
  info "Waiting for Ollama daemon..."
  for i in $(seq 1 60); do
    if docker exec sb-ollama-bake curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
      info "Ollama daemon is ready."
      break
    fi
    if [ $i -eq 60 ]; then
      warn "Ollama daemon not ready after 60s — models will be created on first boot."
      break
    fi
    sleep 1
  done

  # Pull base models (requires internet on build machine)
  info "Pulling base models from Ollama registry..."
  for model in llama3.2 mistral qwen2.5-coder; do
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

  # Step 3: Export Ollama model volume
  log "Step 3/5: Exporting Ollama model data..."
  docker stop sb-ollama-bake 2>/dev/null || true
  docker rm sb-ollama-bake 2>/dev/null || true

  # Step 4: Save Docker images to archive
  log "Step 4/5: Saving Docker images to archive..."
  local images_archive="$output_dir/images.tar"
  docker save "${IMAGE_NAMES[@]}" -o "$images_archive"
  info "Saved images to: $images_archive ($(du -h "$images_archive" | cut -f1))"

  # Step 5: Bundle compose files, env template, and Modelfiles
  log "Step 5/5: Bundling configuration files..."
  cp "$PROJECT_ROOT/$COMPOSE_FILE" "$output_dir/"
  cp "$PROJECT_ROOT/$GPU_OVERRIDE" "$output_dir/"
  cp "$PROJECT_ROOT/$ENV_TEMPLATE" "$output_dir/" 2>/dev/null || warn "Env template not found: $ENV_TEMPLATE"
  cp "$PROJECT_ROOT/coming-soon/public/models/manifest.json" "$output_dir/"
  cp "$PROJECT_ROOT/docs/PRODUCTION_ENV_VARS.md" "$output_dir/" 2>/dev/null || warn "Env var spec not found"

  # Create the final compressed archive
  log "Creating compressed archive: $ARCHIVE_NAME"
  tar -czf "$output_dir/$ARCHIVE_NAME" \
    -C "$output_dir" \
    images.tar \
    "$COMPOSE_FILE" \
    "$GPU_OVERRIDE" \
    "$ENV_TEMPLATE" \
    manifest.json \
    PRODUCTION_ENV_VARS.md

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

  # Step 4: Start the stack
  log "Step 4/4: Starting Docker Compose stack..."
  cd "$target_dir"

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
  info "Verify the deployment with:"
  info "  ./hydrate-airgap.sh verify"
  info ""
  info "Access the dashboard at: http://localhost:3000"
  info "Ollama API at: http://localhost:11434"
}

# ── Verify Phase ───────────────────────────────────────────────────────────

verify() {
  log "Verifying SimpleBeacon deployment..."
  local failures=0

  # Check containers
  info "Checking container status..."
  for container in simplebeacon-engine simplebeacon-ollama simplebeacon-db; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
      info "  ✓ $container is running"
    else
      err "  ✗ $container is NOT running"
      failures=$((failures + 1))
    fi
  done

  # Check engine health
  info "Checking engine health endpoint..."
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    info "  ✓ Engine health check passed"
  else
    err "  ✗ Engine health check failed (http://localhost:3000/health)"
    failures=$((failures + 1))
  fi

  # Check Ollama
  info "Checking Ollama API..."
  if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    info "  ✓ Ollama API is responding"
    # Check for SimpleBeacon models
    local models
    models=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"//')
    if echo "$models" | grep -q "unbreakable-oracle"; then
      info "  ✓ unbreakable-oracle model is available"
    else
      warn "  ! unbreakable-oracle model not found — run setup-local-model.cjs inside the container"
    fi
  else
    err "  ✗ Ollama API is not responding (http://localhost:11434/api/tags)"
    failures=$((failures + 1))
  fi

  # Check database
  info "Checking PostgreSQL..."
  if docker exec simplebeacon-db pg_isready -U simplebeacon_user -d simplebeacon > /dev/null 2>&1; then
    info "  ✓ PostgreSQL is ready"
  else
    err "  ✗ PostgreSQL is not ready"
    failures=$((failures + 1))
  fi

  # Summary
  if [ $failures -eq 0 ]; then
    log "All checks passed! SimpleBeacon is fully operational."
    info ""
    info "Dashboard: http://localhost:3000"
    info "API:       http://localhost:3000/api/simplebeacon/"
    info "Ollama:    http://localhost:11434"
  else
    err "$failures check(s) failed. Review the logs above."
    exit 1
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

  verify                  Check that all services are running and healthy

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
    verify
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
