# SimpleBeacon Air-Gapped Deployment — Operational Readiness Summary

**Version:** 1.0  
**Date:** 2026-01-15  
**Status:** Production Ready  
**Commits:** D `37153d608` → I `4fd3d450b`

---

## 1. Executive Summary

SimpleBeacon's air-gapped deployment system enables enterprise customers to run the full scanning and remediation platform on network-isolated machines — no internet access required. The system packages all Docker images, Ollama models, and configuration into a single transferable archive, deploys with hardware-aware resource tuning, validates the deployment with 15 automated checks, self-heals common failures, exports encrypted diagnostics for post-mortem analysis, proves the recovery system works via chaos testing, and benchmarks real inference throughput against profile expectations.

This document covers the complete operational lifecycle for QA, Security Operations, and field engineering teams.

---

## 2. Sprint Inventory

| Sprint | Commit      | Name                 | Capability                                                                                     |
| ------ | ----------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| D      | `37153d608` | Hydration Engine     | Zero-network model packaging with Windows path conversion and offline mode                     |
| E      | `0dfb70c97` | Resource Governor    | Hardware detection, memory profiles, Q4_K_M/Q5_K_M quantization, GPU offload                   |
| F      | `1e645a0ea` | Observability Agent  | 14-check post-deployment validation suite with JSON output                                     |
| G      | `d125c87ed` | Self-Healing Loop    | Hybrid recovery: safe auto-restart, destructive prompted, manual with OS-specific instructions |
| H      | `89588f028` | Secure Exporter      | Encrypted diagnostics bundle with 23-pattern secret sanitization and AES-256-CBC               |
| K      | `e43fbf604` | Chaos Verification   | 8-scenario fault injection harness with QA evidence output                                     |
| I      | `4fd3d450b` | Throughput Benchmark | tok/s measurement with 4 throttle detection sub-checks against profile expectations            |

---

## 3. Script Inventory

All scripts live in `scripts/` and are included in the air-gap package archive.

| Script                         | Lines | Purpose                                                        |
| ------------------------------ | ----- | -------------------------------------------------------------- |
| `hydrate-airgap.sh`            | ~430  | Package, deploy, and verify entry point                        |
| `validate-airgap-deploy.sh`    | ~1430 | 15-check validation + hybrid recovery + benchmark              |
| `detect-hardware-profile.sh`   | ~200  | Hardware detection (RAM, VRAM, CPU) and profile recommendation |
| `export-diagnostics-bundle.sh` | ~572  | Encrypted diagnostics archive with secret sanitization         |
| `test-airgap-faults.sh`        | ~792  | 8-scenario chaos/fault injection QA harness                    |

### Air-gap package archive contents

```
simplebeacon-airgap-v1.tar.gz
├── images.tar                          # Docker images (engine, ollama, postgres)
├── ollama-models.tar.gz                # Exported Ollama model volume
├── docker-compose.enterprise.yml       # CPU compose config
├── docker-compose.enterprise.gpu.yml   # GPU override
├── .env.enterprise.example             # Environment template
├── manifest.json                       # Package metadata (v2)
├── memory-profiles.json                # Memory profile definitions
├── PRODUCTION_ENV_VARS.md              # Environment variable spec
├── FIELD_ENGINEER_RUNBOOK.md           # Field engineer guide
├── hydrate-airgap.sh                   # Package + deploy + verify entry point
└── scripts/
    ├── validate-airgap-deploy.sh       # 15-check validation + hybrid recovery + benchmark
    ├── detect-hardware-profile.sh      # Hardware detection + profile recommendation
    ├── export-diagnostics-bundle.sh    # Encrypted diagnostics exporter
    └── test-airgap-faults.sh           # Chaos/fault injection QA harness
```

---

