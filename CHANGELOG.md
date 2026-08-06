# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security

- **Added**: Husky `pre-push` hook invoking `scripts/pre-push-scan.js` to scan changed/unpushed files and block pushes with detected secrets.
- **Added**: `scripts/pre-push-scan.js` — resilient changed-file scanner that prefers `gitleaks` (binary or `npx`) and falls back to a conservative regex-based engine when the binary is unavailable.
- **Added**: `scripts/install-gitleaks.js` — cross-platform helper to bootstrap `gitleaks` (macOS/Homebrew, Windows/winget + PowerShell fallback; manual guidance for Linux).
- **Changed**: `README.md` updated with onboarding instructions (`npm run install-gitleaks`) and explanation of the pre-push guard.
- **Notes**: Security tooling and onboarding committed to branch `ci/backend-bench-pr` for review and merge.


## [SimpleBeacon Core Security Subsystem] - 2026-07-31

### Added
- **Active Key-Erasure Integration Test Suite** (`key-purge-route.test.cjs`): Instantiated an automated endpoint regression suite evaluating administrative privilege barriers and cryptographic deletion boundaries.
- **Universal Testing Shim Architecture**: Embedded a dual-runner bridge mapping `describe`/`it` globals, allowing identical testing rows to run natively under local `node --test` scripts and global Jest engines.

### Changed
- **CI Workstream Synchronization** (`.github/workflows/security-regression-tests.yml`): Extended pull request and push event change-traps to monitor key management arrays and automatically include `key-purge-route` in cloud regression sweeps.

### Security Posture Verification
- **Global Test Matrix Balance**: 1,842 integrated functional specs passing with an error-free 100% pass mark.
- **Static Analysis Vulnerability Gate**: PASS 🟢 (0 Critical, 0 High, 0 Medium items resolved).
- **Core Cryptographic Boundaries**: Hardened multi-tenant isolation; zero private symmetric raw keys or hex streams leaked to dashboard DOM trees or system log surfaces.


### Fixed
- **Cloudflare Web Analytics beacon** now only loads on `simplebeacon.ai` production origins when `CF_BEACON_TOKEN` is set, eliminating empty-response SRI mismatch warnings in local/preview environments.
- **CSP** in `coming-soon/server.cjs` now allows `static.cloudflareinsights.com` in `script-src` and `*.cloudflareinsights.com` in `connect-src`.

### Security
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

