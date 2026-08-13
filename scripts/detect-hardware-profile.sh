#!/bin/bash
#
# SimpleBeacon Hardware Profile Detector
#
# Detects available RAM and GPU VRAM on the host machine and recommends
# the appropriate memory profile for Ollama model deployment.
#
# Usage:
#   ./detect-hardware-profile.sh           # Print recommendation
#   ./detect-hardware-profile.sh --json    # Output JSON for automation
#   ./detect-hardware-profile.sh --apply   # Write profile to .env.enterprise
#
# Profiles (see coming-soon/public/models/memory-profiles.json):
#   minimal  — 8GB RAM, no GPU, CPU-only inference
#   balanced — 16GB RAM, 6GB VRAM, auto GPU offload (recommended default)
#   maximum  — 32GB RAM, 12GB VRAM, full GPU offload
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROFILES_FILE="$PROJECT_ROOT/coming-soon/public/models/memory-profiles.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[SimpleBeacon]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Detect total system RAM in GB ────────────────────────────────────────────

detect_ram_gb() {
  local ram_kb

  if command -v free &> /dev/null; then
    # Linux
    ram_kb=$(free -k | awk '/^Mem:/ {print $2}')
  elif command -v sysctl &> /dev/null; then
    # macOS / BSD
    local ram_bytes
    ram_bytes=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    ram_kb=$((ram_bytes / 1024))
  elif [ -f /proc/meminfo ]; then
    # Linux fallback
    ram_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
  elif command -v wmic &> /dev/null; then
    # Windows (Git Bash / MSYS2)
    local ram_bytes
    ram_bytes=$(wmic computersystem get TotalPhysicalMemory 2>/dev/null | tr -d ' \r' | grep -E '^[0-9]+$' | head -1)
    ram_kb=$((ram_bytes / 1024))
  else
    warn "Could not detect RAM — assuming 16GB (balanced profile)."
    echo 16
    return
  fi

  if [ -z "$ram_kb" ] || [ "$ram_kb" -eq 0 ] 2>/dev/null; then
    warn "Could not detect RAM — assuming 16GB (balanced profile)."
    echo 16
    return
  fi

  local ram_gb
  ram_gb=$((ram_kb / 1024 / 1024))
  echo "$ram_gb"
}

# ── Detect GPU VRAM in GB ────────────────────────────────────────────────────

detect_vram_gb() {
  local vram_mb=0

  if command -v nvidia-smi &> /dev/null; then
    # NVIDIA GPU — query total VRAM across all GPUs
    vram_mb=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | awk '{s+=$1} END {print s}')
    if [ -z "$vram_mb" ] || [ "$vram_mb" = "0" ] 2>/dev/null; then
      vram_mb=0
    fi
  fi

  if [ "$vram_mb" -eq 0 ] 2>/dev/null && command -v system_profiler &> /dev/null; then
    # macOS — check for Apple Silicon unified memory or AMD GPU
    local gpu_type
    gpu_type=$(system_profiler SPDisplaysDataType 2>/dev/null | grep -i "Chipset\|VRAM\|Total Number of Cores" | head -3)
    if echo "$gpu_type" | grep -qi "Apple Silicon\|Metal"; then
      # Apple Silicon — unified memory, report half of total RAM as "VRAM"
      local ram_gb
      ram_gb=$(detect_ram_gb)
      vram_mb=$((ram_gb * 1024 / 2))
    fi
  fi

  if [ "$vram_mb" -eq 0 ] 2>/dev/null && command -v wmic &> /dev/null; then
    # Windows — check for NVIDIA/AMD GPU via wmic
    local gpu_name
    gpu_name=$(wmic path win32_VideoController get name 2>/dev/null | tr -d '\r' | grep -i "NVIDIA\|AMD\|Radeon" | head -1)
    if [ -n "$gpu_name" ]; then
      # Can't easily get VRAM via wmic — assume 8GB for discrete GPU
      warn "Detected GPU ($gpu_name) but could not query VRAM — assuming 8GB."
      vram_mb=8192
    fi
  fi

  local vram_gb
  vram_gb=$((vram_mb / 1024))
  echo "$vram_gb"
}

# ── Detect CPU cores ─────────────────────────────────────────────────────────

detect_cpu_cores() {
  local cores

  if command -v nproc &> /dev/null; then
    cores=$(nproc)
  elif [ -f /proc/cpuinfo ]; then
    cores=$(grep -c '^processor' /proc/cpuinfo)
  elif command -v sysctl &> /dev/null; then
    cores=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
  elif command -v wmic &> /dev/null; then
    cores=$(wmic cpu get NumberOfCores 2>/dev/null | tr -d ' \r' | grep -E '^[0-9]+$' | head -1)
    if [ -z "$cores" ]; then cores=4; fi
  else
    cores=4
  fi

  echo "${cores:-4}"
}

# ── Recommend a profile based on hardware ────────────────────────────────────