## 4. Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ BUILD MACHINE (internet-connected)                              │
│                                                                 │
│  1. hydrate-airgap.sh package                                   │
│     ├── Pull Q4_K_M / Q5_K_M quantized models                   │
│     ├── Create SimpleBeacon Ollama models from Modelfiles       │
│     ├── Export Ollama model volume → ollama-models.tar.gz       │
│     ├── Save Docker images → images.tar                         │
│     └── Bundle compose, env, manifests, scripts → .tar.gz       │
│                                                                 │
│  2. Transfer archive via USB / secure media                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ TARGET MACHINE (air-gapped)                                     │
│                                                                 │
│  3. hydrate-airgap.sh deploy <archive> <env>                    │
│     ├── Extract archive to temp directory                       │
│     ├── Load Docker images (docker load)                        │
│     ├── Import Ollama volume (docker volume + tar)              │
│     ├── Start stack (docker compose up -d)                      │
│     ├── Wait 10s for containers to settle                      │
│     └── Run validation with --recover-safe (auto-heal)          │
│                                                                 │
│  4. validate-airgap-deploy.sh (automatic)                       │
│     ├── 14 health checks (Docker, containers, API, models)      │
│     ├── Safe auto-recovery for transient failures               │
│     └── Report pass/fail to technician                          │
│                                                                 │
│  5. Optional: --benchmark                                       │
│     └── Measure tok/s against profile expectations              │
│                                                                 │
│  6. Optional: --export-bundle                                   │
│     └── Create encrypted diagnostics archive                    │
│                                                                 │
│  7. Optional: test-airgap-faults.sh                             │
│     └── Prove recovery system with chaos testing                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Memory Profiles

| Profile    | Target Hardware       | Quantization | Context    | GPU Offload    | RAM/VRAM        | Expected tok/s |
| ---------- | --------------------- | ------------ | ---------- | -------------- | --------------- | -------------- |
| `minimal`  | 8GB RAM, no GPU       | Q4_K_M       | 2048       | `0` (CPU-only) | ~4.4GB RAM      | 5-15           |
| `balanced` | 16GB RAM, 6GB VRAM    | Q4_K_M       | 4096-8192  | `-1` (auto)    | ~5.5GB combined | 20-50          |
| `maximum`  | 32GB+ RAM, 12GB+ VRAM | Q5_K_M       | 8192-32768 | `999` (max)    | ~6.5GB combined | 50-100+        |

### Profile selection

```bash
# Auto-detect hardware and recommend a profile
./scripts/detect-hardware-profile.sh

# Apply recommended profile
./scripts/detect-hardware-profile.sh --apply
```

### Required models

| Model Name                | Base Model                | Purpose                                    |
| ------------------------- | ------------------------- | ------------------------------------------ |
| `unbreakable-oracle`      | `llama3.2:3b-instruct-q4_K_M`      | Primary inference (smoke test + benchmark) |
| `simplebeacon-llama32`    | `llama3.2:3b-instruct-q4_K_M`      | General-purpose LLM                        |
| `simplebeacon-mistral`    | `mistral:7b-instruct-q4_K_M`       | Advanced reasoning                         |
| `simplebeacon-qwen-coder` | `qwen2.5-coder:7b-instruct-q4_K_M` | Code analysis and remediation              |

---

## 6. Validation Checks (15)

| #   | Check                 | What It Verifies                               | Recovery Type                              |
| --- | --------------------- | ---------------------------------------------- | ------------------------------------------ |
| 1   | Docker daemon         | Docker is running                              | Manual (OS-specific instructions)          |
| 2   | Container status      | Engine, Ollama, DB running                     | **Safe auto**: restart container           |
| 3   | Exposed ports         | Port mapping correct                           | Manual (compose config debugging)          |
| 4   | Ollama API health     | `/` and `/api/tags` respond                    | **Safe auto**: restart Ollama              |
| 5   | Required models       | All 4 models present                           | **Destructive**: re-import from archive    |
| 6   | Model layer integrity | `ollama show` succeeds                         | **Destructive**: recreate from Modelfile   |
| 7   | Inference smoke test  | Model generates output                         | Manual (5-cause diagnosis steps)           |
| 8   | Engine health         | `/health` endpoint responds                    | **Safe auto**: restart engine              |
| 9   | Engine-to-Ollama DNS  | Docker DNS path works                          | **Safe auto**: restart engine              |
| 10  | PostgreSQL readiness  | `pg_isready` passes                            | **Safe auto**: restart DB                  |
| 11  | PostgreSQL schema     | 4 key tables exist                             | **Safe auto**: re-run idempotent migration |
| 12  | Memory profile        | Profile name valid, no contradictions          | Manual (config correction)                 |
| 13  | Offline mode          | `SIMPLEBEACON_OFFLINE=true`, no external conns | Manual (env var correction)                |
| 14  | Disk space            | ≥10GB available                                | Manual (4 cleanup commands)                |
| 15  | Throughput benchmark  | tok/s ≥ 80% of profile minimum                 | Manual (throttle diagnosis)                |

