# Security Policy & Vulnerability Disclosure

**Last Updated:** 2026-06-27
**Effective Date:** 2026-06-27

SimpleBeacon takes security seriously. As a tool designed to detect credential leaks, AI-generated slop, and code hygiene issues, we hold ourselves to the same standards we enforce for our users.

---

## 1. Supported Versions

We commit to security patches for the following versions:

| Version | Status                                | Patch Window        |
| ------- | ------------------------------------- | ------------------- |
| 2.0.x   | :white_check_mark: Active development | 90 days from report |
| 1.2.x   | :white_check_mark: Supported          | 60 days from report |
| 1.1.x   | :warning: Maintenance only            | 30 days from report |
| 1.0.x   | :x: End-of-life                       | No patches          |
| < 1.0   | :x: Unsupported                       | No patches          |

**End-of-life policy:** Versions older than 12 months receive no security updates. Upgrade to the latest stable release.

---

## 2. Reporting a Vulnerability

### 2.1 Secure Contact

If you discover a security vulnerability, please report it **privately** before public disclosure:

| Channel       | Address                    | Response SLA              |
| ------------- | -------------------------- | ------------------------- |
| **Primary**   | `security@simplebeacon.ai` | 24 hours (acknowledgment) |
| **Secondary** | `trevor_punt@live.com`     | 48 hours (acknowledgment) |
| **PGP Key**   | [See below](#pgp-key)      | Encrypted preferred       |

**Subject line:** `[SECURITY] SimpleBeacon — <one-line summary>`

### 2.2 Required Information

Please include as much of the following as possible:

- **Affected version(s)** — e.g., `simplebeacon-cli@1.2.3`
- **Affected component** — CLI, VS Code: extension, web dashboard, GitHub Action, API server
- **Severity assessment** — your honest assessment (Critical / High / Medium / Low)
- **Steps to reproduce** — minimal reproducible example or PoC
- **Impact** — what could an attacker achieve?
- **Suggested fix** — optional, but appreciated
- **Your disclosure preference** — 90-day standard, or shorter/longer if you have a preference

### 2.3 What NOT to Do

- :x: Do **not** open public GitHub issues for security vulnerabilities
- :x: Do **not** post on Hacker News, Reddit, or social media before coordinated disclosure
- :x: Do **not** exploit vulnerabilities against production users (use your own test environment)
- :x: Do **not** access, modify, or delete data that does not belong to you

---

## 3. Coordinated Disclosure Timeline

We follow the [ISO 29147](https://www.iso.org/standard/45170.html) responsible disclosure model:

| Day           | Action                                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| **Day 0**     | You report the vulnerability privately                                       |
| **Day 1**     | We acknowledge receipt and assign a tracking ID (e.g., `SB-SEC-2026-001`)    |
| **Day 7**     | We confirm vulnerability, provide initial assessment, and share fix timeline |
| **Day 30**    | We share draft advisory and proposed CVE (if applicable)                     |
| **Day 60–90** | We release patched version and publish advisory                              |
| **Day 90+**   | You may publish your own write-up (if agreed timeline reached)               |

**Expedited timeline:** For actively exploited vulnerabilities (0-day in the wild), we may release an emergency patch within 72 hours and disclose immediately.

**Extensions:** If the fix is more complex than anticipated, we will negotiate a mutually agreeable extension (up to 120 days total) with you.

---

## 4. Scope

### 4.1 In Scope

The following are in scope for security research and vulnerability reports:

- `simplebeacon-cli` — credential leak detection bypasses, local code execution via scan inputs, path traversal in `--output`, unsafe deserialization of scan configs
- `simplebeacon-vscode-merged` — extension host exploitation via webview content, unauthorized file access from webview panels, command injection through scan arguments
- Web dashboard (`simplebeacon.ai`) — XSS, CSRF, authentication bypass, SSRF, SQL injection (if any server-side data storage exists), insecure direct object references
- API server (`api.simplebeacon.ai`) — authentication bypass, authorization bypass, rate-limit bypass, injection vulnerabilities
- GitHub Action (`github-action/`) — token exposure in action logs, unsafe default inputs, command injection via `scan-args`
- MCP server (`mcp/stdio-server.js`) — prompt injection via tool arguments, unauthorized file access via `scan_file` tool

### 4.2 Out of Scope

The following are **not** in scope and will not be eligible for recognition:

- Denial of Service (DoS) via resource exhaustion on free-tier endpoints
- Social engineering attacks against maintainers or users
- Physical security of our offices or infrastructure
- Vulnerabilities in third-party dependencies **unless** they directly affect SimpleBeacon users and no upstream fix exists
- Vulnerabilities in end-of-life versions (see Section 1)
- Theoretical vulnerabilities without a working proof-of-concept
- Code quality issues, lint errors, or missing best practices (use GitHub issues for these)
- Issues requiring physical access to the user's machine (local-only CLI threat model)

### 4.3 Safe Harbor

We provide **safe harbor** for security researchers who:

- Make good-faith efforts to avoid privacy violations and service disruption
- Test only within the scope defined above
- Report vulnerabilities privately before public disclosure
- Do not exploit vulnerabilities beyond what is necessary for proof-of-concept

We will **not** take legal action against researchers who follow these guidelines. We may, at our discretion, offer public recognition (see Section 8).

---

## 5. Severity Classification

We use the [CVSS v3.1](https://www.first.org/cvss/v3.1/specification-document) standard to score vulnerabilities:

| Severity     | CVSS Score | Example                                                                      |
| ------------ | ---------- | ---------------------------------------------------------------------------- |
| **Critical** | 9.0–10.0   | Remote code execution, authentication bypass leading to admin access         |
| **High**     | 7.0–8.9    | SQL injection, stored XSS, privilege escalation                              |
| **Medium**   | 4.0–6.9    | Reflected XSS, CSRF, information disclosure                                  |
| **Low**      | 0.1–3.9    | Missing security headers, verbose error messages, hardcoded test credentials |

---

## 6. Security Model

SimpleBeacon is designed with a **zero-upload, local-first** architecture:

| Component              | Data Boundary                                                                               | Network Policy                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **CLI scans**          | Entirely local — no source code transmitted                                                 | `--offline` enforces zero network; `--upload` is explicit opt-in only |
| **VS Code: extension** | Runs in extension host — scan reports saved to local `.simplebeacon/`                       | Webview panels load local dashboard HTML; no external scripts         |
| **Browser dashboard**  | Executes in browser memory — JSZip and html2canvas generate outputs client-side             | No telemetry without `SIMPLEBEACON_TELEMETRY=1`                       |
| **MCP server**         | Local stdio — no network sockets                                                            | Network guard patches `fetch`, `http.request`, `https.request`        |
| **API server**         | Server-side — handles license validation, payment webhooks, anonymous scan metadata uploads | All endpoints require authentication; rate-limited                    |
| **GitHub Action**      | Runs in CI runner — same local-only guarantee as CLI                                        | `--offline` flag available in action inputs                           |

### 6.1 Trust Verification

Every CLI scan prints a trust banner:

```
✓ Simplebeacon running in read-only mode
✓ Local-only scan — code is not transmitted unless you pass --upload
✓ Your source files are never modified by Simplebeacon
✓ No network activity detected during scan
```

The `trust-guard.js` module actively monitors all network requests during scans. If any unexpected network request occurs, the scan fails with a safety error.

---

## 7. Known Limitations & Accepted Risks

| #   | Limitation                                                                          | Mitigation                                                                         | Risk Level |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- |
| 1   | **Browser scan memory**: Large repositories (>20K files) may exhaust browser memory | CLI recommended for repos >5K files; browser shows warning                         | Low        |
| 2   | **Credential pattern detection**: Heuristic regex matching produces false positives | Confidence scoring; manual review encouraged; false-positive suppression in config | Low        |
| 3   | **html2canvas rasterization**: Certificate PNG generated from off-screen DOM        | File paths scrubbed before rasterization; no network requests during generation    | Low        |
| 4   | **Token parsing**: Client-side JWT decode does not verify signatures                | Real validation is server-side during payment; client-side decode is UI-only       | Low        |
| 5   | **Local model inference**: Ollama/GGUF models run on user's machine                 | No data leaves machine; user controls model selection                              | None       |
| 6   | **GitHub Action token exposure**: `secrets.SIMPLEBEACON_TOKEN` could be logged      | Action masks tokens in logs; recommends fine-grained PATs                          | Low        |

---

## 8. Hall of Fame

We publicly acknowledge security researchers who report valid vulnerabilities:

| Date                       | Researcher | CVE / Issue | Severity |
| -------------------------- | ---------- | ----------- | -------- |
| _None yet — be the first!_ |            |             |          |

Researchers may choose to remain anonymous or use a pseudonym.

---

## 9. CVE Policy

- We will request a CVE for all **Critical** and **High** severity vulnerabilities
- We will request a CVE for **Medium** severity vulnerabilities if they affect default configurations
- **Low** severity issues will be fixed and disclosed in release notes without a CVE
- We coordinate CVE assignment through [MITRE](https://cve.mitre.org/) or our CNA (once approved)

---

## 10. Bug Bounty

We do not currently operate a paid bug bounty program. However, we offer:

- **Public recognition** in our Hall of Fame (Section 8)
- **Free lifetime license** for valid Critical or High severity reports
- **Swag** ( stickers, t-shirts) for Medium severity reports
- **Priority support** for researchers who responsibly disclose

**Future:** We plan to launch a paid bug bounty program through [Bugcrowd](https://www.bugcrowd.com/) or [HackerOne](https://www.hackerone.com/) in Q3 2026.

---

## 11. PGP Key

For encrypted communication, use the following PGP public key:

```
-----BEGIN PGP PUBLIC KEY BLOCK-----

mQINBGX... (placeholder — generate before launch)
-----END PGP PUBLIC KEY BLOCK-----
```

**Fingerprint:** `ABCD 1234 5678 90EF GHIJ KLMN OPQR STUV WXYZ 1234`

> **Note:** Generate a proper PGP key before launch. Use `gpg --full-generate-key` and publish the public key to keys.openpgp.org.

---

## 12. Security Advisories

Published advisories will be available at:

- **GitHub Security Advisories:** `https://github.com/tjp420/simplebeacon/security/advisories`
- **SimpleBeacon Security Page:** `https://simplebeacon.ai/security`
- **RSS Feed:** `https://simplebeacon.ai/security/advisories.rss`

Subscribe to the GitHub Security Advisories to receive notifications for new disclosures.

---

## 13. Contact

| Role                              | Contact                    |
| --------------------------------- | -------------------------- |
| **Security Team Lead**            | `security@simplebeacon.ai` |
| **General Inquiries**             | `hello@simplebeacon.ai`    |
| **Legal / Safe Harbor Questions** | `legal@simplebeacon.ai`    |

---

_This policy is effective as of 2026-06-27 and may be updated. Changes will be announced 30 days in advance via GitHub releases and the security RSS feed._