recommend_profile() {
  local ram_gb=$1
  local vram_gb=$2

  # Maximum: 32GB+ RAM and 12GB+ VRAM
  if [ "$ram_gb" -ge 32 ] && [ "$vram_gb" -ge 12 ]; then
    echo "maximum"
  # Balanced: 16GB+ RAM and (6GB+ VRAM or no GPU but enough RAM for CPU)
  elif [ "$ram_gb" -ge 16 ]; then
    echo "balanced"
  # Minimal: anything below 16GB RAM
  else
    echo "minimal"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  local ram_gb vram_gb cpu_cores profile output_format

  output_format="text"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json)  output_format="json"; shift ;;
      --apply) output_format="apply"; shift ;;
      --help|-h)
        cat << 'HELP'
SimpleBeacon Hardware Profile Detector

Usage:
  detect-hardware-profile.sh [--json|--apply]

  --json   Output recommendation as JSON for automation
  --apply  Write OLLAMA_MEMORY_PROFILE to .env.enterprise
  (none)   Print human-readable recommendation

Profiles:
  minimal  — 8GB RAM, no GPU, CPU-only (Q4_K_M, 2048 ctx)
  balanced — 16GB RAM, 6GB VRAM, auto GPU (Q4_K_M, 4096 ctx) [default]
  maximum  — 32GB RAM, 12GB VRAM, full GPU (Q5_K_M, 8192 ctx)
HELP
        exit 0
        ;;
      *) err "Unknown option: $1"; exit 1 ;;
    esac
  done

  log "Detecting hardware capabilities..."

  ram_gb=$(detect_ram_gb)
  vram_gb=$(detect_vram_gb)
  cpu_cores=$(detect_cpu_cores)
  profile=$(recommend_profile "$ram_gb" "$vram_gb")

  case "$output_format" in
    json)
      cat << EOF
{
  "ramGB": $ram_gb,
  "vramGB": $vram_gb,
  "cpuCores": $cpu_cores,
  "recommendedProfile": "$profile",
  "profiles": {
    "minimal":  { "eligible": $([ "$profile" = "minimal" ] && echo true || echo false) },
    "balanced": { "eligible": $([ "$ram_gb" -ge 16 ] && echo true || echo false) },
    "maximum":  { "eligible": $([ "$ram_gb" -ge 32 ] && [ "$vram_gb" -ge 12 ] && echo true || echo false) }
  }
}
EOF
      ;;

    apply)
      local env_file="$PROJECT_ROOT/.env.enterprise"
      if [ ! -f "$env_file" ]; then
        env_file="$PROJECT_ROOT/.env.enterprise.example"
        warn "No .env.enterprise found — writing to .env.enterprise.example"
      fi

      # Remove existing OLLAMA_MEMORY_PROFILE line and append new one
      if grep -q "^OLLAMA_MEMORY_PROFILE=" "$env_file"; then
        sed -i.bak "s/^OLLAMA_MEMORY_PROFILE=.*/OLLAMA_MEMORY_PROFILE=$profile/" "$env_file"
        rm -f "$env_file.bak"
      else
        echo "OLLAMA_MEMORY_PROFILE=$profile" >> "$env_file"
      fi

      log "Set OLLAMA_MEMORY_PROFILE=$profile in $env_file"
      info "Edit .env.enterprise to adjust OLLAMA_NUM_CTX and OLLAMA_NUM_GPU accordingly."
      info "See coming-soon/public/models/memory-profiles.json for recommended values."
      ;;

    text)
      echo ""
      info "Hardware Detection Results:"
      echo "  RAM:        $ram_gb GB"
      echo "  VRAM:       $vram_gb GB $([ "$vram_gb" -eq 0 ] && echo "(no GPU detected)" || echo "")"
      echo "  CPU Cores:  $cpu_cores"
      echo ""
      log "Recommended Profile: $profile"
      echo ""

      case "$profile" in
        minimal)
          info "Minimal Profile — CPU-only inference"
          echo "  Quantization: Q4_K_M (~4.4 GB RAM)"
          echo "  Context:      2048 tokens"
          echo "  GPU offload:  0 layers (CPU only)"
          echo "  Expected:     5-15 tokens/sec"
          echo ""
          warn "Inference will be slow. Consider upgrading to 16GB RAM for balanced profile."
          ;;
        balanced)
          info "Balanced Profile — Auto GPU offload (recommended)"
          echo "  Quantization: Q4_K_M (~4.4 GB VRAM)"
          echo "  Context:      4096-8192 tokens"
          echo "  GPU offload:  Auto (-1, Ollama detects VRAM)"
          echo "  Expected:     20-50 tokens/sec"
          ;;
        maximum)
          info "Maximum Profile — Full GPU offload"
          echo "  Quantization: Q5_K_M (~5.1 GB VRAM)"
          echo "  Context:      8192-32768 tokens"
          echo "  GPU offload:  Maximum (999 layers)"
          echo "  Expected:     50-100+ tokens/sec"
          ;;
      esac

      echo ""
      info "To apply this profile:"
      echo "  ./scripts/detect-hardware-profile.sh --apply"
      echo ""
      info "Or set manually in .env.enterprise:"
      echo "  OLLAMA_MEMORY_PROFILE=$profile"
      ;;
  esac
}

main "$@"