### Recovery model (hybrid)

| Recovery Type | When                            | Actions                              | Data Loss |
| ------------- | ------------------------------- | ------------------------------------ | --------- |
| Safe auto     | `--recover-safe` or `--recover` | Restart containers, re-run migration | None      |
| Destructive   | `--recover` only (prompts)      | Purge model volume, recreate models  | Possible  |
| Manual        | Always on failure               | Print OS-specific instructions       | N/A       |

---

## 7. Benchmark Thresholds

| Profile  | Min tok/s | Max tok/s | Throttle Threshold (80%) | CPU-Only Max |
| -------- | --------- | --------- | ------------------------ | ------------ |
| minimal  | 5         | 15        | 4.0                      | 15           |
| balanced | 20        | 50        | 16.0                     | 15           |
| maximum  | 50        | 100       | 40.0                     | 15           |

### Throttle detection sub-checks

| Sub-check        | Condition                             | Severity | What It Catches                         |
| ---------------- | ------------------------------------- | -------- | --------------------------------------- |
| 15a: Throughput  | tok/s < 80% of profile min            | **FAIL** | Thermal throttling, resource contention |
| 15a: Below min   | tok/s < profile min but > 80%         | WARN     | Suboptimal but functional               |
| 15b: GPU failure | GPU configured but tok/s in CPU range | WARN     | GPU driver failure, CUDA unavailable    |
| 15c: Variance    | CV > 20% across runs                  | WARN     | Thread contention, thermal instability  |
| 15d: Thermal     | CPU temp > 85°C                       | WARN     | Confirmed thermal throttling            |

---

## 8. Chaos Test Scenarios

| #   | Scenario            | Fault                            | Recovery    | Expected Outcome                      |
| --- | ------------------- | -------------------------------- | ----------- | ------------------------------------- |
| 1   | Stop engine         | `docker stop engine`             | Safe auto   | Container restarts, health passes     |
| 2   | Stop ollama         | `docker stop ollama`             | Safe auto   | Container restarts, API responds      |
| 3   | Stop db             | `docker stop db`                 | Safe auto   | Container restarts, pg_isready passes |
| 4   | Kill Ollama process | `kill $(pgrep ollama)`           | Safe auto   | Container restarts, API responds      |
| 5   | Drop DB table       | `DROP TABLE scan_counts`         | Safe auto   | Migration recreates table             |
| 6   | Delete model        | `ollama rm unbreakable-oracle`   | Destructive | Model re-imported from archive        |
| 7   | Corrupt model       | `ollama rm simplebeacon-llama32` | Destructive | Model recreated from Modelfile        |
| 8   | Break DNS           | `docker restart engine`          | Safe auto   | Engine DNS cache refreshed            |

### QA evidence format

```
QA Evidence: 2026-01-15T12:00:00Z — 8/8 scenarios passed on hostname
```

JSON:

```json
{
  "summary": { "total": 8, "passed": 8, "failed": 0, "skipped": 0 },
  "scenarios": [
    {
      "scenario": 1,
      "name": "Stop engine container",
      "status": "pass",
      "detail": "engine restarted successfully"
    }
  ]
}
```

---

## 9. Diagnostics Bundle

### Contents

