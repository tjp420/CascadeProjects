# LLM Modes & Data Privacy

SimpleBeacon runs **offline by default**. No source code, repository contents, or scan results ever leave your machine unless you explicitly opt in.

---

## Default Mode: Fully Offline

- All pattern matching runs locally on your CPU
- No network calls to external APIs
- No telemetry, tracking, or analytics
- Works behind corporate firewalls and air-gapped networks

```bash
# This is the default — nothing leaves your machine
npx simplebeacon scan --gate --offline
```

---

## Optional Mode: Enhanced Intelligence

SimpleBeacon can optionally use an LLM for deeper semantic analysis of complex findings. This is **opt-in only** and disabled by default.

### How to enable

Install the optional intelligence package:

```bash
npm install -D @simplebeacon/intelligence
```

Then run with the `--intelligence` flag:

```bash
npx simplebeacon scan --gate --intelligence
```

### What data leaves the machine

| Scenario               | Data sent              | Destination                                         |
| ---------------------- | ---------------------- | --------------------------------------------------- |
| Local Ollama (default) | None                   | `localhost:11434` — your own machine                |
| Enterprise API key     | Findings snippets only | Configured endpoint with zero-data-retention policy |

### Local-first default

If `@simplebeacon/intelligence` is installed but no external API key is configured, SimpleBeacon automatically falls back to **local Ollama** (e.g., Llama 3). No data leaves your machine.

```bash
# Ensure Ollama is running locally
ollama run llama3

# SimpleBeacon will use it automatically
npx simplebeacon scan --gate --intelligence
```

---

## Enterprise Zero-Data-Retention

For organizations with strict compliance requirements, configure an enterprise endpoint that guarantees zero data retention:

```bash
# .env or shell export
SIMPLEBEACON_INTELLIGENCE_URL=https://api.your-company.com/llm
SIMPLEBEACON_INTELLIGENCE_KEY=sk-enterprise-...
SIMPLEBEACON_INTELLIGENCE_RETENTION=zero
```

Only **anonymized finding snippets** (never full files or repository paths) are sent. Full source code always stays local.

---

## What Never Leaves Your Machine

- Full file contents
- Repository directory structures
- Complete scan reports
- Credentials or secrets found during scanning
- Your license key or token

---

## Verification

You can verify that SimpleBeacon is running offline:

```bash
# Run with network monitoring — no outbound connections
npx simplebeacon scan --gate --offline
```

Or use the built-in privacy check:

```bash
npx simplebeacon scan --profile offline-privacy
```

This confirms:

- No external API calls were made
- No source code was uploaded
- All processing occurred locally
