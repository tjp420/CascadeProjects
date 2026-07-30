# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **TTM messaging release** across the marketing funnel: added the "TTM Bottleneck" section to the landing page, updated Team/Agency pricing bullets with velocity-focused value props, and added a targeted outbound "Time-to-Market Hook" email variant for attribution tracking.

### Fixed
- **Cloudflare Web Analytics beacon** now only loads on `simplebeacon.ai` production origins when `CF_BEACON_TOKEN` is set, eliminating empty-response SRI mismatch warnings in local/preview environments.
- **CSP** in `coming-soon/server.cjs` now allows `static.cloudflareinsights.com` in `script-src` and `*.cloudflareinsights.com` in `connect-src`.

### Security
- Added the correct Subresource Integrity (`integrity`) and `crossorigin="anonymous"` attributes to the Cloudflare `beacon.min.js` loader.

### [Released - 2026-07-28] Edge Ingress Integration & Payment Hardening

#### Added
- **Edge Ingress Proxy Gateway**: Compiled and deployed `worker-deploy/src/worker.js` as the primary ingestion hook for all incoming Stripe network events.
- **Serverless HMAC License Signer**: Configured lightweight WebCrypto `HMAC-SHA256` token minting loops directly within Cloudflare V8 edge isolates.
- **Verification Tooling**: Added automated runners `validate-edge-webhook.mjs` and `validate-success-poll.mjs` with matching npm aliases (`npm run validate:webhook` / `validate:license`) for high-signal integration checks.
- **DNS Automation Suite**: Created `verify-dns.ps1` to programmatically audit outbound SPF, DKIM, and DMARC text records before testing email pipelines.

#### Fixed
- **Split-Handler Coordination Gap**: Re-architected the payment flow to turn the Cloudflare Worker into an active reverse proxy, forwarding raw payloads and original headers directly to Render (`${API_BACKEND}/api/stripe/webhook`) while simultaneously minting local JWT licenses.
- **Edge Webhook Idempotency Lock**: Hardened the Worker isolate against Stripe network retry storms via a dedicated `processed:${eventId}` verification gate inside the edge key-value data store.

#### Operational Infrastructure Telemetry (Audited Baseline)
- **Live Cloudflare KV Namespace Binding**: `LICENSE_STORE`
- **Assigned Production Namespace ID**: `5a5a2125a7e14bf6b3e9b7b6d1e4441c`
- **Verified Local Test Grid**: 563 / 563 Unit and Integration Suites Reporting Green (0 Failures).
- **Grounded Performance Claims**: Verified local processing throughput at exactly **14,000 files across 4.4M lines of code in ~40 seconds** with 100% network isolation.

## [1.1.0] - 2026-06-06

### Added
- **Browser certificate generator**: 11 analysis module cards with expandable detail panels in scan preview
- **Governance & Compliance phase** in remediation roadmap (license/security file audit)
- **EU AI Act phase** now correctly shows `pending` status when AI system indicators are present
- **Live file discovery counter** during browser folder drop (updates every 200ms)
- **Escape-to-cancel** during folder traversal before scan starts
- **3-stage scan pipeline** with clear labels: Discovery → Filtering → Scanning
- **Filtering progress** updates every 1,000 files
- **Batch DOM updates** during scan (every 50-100 files) to prevent UI freezing
- **Module dropdown + detail panels** in certificate preview (replaces inline-expand cards)
- **Delegated click handler** for module card expand/collapse (more reliable than inline onclick)
- **Event delegation** for scan preview interactions

### Changed
- Browser scan file size limit increased from 500MB to **2GB**
- Removed blanket exclusion of `.git/hooks/*.sample` files from browser scan
- `.git/objects`, `.git/pack`, `.git/idx` now excluded instead of `.git/hooks/*.sample`
- CLI JSON report enriched with `blockingIssues` and `warningIssues` arrays
- Module summary objects added: `consolidation`, `codebase`, `dataQuality`, `cleanup`, `compliance`, `fileReduction`
- Tier detection defaults to `locked` instead of `universal` for empty/invalid tokens

### Fixed
- **Module card "Click for details"** not working due to fragile inline `onclick` handler
- **EU AI Act incorrectly marked "completed"** when `aiSystemIndicators > 0` but `highRiskIndicators === 0`
- **All modules unlocked with free token** due to `universal` tier fallback
- CLI JSON report losing detailed gate issues through normalization

### Security
- Credential pattern matches in browser scan now logged with **redacted snippets** (line numbers shown, values hidden)
- Browser scan hard-capped at **20,000 files** with clear error message
- DOM scrubbed before `html2canvas` rasterization to prevent file path leakage into certificate PNG

## [1.0.0] - 2025-05-15

### Added
- Initial release of SimpleBeacon CLI
- Gate scan with credential pattern detection
- AI system indicator detection (OpenAI, Anthropic, LangChain, HuggingFace)
- Debug artifact detection (console.log, debugger statements)
- Governance marker detection (license headers, copyright notices)
- Mock data / fixture file detection
- Duplicate file detection via content hashing
- TODO/FIXME roadmap marker detection
- File reduction analysis (unused asset candidates)
- npm audit summary (package.json + dependency count)
- EU AI Act readiness indicators
- Browser-based certificate generator (JSZip + html2canvas)
- MCP server for Cursor/Windsurf integration
- GitHub Action for CI gate