```
diagnostics-YYYYMMDD-HHMMSS.tar.gz
├── validation-report.json          # Full validation + recovery + benchmark JSON
├── manifest.json                   # Bundle metadata
├── system/
│   ├── hardware.json               # RAM, VRAM, CPU, disk, OS
│   ├── docker-info.txt
│   ├── docker-version.txt
│   └── environment-sanitized.json  # Secrets redacted
├── containers/
│   ├── *.log                       # Last 500 lines per service
│   ├── *-inspect.json              # Docker inspect (sanitized)
│   └── *-env-sanitized.json        # Container env (secrets redacted)
├── ollama/
│   ├── models.txt
│   ├── tags.json
│   └── models/*.txt                # ollama show per model
└── postgres/
    ├── version.txt
    ├── tables.json
    └── row-counts.json
```

### Secret sanitization (23 patterns)

`JWT_SECRET`, `SIMPLEBEACON_LICENSE_SECRET`, `DASHBOARD_VAULT_PASSWORD`, `REPORT_SIGNING_KEY`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `DB_PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `SMTP_PASS`, `SMTP_PASSWORD`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `REDIS_URL`, `API_TOKEN`, `SECRET`, `PASSWORD`, `PASS`, `KEY`, `TOKEN`, `PRIVATE_KEY`, `CREDENTIAL`

Additionally, any value matching a secret-like pattern (long base64/hex string >20 chars) is automatically redacted.

### Encryption

```bash
# Encrypt (interactive)
./scripts/export-diagnostics-bundle.sh --encrypt

# Encrypt (non-interactive, passphrase file)
./scripts/export-diagnostics-bundle.sh --encrypt --passphrase-file /secure/key

# Decrypt
openssl enc -d -aes-256-cbc -pbkdf2 -in bundle.enc -out bundle.tar.gz
```

---

## 10. Cross-Platform Compatibility

| Feature             | Linux (RHEL/Ubuntu)              | Windows + WSL2   | Edge Appliances   |
| ------------------- | -------------------------------- | ---------------- | ----------------- |
| Docker daemon start | `systemctl start docker`         | Docker Desktop   | `dockerd &`       |
| RAM detection       | `free`                           | `wmic`           | `free`            |
| CPU detection       | `nproc`                          | `wmic`           | `nproc`           |
| GPU detection       | `nvidia-smi`                     | `nvidia-smi`     | (none expected)   |
| OS detection        | `/etc/os-release`                | `wmic`           | `/etc/os-release` |
| Disk space          | `df`                             | `df` (Git Bash)  | `df`              |
| CPU thermal         | `sensors` / `/sys/class/thermal` | (skipped)        | `sensors`         |
| Path conversion     | Native                           | `cygpath -m`     | Native            |
| Shell               | Bash                             | Git Bash / MSYS2 | Bash              |

---

## 11. Environment Variables

### Required for deployment

| Variable                | Default                            | Purpose                                        |
| ----------------------- | ---------------------------------- | ---------------------------------------------- |
| `SIMPLEBEACON_OFFLINE`  | `true`                             | Disables network pulls in air-gapped mode      |
| `OLLAMA_MEMORY_PROFILE` | `balanced`                         | Memory profile (minimal/balanced/maximum)      |
| `OLLAMA_NUM_GPU`        | `-1`                               | GPU offload layers (0=CPU, -1=auto, 999=max)   |
| `OLLAMA_NUM_CTX`        | `8192`                             | Context window size                            |
| `OLLAMA_NUM_THREAD`     | `8`                                | CPU threads for inference                      |
| `OLLAMA_F16_KV`         | `true`                             | Use FP16 for KV cache                          |
| `OLLAMA_USE_MMAP`       | `true`                             | Memory-mapped model loading                    |
| `OLLAMA_BASE_URL`       | `http://simplebeacon-ollama:11434` | Engine-to-Ollama URL                           |
| `DATABASE_URL`          | (from POSTGRES_PASSWORD)           | PostgreSQL connection string                   |
| `POSTGRES_PASSWORD`     | (required)                         | PostgreSQL password                            |
| `ENGINE_PORT`           | `3000`                             | Engine host port                               |
| `OLLAMA_PORT`           | `11434`                            | Ollama host port                               |
| `DB_PORT`               | `5432`                             | PostgreSQL host port                           |
| `ENABLE_EXTERNAL_APIS`  | `false`                            | Disables external API calls in air-gapped mode |

---

## 12. Operational Commands Quick Reference

