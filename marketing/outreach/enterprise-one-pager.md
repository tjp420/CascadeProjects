# SimpleBeacon — Enterprise Security & Compliance One-Pager

**For:** CISOs, CTOs, Compliance Officers, Procurement Teams
**Updated:** August 22, 2026
**Product:** SimpleBeacon — Offline AI Code Audit & Compliance Scanner
**Website:** https://simplebeacon.ai
**Contact:** admin@simplebeacon.ai

---

## What It Does

SimpleBeacon is a local-first code scanner that detects AI-generated code defects, credential leaks, and compliance gaps before they reach production. It runs entirely on your developers' machines — no source code leaves your infrastructure.

## Verified Capabilities

| Capability | Status | Evidence |
|-----------|--------|----------|
| 48 AI Problem Analyzers (A-01 through A-48) | Verified | `ai-problem-analyzer-suite.js` |
| 25 scan engine categories | Verified | CLI scan report |
| Zero source-code upload | Verified | Certify endpoint sends only SHA-256 hash + aggregate counts |
| Offline mode (`--offline`) | Verified | Scan fails if any network activity is detected |
| Cryptographic report signing | Verified | ECDSA signature via `/api/v1/certify` |
| JWT license tokens (HS256) | Verified | Local validation, no network required after activation |
| Stripe live checkout (5 tiers) | Verified | Live Stripe checkout URLs confirmed for all tiers |
| Webhook signature verification | Verified | HMAC-SHA256, 5-minute replay window |
| Webhook idempotency | Verified | KV-based dedup + file-based event store |
| Email delivery (Resend + SMTP fallback) | Verified | Health check confirmed both providers active |
| CI/CD gate integration | Verified | GitHub Actions, pre-commit hooks, CLI gate |
| VS Code extension | Verified | v3.0.517, 17.9 MB VSIX |
| MCP server (Cursor, Claude Desktop) | Verified | `src/mcp/` with handler suite |
| AST scanning (JavaScript/TypeScript) | Verified | `javascript-ast-scanner.js` via @babel/parser (4 structural rules, optional) |
| Custom rules via config | Verified | `.simplebeacon/config.json` with allowlist + rules schema |
| SSO/SAML | Roadmap | Not yet implemented — scoped as Phase 1 for enterprise contracts |
| Docker image | Roadmap | CLI is containerizable; Docker image provided during enterprise onboarding |

## Security Architecture

```
[ Developer Machine ]
  ├── CLI scan (local, no network)
  ├── VS Code extension (shells out to CLI)
  ├── Browser sandbox (in-memory, wiped on tab close)
  └── CI gate (local scan, optional anonymized telemetry)

[ SimpleBeacon Backend (Render + Cloudflare) ]
  ├── Stripe checkout → JWT license token → email
  ├── Webhook signature verification (HMAC-SHA256)
  ├── License token validation (local, offline)
  └── Certificate signing (ECDSA, hash-only)

[ What NEVER leaves your machine ]
  ├── Source code
  ├── File paths
  ├── Issue descriptions
  └── Repository contents

[ What DOES leave (only with paid tokens, opt-in) ]
  ├── SHA-256 hash of scan report (for certificate signing)
  └── Aggregate counts (severity rollup, category rollup, file count)
```

## Compliance Positioning

### EU AI Act
- SimpleBeacon generates **technical attestation evidence** for EU AI Act Article 13 (documentation) and Annex III (high-risk AI system requirements)
- Reports map findings to specific EU AI Act articles
- **This is a technical attestation, not a legal certification.** For full legal conformity, engage a qualified EU legal firm.

### SOC 2
- SimpleBeacon produces evidence-based audit artifacts for SOC 2 Trust Services Criteria
- Reports include severity scoring, remediation roadmaps, and SHA-256 integrity seals
- **SimpleBeacon is not SOC 2 Type II certified itself.** Reports are tooling evidence, not auditor sign-off.

### Privacy
- Zero-upload architecture verified: no source code, file paths, or issue descriptions transmitted
- GDPR-compatible: no personal data processed during scanning
- DPA available: https://simplebeacon.ai/dpa

## Pricing (Verified)

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0 | Local scans, limited analyzers, community use |
| Developer | $49/mo or $490/yr | Unlimited scans, CI gate, 48 analyzers |
| Team Pro | $149/mo or $1,490/yr | EU AI Act gap reports, SOC 2 artifacts, 5 seats |
| Compliance Suite | $399/mo or $3,990/yr | Full compliance suite, quarterly reviews, priority support |
| Enterprise | Custom | Air-gapped, SSO/SAML, dedicated analyst |

## Technical Specifications

- **Repository scale:** 6,000+ files scanned in ~90 seconds on local hardware
- **Test coverage:** 8,825 tests passing (8,202 backend + 623 website)
- **Quality gate:** 100/100 score, 0 blocking findings
- **License validation:** Local JWT (HS256), no network required after activation
- **Air-gapped mode:** Full functionality with zero internet connectivity after Docker image pull

## Deployment Options

1. **SaaS** — CLI + VS Code extension + web dashboard at simplebeacon.ai
2. **Self-hosted** — Render backend + Cloudflare Worker, or deploy to your own infrastructure
3. **Air-gapped** — Node.js CLI with local license validation. Install from local npm registry or bundled `node_modules`. Docker image available on request during enterprise onboarding. Zero internet required after installation.

## What SimpleBeacon Is NOT

- Not a legal certification or auditor sign-off
- Not a guarantee of regulatory compliance
- Not a SAST/DAST replacement (it targets AI-specific patterns traditional tools miss)
- Not a code quality linter (it targets AI-generated slop, not style)

## Contact

- **Sales:** admin@simplebeacon.ai
- **Security:** See https://simplebeacon.ai/security
- **DPA:** https://simplebeacon.ai/dpa
- **Terms:** https://simplebeacon.ai/terms
- **Privacy:** https://simplebeacon.ai/privacy
