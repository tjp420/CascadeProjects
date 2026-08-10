# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security

- **Added**: Husky `pre-push` hook invoking `scripts/pre-push-scan.js` to scan changed/unpushed files and block pushes with detected secrets.
- **Added**: `scripts/pre-push-scan.js` — resilient changed-file scanner that prefers `gitleaks` (binary or `npx`) and falls back to a conservative regex-based engine when the binary is unavailable.
- **Added**: `scripts/install-gitleaks.js` — cross-platform helper to bootstrap `gitleaks` (macOS/Homebrew, Windows/winget + PowerShell fallback; manual guidance for Linux).
- **Changed**: `README.md` updated with onboarding instructions (`npm run install-gitleaks`) and explanation of the pre-push guard.
- **Notes**: Security tooling and onboarding committed to branch `ci/backend-bench-pr` for review and merge.


## [1.1.3] - 2026-08-10

### Security
- **Changed**: Extracted hardcoded `https://simplebeacon.ai` URLs from billing email templates into `PUBLIC_URL` env var (falls back to `https://simplebeacon.ai`). Affects 32 references across `ai-platform/server/lib/billing-email-templates.cjs` and `coming-soon/services/billing-email-templates.cjs`.
- **Changed**: Extracted hardcoded `https://cascadeprojects-yzzd.onrender.com` URLs from VSCode extension and scripts into env vars (`SB_DOWNLOAD_URL`, `LEGACY_RENDER_URL`, `RENDER_URL`).
- **Fixed**: Replaced 6 `eval()` calls with safer alternatives in build/test scripts:
  - `build-lucide-custom.cjs` (4 copies): `eval()` → `new Function()` for icon node parsing
  - `track95-all-in-one.cjs`: `eval()` → `require()` for script execution
  - `test-scanner-concurrency.cjs`: `eval()` → `vm.runInThisContext()` for browser service loading

### Infrastructure
- **Added**: `HEALTHCHECK` directives to both Dockerfiles:
  - `ai-platform/pipeline/Dockerfile`: Python urllib health check on port 8000
  - `coming-soon/Dockerfile`: Node.js http health check on port 3001

### Tests
- **Added**: 43 new tests covering Sprint 1-2 security changes:
  - `upload.test.cjs`: 13 URL/branch/token validation tests (SSRF prevention, branch injection, token format)
  - `dashboard-vault-auth.test.cjs`: 10 cookie security tests (SameSite=Strict, Secure, HttpOnly, Max-Age)
  - `security.test.cjs`: 18 Joi schema validation tests (vaultHandshake, vaultDecrypt, vaultRekey, validateInput middleware)


## [1.1.2] - 2026-08-10

- **Added**: Husky `pre-push` hook invoking `scripts/pre-push-scan.js` to scan changed/unpushed files and block pushes with detected secrets.
- **Added**: `scripts/pre-push-scan.js` — resilient changed-file scanner that prefers `gitleaks` (binary or `npx`) and falls back to a conservative regex-based engine when the binary is unavailable.
- **Added**: `scripts/install-gitleaks.js` — cross-platform helper to bootstrap `gitleaks` (macOS/Homebrew, Windows/winget + PowerShell fallback; manual guidance for Linux).
- **Changed**: `README.md` updated with onboarding instructions (`npm run install-gitleaks`) and explanation of the pre-push guard.
- **Notes**: Security tooling and onboarding committed to branch `ci/backend-bench-pr` for review and merge.


## [1.1.2] - 2026-08-10

### Security
- **Fixed**: Removed stack trace leak from auth health endpoint (`auth.cjs`) — 500 responses no longer expose `err.stack`.
- **Fixed**: Removed hardcoded Stripe webhook secret from `simulate-payment.cjs` — now uses `STRIPE_WEBHOOK_SECRET` env var.
- **Fixed**: Dev auth bypass now requires explicit `DEV_AUTH_BYPASS=1` flag in addition to `NODE_ENV=development`.
- **Fixed**: Stripe webhook handler no longer falls back to unsigned JSON parsing — always requires signature verification.
- **Fixed**: Added `authenticate` middleware to Track112 upload routes (`/uploads`, `/uploads/:id/chunk`, `/uploads/:id/commit`).
- **Fixed**: Vault session cookie upgraded to `SameSite=Strict` + `Secure` in production for CSRF defense-in-depth.
- **Added**: Joi input validation on HSM vault endpoints (`/handshake`, `/decrypt`, `/rotate`) and basic body type check on `/recursive-aggregation/proof`.
- **Added**: URL scheme validation on git clone endpoint — rejects non-`https://` URLs to prevent SSRF.
- **Added**: Branch name and access token format validation on git clone endpoint.
- **Added**: `npm audit --audit-level=high` step in `security-gate.yml` CI workflow for root, ai-platform, and coming-soon packages.

### Changed
- **Billing**: Email template pricing is now dynamic via `getTierMonthlyPrice()` instead of hardcoded `$49/month`.
- **Billing**: Added rate limiting (30 req/15min) to `/tiers` and `/proration-preview` billing endpoints.
- **Docs**: README pricing updated to current tiers (Developer $49/mo, Team Pro $149/mo) with legacy Pro $9/mo note.
- **Docs**: LICENSE file deduplicated — removed duplicate MIT license text, kept single license + Section 8 liability disclaimer.
- **CI/CD**: Updated 3 workflows from `actions/checkout@v3` and `setup-node@v3` to `v4`.
- **CI/CD**: Standardized 6 workflows from Node 20 to Node 22 (matching `package.json` requirement).
- **Frontend**: Wired up dead "Save Paths" button in SettingsView with state management + localStorage persistence.
- **Frontend**: Added `console.debug` logging to silent catch block in AnalyzeView environment detection.
- **Frontend**: Added `rel="noreferrer"` to external links in ChatbotView for privacy.

### Notes
- Local dev workflows that relied on auto-admin auth bypass must now set `DEV_AUTH_BYPASS=1` in `.env`.
- Local dev webhook testing requires a real Stripe CLI tunnel or mock secret — unsigned fallback was removed.


## [1.1.1] - 2026-07-31

### Added
- **Active Key-Erasure Integration Test Suite** (`key-purge-route.test.cjs`): Automated endpoint regression suite evaluating administrative privilege barriers and cryptographic deletion boundaries.
- **Universal Testing Shim Architecture**: Dual-runner bridge mapping `describe`/`it` globals, allowing identical testing rows to run natively under local `node --test` scripts and global Jest engines.

### Changed
- **CI Workstream Synchronization** (`.github/workflows/security-regression-tests.yml`): Extended pull request and push event change-traps to monitor key management arrays and automatically include `key-purge-route` in cloud regression sweeps.

### Fixed
- **Cloudflare Web Analytics beacon** now only loads on `simplebeacon.ai` production origins when `CF_BEACON_TOKEN` is set, eliminating empty-response SRI mismatch warnings in local/preview environments.
- **CSP** in `coming-soon/server.cjs` now allows `static.cloudflareinsights.com` in `script-src` and `*.cloudflareinsights.com` in `connect-src`.
- Added the correct Subresource Integrity (`integrity`) and `crossorigin="anonymous"` attributes to the Cloudflare `beacon.min.js` loader.

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
 - Duplicate file detection via content hashing
- File reduction analysis (unused asset candidates)
- npm audit summary (package.json + dependency count)
- EU AI Act readiness indicators
- Browser-based certificate generator (JSZip + html2canvas)
- MCP server for Cursor/Windsurf integration
- GitHub Action for CI gate