```bash
# ── Build machine ──────────────────────────────────────────────
./scripts/hydrate-airgap.sh package                    # Create archive
./scripts/hydrate-airgap.sh package --gpu              # Include GPU images

# ── Target machine: deploy ─────────────────────────────────────
./hydrate-airgap.sh deploy simplebeacon-airgap-v1.tar.gz .env.enterprise

# ── Target machine: validate ───────────────────────────────────
./scripts/validate-airgap-deploy.sh                    # Basic validation
./scripts/validate-airgap-deploy.sh --recover-safe     # Validate + safe recovery
./scripts/validate-airgap-deploy.sh --recover          # Validate + full recovery
./scripts/validate-airgap-deploy.sh --benchmark        # Validate + throughput
./scripts/validate-airgap-deploy.sh --export-bundle    # Validate + diagnostics
./scripts/validate-airgap-deploy.sh --json             # JSON output for CI
./scripts/validate-airgap-deploy.sh --verbose          # Full command output

# ── Target machine: chaos testing ──────────────────────────────
./scripts/test-airgap-faults.sh                        # All 8 scenarios
./scripts/test-airgap-faults.sh --safe-only            # Safe scenarios only
./scripts/test-airgap-faults.sh --scenario 5           # Single scenario
./scripts/test-airgap-faults.sh --json                 # JSON for CI

# ── Target machine: diagnostics ────────────────────────────────
./scripts/export-diagnostics-bundle.sh                 # Create bundle
./scripts/export-diagnostics-bundle.sh --encrypt       # Encrypted bundle
./scripts/export-diagnostics-bundle.sh --output /mnt/usb  # To USB drive

# ── Target machine: hardware detection ─────────────────────────
./scripts/detect-hardware-profile.sh                   # Detect + recommend
./scripts/detect-hardware-profile.sh --apply           # Apply recommended profile

# ── Combined operations ────────────────────────────────────────
./scripts/validate-airgap-deploy.sh --recover --benchmark --export-bundle --json
./hydrate-airgap.sh verify --benchmark --json
```

---

## 13. Key Architecture Decisions

1. **Q4_K_M as default quantization** — Balances quality and memory. Q5_K_M reserved for `maximum` profile with abundant VRAM.

2. **Hybrid recovery model** — Safe operations (restart, migration) auto-heal without prompts. Destructive operations (model purge) require explicit confirmation. This prevents data loss while minimizing technician burden.

3. **Ollama eval_count/eval_duration for benchmarking** — Uses Ollama's internal metrics rather than wall-clock time for accurate tok/s measurement. Wall-clock fallback for environments where Ollama metrics are unavailable.

4. **23-pattern secret sanitization** — Over-redacts rather than under-redacts. Values matching secret-like patterns (long base64/hex) are automatically redacted even if the key name isn't in the known list.

5. **Idempotent schema migration** — `CREATE TABLE IF NOT EXISTS` allows safe re-running without data loss. Recovery can re-run migration without checking if it ran before.

6. **Docker DNS verification** — Check 9 verifies the engine can reach Ollama via Docker internal DNS (`http://simplebeacon-ollama:11434`), not just host-level reachability. This catches the actual runtime path.

7. **Chaos testing as audit evidence** — The fault injection harness produces timestamped QA evidence suitable for compliance audits: "On [date], the self-healing system was verified to correctly detect and recover from 8 fault scenarios."

8. **Cross-platform from day one** — All scripts handle Linux, Windows/WSL2, and edge appliances. Path conversion via `cygpath -m`, hardware detection via `wmic`/`free`/`sysctl`, thermal sensors via `sensors`/`/sys/class/thermal`.

---

## 14. Sign-off

| Role                   | Name | Date | Signature |
| ---------------------- | ---- | ---- | --------- |
| Engineering Lead       |      |      |           |
| QA Lead                |      |      |           |
| Security Operations    |      |      |           |
| Field Engineering Lead |      |      |           |

---

_This document is maintained alongside the air-gap deployment scripts in the SimpleBeacon repository. For the latest version, see `docs/OPERATIONAL_READINESS_SUMMARY.md`._
