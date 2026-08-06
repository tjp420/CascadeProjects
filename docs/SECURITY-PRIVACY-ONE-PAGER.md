# SimpleBeacon Security & Privacy Compliance Statement

## Zero Data Custody Model

**Document version:** 1.0 — August 2026
**Audience:** CISOs, Security Engineers, Corporate Legal Teams, Procurement

---

## Executive Summary

SimpleBeacon operates under a **Zero Data Custody** model. Your source code, repository contents, and proprietary intellectual property never leave your local machine. All scanning and compliance analysis runs entirely in your browser's sandbox or via the local CLI — no code contents are transmitted to SimpleBeacon's servers at any point during the analysis pipeline.

This document provides the technical evidence and verification steps for security and compliance teams evaluating SimpleBeacon for enterprise procurement.

---

## 1. Browser Sandbox Isolation

### Architecture

SimpleBeacon's browser-based scanning engine uses the **File System Access API** and **Web Workers** to compute compliance scans within an isolated browser container:

| Layer | Technology | Data Boundary |
|-------|-----------|---------------|
| File access | `showDirectoryPicker()` / `webkitGetAsEntry()` | User-granted, ephemeral — no persistence |
| Compute | Web Workers (`scan-worker.js`) | Isolated thread, no DOM access, no network fetch |
| Pattern matching | Deterministic regex rules (compiled locally) | No LLM calls, no cloud inference |
| Report storage | In-memory + optional local download | Never written to SimpleBeacon servers |

### What This Means

- **No server-side code storage:** Your repository files are read into browser memory, analyzed by locally-compiled heuristic rules, and the results are rendered in the DOM. The file contents are never serialized into an HTTP request.
- **No hidden API calls:** The scan worker operates in a dedicated Web Worker thread with no `fetch()` or `XMLHttpRequest` capability. It receives file handles via `postMessage()`, processes them, and returns structured findings.
- **No telemetry on code contents:** The only network requests made during a scan session are initial static asset loads (HTML, CSS, JS bundles) and optional, anonymized billing/auth checks — never file contents or scan results.

---

## 2. Empirical Verification Guide

Technical buyers can verify Zero Data Custody in under 60 seconds:

### Step 1: Open Network Inspector
Press `F12` in your browser and navigate to the **Network** tab. Filter by `Fetch/XHR`.

### Step 2: Drop Your Code
Drag and drop your project repository folder onto the SimpleBeacon dashboard scan zone at `https://simplebeacon.ai/dashboard/#/analyze`.

### Step 3: Verify Zero Traffic
Observe the Network tab during the scan. You will see:
- **Zero** `POST` or `PUT` requests containing file contents
- **Zero** requests to any `/api/scan` or `/api/analyze` endpoint during the analysis loop
- **Only** the initial static asset loads (cached after first visit)

### Step 4: Pull the Plug (Optional)
Disconnect your internet connection entirely (turn off Wi-Fi, unplug Ethernet). Run another scan. The scan will complete at full speed with zero network connectivity — proving the engine is 100% local.

---

## 3. Cryptographic Project Signatures

When telemetry data (scan history, aggregate metrics) is stored server-side for dashboard display, project names are **permanently masked** before transmission:

```
projectName → HMAC-SHA256(salt + projectName) → stored hash
```

- The salt is server-generated and rotates per workspace
- The original project name is **never** stored server-side
- The hash is one-way: it cannot be reversed to recover the project name
- This means even if SimpleBeacon's database were compromised, attackers would find only irreversible hashes, not project names or file paths

---

## 4. CLI Air-Gapped Mode

The `npx simplebeacon` CLI tool supports a `--offline` flag for completely air-gapped environments:

```bash
npx simplebeacon scan --offline --gate
```

When run with `--offline`:
- All heuristic rules compile locally from the cached npm package
- Zero network requests are made (no telemetry, no auth checks, no update pings)
- The scan report is written to a local JSON file
- The gate pass/fail result is printed to stdout

After the first `npx` install, the package is cached locally. Subsequent scans can be run with the machine completely disconnected from the internet.

---

## 5. Open Heuristic Rules

SimpleBeacon's core pattern-matching rules (the regex matrices that detect AI slop, placeholder URLs, hallucinated endpoints, markdown debris, and credential leaks) are **deterministic and inspectable**:

- The rules are defined in plain JavaScript/TypeScript source files
- Each rule has a stable pattern ID, severity level, and human-readable description
- The `explain_finding` MCP tool returns full metadata for any pattern ID
- Security teams can audit exactly what the engine searches for and why

This proves the analysis is a **deterministic string-matching operation** running locally — not a hidden API call sending code to an LLM cloud for inference.

---

## 6. Data Processing Agreement (DPA) Summary

| Data Category | Collected | Stored | Transmitted |
|--------------|-----------|--------|-------------|
| Source code / file contents | No | No | No |
| Scan findings / issue lists | Local only | Local only | No |
| Project names | Hashed only | Hashed only | Hashed only |
| Aggregate metrics (file counts, gate pass/fail) | Yes | Yes (server) | Yes (anonymized) |
| Authentication tokens | Yes | Yes (server) | Yes (encrypted in transit) |
| Billing metadata | Yes | Yes (Stripe) | Yes (via Stripe) |

### Compliance Posture

- **SOC 2:** Not required for code analysis — no customer code is stored or processed server-side
- **GDPR:** No personal data from code files is transmitted; project names are hashed
- **EU AI Act:** Scans run locally; no AI inference is performed on customer code
- **Data Breach Risk:** Minimal — a server compromise exposes only hashed project names and auth metadata, never source code

---

## 7. Enterprise Procurement Advantage

Traditional cloud-based code analysis platforms require:

1. 6-12 month enterprise security review
2. SOC 2 Type II compliance certificates
3. Signed Data Processing Agreements (DPAs)
4. Data residency negotiations
5. Encryption-at-rest and in-transit audits
6. Incident response plan reviews

**SimpleBeacon bypasses all of the above** because we never receive, store, or process your source code. The procurement conversation shifts from "How do you protect our data?" to "What data?" — collapsing the sales cycle from months to days.

---

## Contact

For security questions, compliance documentation, or enterprise procurement:

- **Email:** security@simplebeacon.ai
- **Enterprise demo:** https://simplebeacon.ai/contact
- **Documentation:** https://simplebeacon.ai/docs

---

*This document is provided for informational purposes and does not constitute a binding legal agreement. For contractual terms, refer to the SimpleBeacon Terms of Service and Enterprise Service Agreement.*
