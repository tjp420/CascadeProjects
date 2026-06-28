# SimpleBeacon LLM Usage & Privacy Defaults

**Last Updated:** 2026-06-27

---

## Privacy Promise

SimpleBeacon's default mode is **zero-upload**: your source code never leaves your machine unless you explicitly opt in.

---

## LLM Modes

### 1. Default: No LLM (Deterministic Scanning)

By default, SimpleBeacon uses only deterministic rule engines:
- Regex pattern matching
- AST structural analysis
- JSON schema validation
- Token bleed detection

**No LLM is called. No network request is made.**

This is the mode used by:
- `simplebeacon scan --offline`
- VS Code extension default scans
- GitHub Action runs
- MCP server (`scan_snippet`, `scan_file`, `scan_project`)

### 2. Optional: Local LLM (Ollama)

You can enable LLM-enhanced remediation suggestions using a local Ollama instance. This is entirely optional — the default deterministic scan works without it.

**Privacy:** The LLM runs entirely on your machine. No data leaves your network.

#### Quick Start

```bash
# 1. Install Ollama (macOS/Linux/Windows WSL)
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a recommended model
ollama pull llama3.2:latest

# 3. Verify it works
ollama run llama3.2:latest "Hello"

# 4. Configure SimpleBeacon
export SIMPLEBEACON_FIX_MODEL=llama3.2:latest
export OLLAMA_BASE_URL=http://localhost:11434

# 5. Run with local AI remediation
simplebeacon scan --fix --fix-provider ollama
```

#### Recommended Models

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **llama3.2:latest** | 3B | Very Fast | Good | Default recommendation; balances speed and quality |
| **llama3.1:8b** | 8B | Fast | Very Good | Larger codebase analysis; better reasoning |
| **codellama:7b** | 7B | Fast | Good | Code-specific remediation suggestions |
| **mistral:7b** | 7B | Fast | Very Good | General remediation; good instruction following |
| **qwen2.5:7b** | 7B | Fast | Excellent | Multilingual codebases; strong reasoning |

**Minimum recommended:** 3B parameter model (llama3.2). Anything smaller produces unreliable remediation suggestions.

#### Context Window Configuration

SimpleBeacon sends file snippets and rule context to the LLM. Default context is conservative to fit within most model limits:

```json
// .simplebeacon/config.json
{
  "ollama": {
    "model": "llama3.2:latest",
    "baseUrl": "http://localhost:11434",
    "contextWindow": 4096,
    "temperature": 0.2,
    "maxTokens": 1024
  }
}
```

| Setting | Default | Range | Effect |
|---------|---------|-------|--------|
| `contextWindow` | 4096 | 2048–32768 | Larger = more file context per suggestion; requires more RAM |
| `temperature` | 0.2 | 0.0–1.0 | Lower = more deterministic, focused suggestions |
| `maxTokens` | 1024 | 256–2048 | Longer = more detailed remediation steps |

**RAM guidance:**
- 3B model: ~4 GB RAM total (including OS overhead)
- 7B model: ~8 GB RAM total
- 13B model: ~16 GB RAM total

#### VS Code: Extension Settings

```json
// settings.json
{
  "simplebeacon.preferredAIProvider": "ollama",
  "simplebeacon.ollamaUrl": "http://localhost:11434",
  "simplebeacon.agentModel": "llama3.2:latest"
}
```

#### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Ollama connection refused" | Ollama not running | `ollama serve` or restart Ollama app |
| "Model not found" | Model not pulled | `ollama pull <model>` |
| Slow remediation (>5s per finding) | Model too large or CPU-only | Use smaller model (3B) or GPU-accelerated Ollama |
| Generic/irrelevant suggestions | Temperature too high or model too small | Lower temperature to 0.1; use 7B+ model |
| High RAM usage | Multiple models loaded | `ollama ps` to see active models; `ollama stop <model>` to free RAM |

### 3. Optional: Enterprise API (Zero-Data-Retention)

Enterprise customers can configure an external LLM endpoint that guarantees zero data retention:

```bash
simplebeacon scan --enhance --enhance-model <endpoint>
```

**Requirements:**
- Endpoint must be configured in `.simplebeacon/config.json`
- Must support zero-data-retention terms
- Only metadata (issue counts, file paths) is sent — never file contents

---

## What Never Leaves Your Machine

| Data Type | Default Behavior | With `--upload` |
|-----------|---------------|-----------------|
| Source code | Never uploaded | Never uploaded |
| File contents | Never uploaded | Never uploaded |
| AST extracts | Never uploaded | Never uploaded |
| Scan report JSON | Written locally only | Sanitized summary only |
| Credentials found | Logged locally only | Never included in upload |

## What Can Leave Your Machine (Explicit Opt-In Only)

| Action | Data Sent | How to Opt In |
|--------|-----------|---------------|
| Cloud scan report | Sanitized metadata (issue counts, quality score) | `--upload <url> --api-token <token>` |
| License validation | License token only | `simplebeacon buy-clearance` |
| Telemetry | Anonymous usage counts | `SIMPLEBEACON_TELEMETRY=1` env var |

## Trust Verification

Every scan prints a trust banner confirming network isolation:

```
✓ Simplebeacon running in read-only mode
✓ Local-only scan — code is not transmitted unless you pass --upload
✓ Your source files are never modified by Simplebeacon
✓ No network activity detected during scan
```

The `trust-guard.js` module actively monitors `http.request`, `https.request`, and `fetch()` during the scan. If any unexpected network request occurs, the scan fails with a safety error.

## Configuration

To enforce offline mode permanently:

```json
// .simplebeacon/config.json
{
  "offline": true
}
```

Or set the environment variable:

```bash
export SIMPLEBEACON_OFFLINE=1
```

## For Enterprise Risk Managers

- Request our **Data Security Manifesto** (PDF)
- Review `SECURITY.md` and `PRIVACY.md` in the repository
- Schedule a compliance call: `security@simplebeacon.ai`
