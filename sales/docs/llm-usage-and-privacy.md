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

You can enable LLM-enhanced remediation suggestions using a local Ollama instance:

```bash
# Configure your local model
export SIMPLEBEACON_FIX_MODEL=llama3.2:latest
export OLLAMA_BASE_URL=http://localhost:11434

# Run with local AI remediation
simplebeacon scan --fix --fix-provider ollama
```

**Privacy:** The LLM runs entirely on your machine. No data leaves your network.

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
