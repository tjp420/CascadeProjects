# SimpleBeacon VSCode Extension Changelog

## [3.0.568] - 2026-09-01

### Fixed

- **Profile page shows "Sign in to view your profile" despite being signed in** — `ProfileView.tsx` had a local auth check that only looked at `sb_token`, `sb-token`, and `auth_token` in localStorage, missing the primary `sb_auth_token` key. Replaced with the global `getAuthToken()` from `config.ts` which checks all 9 token storage keys. Also fixed `handleSignOut()` to use `clearAuthToken()` which clears all keys, and fixed `useScanCounter.ts` which had the same missing-key bug for scan count API calls. Exported `getAuthToken()` from `config.ts` so all views can use the shared token resolution logic.

## [3.0.567] - 2026-09-01

### Fixed

- **401 on telemetry API calls** — `FineTuningCurationView.tsx` had a local `authHeaders()` function that only checked `sb_token`, `sb-token`, and `auth_token` in localStorage, missing the primary `sb_auth_token` key used by the dashboard login flow. Replaced with the global `authHeaders()` from `config.ts` which checks all 9 token storage keys in priority order. This caused `GET /api/telemetry/collect` and `/api/telemetry/datasets` to return 401 even when the user was signed in.

## [3.0.566] - 2026-09-01

### Fixed

- **Bridge token 401 on /api/scan and /api/find-folder** — The legacy `js-es2018` dashboard (served by the extension) was missing the `X-SimpleBeacon-Bridge-Token` header on requests to `/api/scan`, `/api/find-folder`, and `/api/analyze/pick-folder`. The bridge token check was only implemented in the React build (`pages-publish`), not in the `js-es2018` dashboard that the extension actually serves. This caused all scan and folder-find requests to return `401 Unauthorized` even when the user was signed in. Added bridge token fetching from `/api/health` and `/api/ping`, caching to `sessionStorage`, and the `X-SimpleBeacon-Bridge-Token` header to all extension bridge API calls in `localAgentService.js`.

## [3.0.565] - 2026-08-31

### Fixed

- **Stale dashboard-web assets** — Force-synced all `js-es2018` files from `ai-platform/web/simplebeacon-dashboard` source. The sync script used `xcopy /D` (only-if-newer) which silently skipped files when destination timestamps drifted from prior builds, causing missing exports like `isAbsoluteLocalPath` from `utils.js` that broke the dashboard with `SyntaxError: The requested module does not provide an export named 'isAbsoluteLocalPath'`.
- **Sync script** — Changed `sync-dashboard-web.cjs` from `xcopy /D` (skip-if-newer) to `xcopy` (force-copy) to prevent timestamp-drift staleness in future syncs.

## [3.0.564] - 2026-08-31

### Fixed

- **EACCES port-bind fallback** — Data server now falls back to a random ephemeral port when the configured `dataServerPort` is in a Windows reserved/excluded port range (Hyper-V/WSL/Docker dynamic exclusions), not just when the port is already in use (`EADDRINUSE`). Previously, `EACCES` on the default port 54358 caused the data server to silently fail, leaving the dashboard sign-in page blank with `net::ERR_FAILED` on all `/api/auth/*` calls.

## [3.0.562] - 2026-09-15

### Changed

- **CHANGELOG sync** — Published full changelog for versions 3.0.553–3.0.561 to the VS Code Marketplace.

## [3.0.561] - 2026-09-15

### Fixed

- **Path traversal in saveOutputToWorkspace** — Blocked directory traversal attacks in workspace output saving.
- **Stripe test placeholder price IDs** — Added test placeholder price ID aliases to tier map for dev/test parity.
- **Auth middleware on mutation endpoints** — Added authenticate middleware to mutation endpoints (#815, #816).
- **License token minting** — Centralized license token minting on backend, stripped Worker-side minting.
- **Sign-report license tokens** — Export sign-report endpoint now accepts license tokens.
- **Dashboard attestation expiry** — Scan worker attestation failures now redirect to signin instead of showing a dead-end error.

### Added

- **Agent eval loop + MCP drop-in kit** — Added agent evaluation loop and MCP drop-in kit for external AI tools (Claude Desktop installer).
- **Password recovery** — Added password recovery flow.
- **Tier-based exports** — Export permissions now enforced by account tier.
- **Onboarding email drip** — New subscribers receive a timed onboarding email sequence.
- **Scan performance logging** — Added `/api/analytics/performance` endpoint for scan duration metrics.
- **Feedback/feature-request dashboard** — Launch traffic feedback tracking dashboard.
- **Admin onboarding drip management** — Admin API endpoints for onboarding drip store management.
- **Health alert webhook notifier** — Post-launch monitoring checklist and webhook notifier.

### Security

- **Multer 2.2.0** — Upgraded from 1.4.5-lts.2, clearing 24 CVEs (DoS, memory corruption).
- **Trivy-action 0.35.0** — Upgraded from 0.11.0 for modern container vulnerability databases.
- **npm audit** — Fixed all vulnerabilities in standalone lockfiles (0 active across 13 lockfiles).
- **CI security-gate** — Fixed workflow errors: unique SARIF categories, Gitleaks direct execution, correct artifact paths, Node.js 20 deprecation warnings, CodeQL v4.

### Changed

- **VSIX packaging** — Excluded `.map` files and `dist/` from VSIX to reduce package size.
- **Dashboard sidebar** — Added 12 missing sidebar nav items, restricted Admin to admins/owners.
- **Dashboard tier access** — Tier-based access controls with upgrade prompts.
- **Dashboard auth** — Global 401 interceptor clears stale tokens and redirects; session preserved across page refresh.
- **Trust view** — Null guard for missing `headline.gatePass`; added `/api/status` endpoint.
- **Benchmark harness** — Added multi-tool precision/recall evaluation harness comparing SimpleBeacon with Gitleaks.

## [3.0.556] - 2026-09-01

### Fixed

- **Dashboard auth session** — Fixed auth session persistence, route guards, admin user list, and API error handling.
- **Early-access form** — Improved error handling for 429/502 responses.
- **Backend retry** — Retry POST/PUT/DELETE on 502/503/504 from Render backend.
- **SHA-1 → SHA-256** — Replaced SHA-1 with SHA-256 in embeddings-index deterministic seed.
- **Early-access route** — Added `/api/early-access` route and public allowlist entry.

### Added

- **Benchmark corpus** — 31-file labeled benchmark corpus comparing SimpleBeacon credential scanner with Gitleaks.

## [3.0.555] - 2026-08-30

### Fixed

- **Early-access billing** — Fixed early-access billing tier mapping.

### Changed

- **Version alignment** — Bumped VSIX and CLI to 3.0.555 for early-access billing fix.

## [3.0.554] - 2026-08-29

### Fixed

- **AST structural fix** — Fixed AST structural rule scanner.
- **Inline ai-tools** — Inlined ai-tools functions into local-remediation.js.

### Added

- **Diagnostic log export** — Added diagnostic log export for AI-assisted debugging.

## [3.0.553] - 2026-08-28

### Changed

- **README and CHANGELOG rewrite** — Rewrote README and CHANGELOG for marketplace readiness.
- **npm package name** — Corrected npm package name from `simplebeacon-cli` to `simplebeacon`.

## [3.0.552] - 2026-08-28

### Fixed

- **CLI install prompt** — Changed `npm install -g simplebeacon-cli` to `npm install -g simplebeacon` in all user-facing messages (extension.ts, fixEngine.ts). The package is published to npm as `simplebeacon`, not `simplebeacon-cli`.
- **GitLab CI template** — Updated `gitlab-ci-simplebeacon.yml` to install `simplebeacon` instead of `simplebeacon-cli`, and fixed cache path accordingly.

### Changed

- **README rewrite** — Complete README overhaul for marketplace listing: added zero-upload security posture, CLI install prerequisite, pricing tiers, EU AI Act / SOC 2 compliance features, CI gate examples for GitHub Actions and GitLab CI, and "Not legal advice" disclaimer.
- **Version bump** — Aligned with npm CLI package version (3.0.552).

## [3.0.551] - 2026-08-27

### Fixed

- **Checkout tierMap canonical names** — Webhook tier map in `checkout.cjs` now emits canonical tier identifiers (`executive_clearance`, `eu_ai_act_sprint`, `one_time_certificate`) instead of shortened names (`executive`, `euai`, `certificate`). Tokens generated by the webhook now carry tier names recognized by dashboard `TIER_CAPABILITIES` and CLI `TIER_QUOTAS`.
- **License utils default tier** — Changed default tier in `license-utils.cjs` from `executive` (invalid) to `community` (valid).
- **Pricing page legal disclaimer** — Added "Not legal advice" disclaimer to pricing page.

### Added

- **Sentry error tracking** — Wired `@sentry/node` into both `coming-soon` and `ai-platform` servers. No-op when `SENTRY_DSN` is not set. Captures unhandled exceptions, checkout errors, and webhook signature verification failures.
- **One-time tier billing** — Added `one_time_certificate` ($149), `executive_clearance` ($499), and `eu_ai_act_sprint` ($2,499) to billing configuration with correct Stripe payment mode and expiration periods.

## [3.0.550] - 2026-08-26

### Added

- **Dashboard TIER_CAPABILITIES** — Added explicit capability entries for `sandbox`, `pro`, `one_time_certificate`, `executive_clearance`, and `eu_ai_act_sprint`. Unknown tiers no longer fall through to Developer privileges.
- **CLI TIER_QUOTAS** — Updated quota table: Developer changed from 100 to Infinity, added `community` (3), `team_pro` (Infinity), `sandbox` (50), and all three one-time tiers.

### Fixed

- **Admin 401 handling** — Admin delete action now shows "Your session has expired" message before redirecting to sign-in, instead of silent redirect.
- **Firefox browser scanner** — Fixed module worker initialization failures, added blob worker fallback, prefetched worker dependencies. Scans now process 18,000+ files in 46 batches on Firefox.
- **Stale dashboard bundles** — Added cache-busting headers and dynamic query parameters to dashboard entry HTML to prevent CDN serving stale assets.

## [3.0.517] - 2026-08-22

### Changed

- Internal stability improvements and rule catalog updates.

## [3.0.516] - 2026-08-21

### Added

- **AI Agent Context Interceptor** — Automatic detection and validation of AI-edited code via file diff analysis on save
  - Triggered on rapid-fire file changes (heuristic mode detects 10+ saves within 5 seconds)
  - `registerContextInterceptor()` wires validation into extension lifecycle
  - Surfaces findings as VS Code diagnostics in the Problems panel
- **Agent Session Coupling Analysis** — Automatically copies codebase coupling summary to clipboard when an AI editing session ends
  - `buildCouplingSummary()` extracts high-risk module relationships from `codemap-analysis.json`
  - Triggered after 5 seconds of no file changes following an active session
  - Enables rapid team communication and risk review
- **Enhanced Status Bar Blocking Issue Display** — Improved visibility of quality gate violations
  - Status bar now shows `$(shield) SimpleBeacon: FAIL (N block)` instead of generic `FAIL`
  - Tooltip displays the actual blocking issue with file, line number, and description
  - Prioritizes user awareness of gate-blocking findings

### Added Configuration

- New setting `simplebeacon.agentDetectionMode` — Control when AI session detection runs
  - `off` — Disable AI session detection
  - `heuristic` (default) — Use file-change frequency and timing heuristics
  - `always` — Treat every save as part of an active AI session
  - Configurable via Settings → "SimpleBeacon: Agent Detection Mode"

### Fixed

- False positive in gate scan for `secret-scanner.cjs` — now properly allowlisted in `.simplebeacon/config.json`

### Changed

- `agentValidation.ts` — New module for AI session detection, context interception, and coupling analysis
- `extension.ts` — Integrated interceptor registration and session lifecycle hooks
- `dataServer.ts` — Added CORS headers for clipboard-based data exchange
- Status bar layout optimized for readability with blocking issue count

### Performance

- Context validation runs only on file save events, not on every keystroke
- Coupling analysis deferred until 5s of inactivity to avoid disruption during active editing
- DiagnosticCollection cleared on session end to prevent stale findings in the Problems panel

## [3.0.508] - 2026-08-18

### Added

- **Extension Webview Command Conduit** (Sprint N) - Live benchmark execution from the VS Code webview dashboard, enabling real-time performance measurements without leaving the IDE
- **A/B remediation auto-tune triggers** (Sprint O) - Telemetry UI now surfaces A/B test results for remediation suggestions, allowing automatic tuning of fix recommendations based on acceptance rates
- **Dashboard SPA bundle sync** - Synchronized dashboard SPA chunk hashes between the VS Code extension and the web dashboard to eliminate 404 errors on /dashboard/ routes

### Fixed

- Dashboard SPA 404 on chunked asset loads — chunk hashes now match between extension and web builds

### Changed

- `dataServer.ts` expanded with new proxy endpoints for the command conduit and telemetry streaming
- `localAgent.ts` updated for command conduit integration

## [3.0.495] - 2026-08-07

### Added

- **Ollama VRAM/Pull Hub in IDE sidebar** — Full Ollama orchestration center ported into the VS Code dashboard webview:
  - `GET /api/simplebeacon/ollama/health` proxy endpoint in `dataServer.ts` — parallel `Promise.all` fetches `/api/health`, `/api/tags`, and `/api/ps` for combined health, model details, and running model VRAM stats
  - `POST /api/simplebeacon/ollama/pull` proxy endpoint — streams NDJSON download progress chunks directly from Ollama `/api/pull` to the webview, avoiding server-side memory buffering
  - `formatBytesLocal()` helper for human-readable byte formatting
  - Ollama status card UI in `dashboardPanel.ts` with: online/offline/checking badge, latency/model count/VRAM/disk metrics, collapsible running models with VRAM-to-size ratio bars, collapsible all-models list with quantization badges, pull-model input with live streaming progress bars, 30-second auto-poll, and manual refresh
- **Performance benchmark test** (`realtimeMonitor.bench.test.ts`) — 6 tests covering correctness, speedup assertion, and edge cases for the O(log n) binary search line-lookup optimization

### Changed

- **Realtime monitor decoration layer optimized** for ultra-low-latency typing performance:
  - **Pre-compiled RegExp patterns** — `BASE_SECURITY_PATTERNS` and `TYPE_SPECIFIC_PATTERNS_CACHE` moved to module-level constants, eliminating `new RegExp()` per-line × per-pattern on every 500ms debounced analysis pass
  - **O(log n) binary search line lookup** — Replaced O(n) linear scan in `detectAISlop` with `buildLineOffsets()` + `lineFromOffset()` binary search. Benchmark on 10,000-line file: **290ms → 2ms (140x speedup)** across 50,000 lookups
  - **Single `content.split('\n')`** — All four detection methods (`detectIssues`, `detectAISlop`, `detectEntropyAnomalies`, `detectASTPatterns`) now share one `lines` array from `analyzeFile`, eliminating 3 redundant splits
  - **File-size guard** — Files >500KB truncated before pattern analysis to prevent pathological regex backtracking on minified bundles
  - **Batched output channel writes** — `displayIssues` collects log lines into an array and calls `appendLine` once instead of per-issue, reducing I/O overhead
  - **Cached `fileHeader` and `prevLine`** — Hoisted `lines[0]` lookup out of inner loop in `detectIssues`

### Performance

```
┌──────────────────────────────────────────────────────────┐
│  RealtimeMonitor Line-Lookup Benchmark (10K lines)      │
├──────────────────────────────────────────────────────────┤
│  Match positions:       500                              │
│  Iterations:            100                              │
│  Total lookups:       50,000                             │
├──────────────────────────────────────────────────────────┤
│  Linear scan (old):  290.53 ms                           │
│  Binary search (new):   2.07 ms                           │
│  Speedup:             140.51x                            │
└──────────────────────────────────────────────────────────┘
```

## [3.0.494] - 2026-08-05

### Added

- Downloads-bypass Cloudflare Worker proxying `simplebeacon.ai/downloads*` to Pages origin
- Rate limiting on 17 API mutation endpoints across 4 server files (enterprise-onboarding, optimization-api, trust-api, simplebeacon-billing-api)

### Fixed

- Removed duplicate `emitIdentityRatchetStepped` and `emitMfaTokenAuthenticated` methods in `base-adapter.cjs` (ESLint no-dupe-class-members CI failure)
- Scan-worker URL routing in dashboard results view
- localStorage quota overflow handling in dashboard

### Changed

- Dashboard-web sync updated 4 files (SiemTelemetryDashboard, siemTelemetryService, TeamGatePassTrendChart, vite-env.d.ts)
- `express-rate-limit` middleware applied to all POST mutation endpoints

## [3.0.461] - 2026-07-18

### Added

- Client-side cookie-session migration for the dashboard `AuthService` (`js` and `js-es2018` builds)
- `AUTH_HINT_KEY` and `CLI_FALLBACK_TOKEN_KEY` constants plus `usesCookieSessions()` / `isHydrated()` / `hydrateSession()` helpers
- Bootstrap hydration gate in `main.js` and `js-es2018/main.js` that waits for `/api/auth/me` before rendering protected UI
- `authFetch()` helper for authenticated requests with `credentials: 'include'` and 401 redirect handling
- Integration test for `/api/auth/me` response contract covering unauthenticated and authenticated flows

### Changed

- `getToken()`, `getUser()`, `setSession()`, `clearSession()`, `isAuthenticated()`, `getAuthHeaders()`, `isAdmin()`, `getTokenTier()`, and `isDashboardWriteAllowed()` are now cookie-session aware
- `login()`, `logout()`, and `refreshToken()` include credentials and handle cookie-mode responses
- Server `/api/auth/me` endpoint normalized to return `authenticated`, `user` with `role`, `features`, `tier`/`plan`, and `trustLevel`
- `stopDataServer()` now closes active connections for clean shutdown

## [3.0.438] - 2026-07-15

### Fixed

- Expanded false positive exclusions for 2,500+ scan report findings
- Excluded package-lock.json files from high-entropy secret scanning (1,026 false positives)
- Excluded generated scan report exports from credential scanning (834 false positives)
- Excluded knip-report.txt and other generated tool outputs (88 false positives)
- Excluded dashboard view/component/service files with legitimate innerHTML usage (280+ false positives)
- Excluded scanner pattern/rule definition files from dangerous-function detection (34 false positives)
- Excluded test files with test JWTs and token strings (15+ false positives)
- Excluded certificate generator templates and remediation payload files
- Added credential-specific ignoreGlobs for test files containing test secrets

## [3.0.437] - 2026-07-14

### Added

- 48 analyzers + 25 scan engines across 8 categories
- SB-FICTION catalog for LLM placeholder and markdown fence detection
- Dashboard 4.0 with compliance, repo health, and analytics panes
- Real-time monitoring with AI session detection
- WebSocket streaming analysis support
- Analysis profiles: Quick, Balanced, Comprehensive, Real-time
- Model health monitoring with circuit breaker pattern
- Pattern detection using statistical analysis (no ML dependencies)

### Fixed

- CLI scanner binary extensions synced with browser-sandbox engine
- Added .gguf, .rlib, .rmeta, .safetensors, .pt, .pth, .onnx, .bad, and more to BINARY_EXTENSIONS
- Desktop/external project exclusions for Render deployments
- Improved false positive filtering for scanner source files
- .simplebeaconignore pattern matching now handles RegExp objects correctly
- Hardcoded exclusions for generated files, dashboard views, and test fixtures

## [3.0.400] - 2026-06-20

### Added

- Dashboard 3.0 with enhanced compliance and quality panes
- Model health monitoring with circuit breaker pattern
- Analysis profiles: Quick, Balanced, Comprehensive, Real-time
- Pattern detection using statistical analysis (no ML dependencies)

## [1.1.0] - 2026-06-15

### 🚀 **Major Enhancement: Enhanced AI Analysis**

This release introduces significant enhancements to the SimpleBeacon AI analyzer with intelligent model selection, real-time streaming, and advanced pattern detection.

### ✨ **New Features**

#### Enhanced AI Analysis

- **Progressive Analysis**: Multi-layer analysis with static, semantic, contextual, and AI-powered insights
- **Intelligent Model Selection**: Automatic model selection based on analysis requirements and performance
- **Analysis Profiles**: Quick, balanced, comprehensive, and real-time analysis modes
- **Adaptive Fallback**: Graceful degradation when preferred models are unavailable

#### Real-time Analysis Streaming

- **WebSocket Support**: Real-time analysis updates via WebSocket connections
- **Session Management**: Persistent analysis sessions with automatic cleanup
- **Incremental Processing**: Analyze code chunks as they're provided
- **Live Updates**: Real-time feedback as you code

#### Enhanced Model Management

- **Circuit Breaker Pattern**: Automatic failover when models become unresponsive
- **Health Monitoring**: Track model performance and availability
- **Intelligent Routing**: Route requests to optimal models based on requirements
- **Performance Tracking**: Monitor response times and success rates

#### ML Pattern Detection

- **Statistical Analysis**: Pattern detection using statistical methods
- **Multiple Categories**: Architecture, security, performance, maintainability, testing patterns
- **Confidence Scoring**: Pattern confidence assessment with detailed insights
- **No ML Dependencies**: Uses heuristics and statistical analysis instead of actual ML models

### 🎨 **UI/UX Improvements**

#### New Sidebar Views

- **Enhanced AI Panel**: Dedicated view for enhanced AI features
- **Model Health Status**: Real-time model availability monitoring
- **Pattern Results**: Categorized pattern detection results
- **Active Sessions**: Real-time analysis session management

#### Enhanced Quick Actions

- **Enhanced AI Analysis**: Run comprehensive AI-powered analysis
- **Real-time Analysis**: Enable live code analysis
- **Pattern Detection**: Detect code patterns and architecture
- **Model Health**: Check AI model availability and performance

### ⚙️ **Configuration Options**

#### New Settings

- `simplebeacon.analysisProfile`: Analysis profile for enhanced AI analysis
- `simplebeacon.enableRealtime`: Enable real-time analysis as you type
- `simplebeacon.preferredAIProvider`: Preferred AI provider for enhanced analysis

#### Analysis Profiles

- **Quick**: Fast, lightweight analysis for quick feedback
- **Balanced**: Comprehensive analysis for general use
- **Comprehensive**: Deep analysis with expert reviews
- **Real-time**: Incremental analysis for live updates

### 🔧 **Technical Improvements**

#### Enhanced API Integration

- **Enhanced Analysis API**: Progressive analysis with intelligent fallback
- **Real-time Analysis API**: WebSocket-based streaming analysis
- **Model Management API**: Health monitoring and intelligent routing
- **Pattern Detection API**: Statistical pattern analysis

#### Performance Optimizations

- **Caching**: Model availability and analysis results caching
- **Resource Management**: Automatic cleanup of inactive sessions
- **Timeout Protection**: Configurable timeouts for all operations
- **Error Handling**: Comprehensive error handling with graceful degradation

### 📚 **Documentation**

- **Enhanced AI Analyzer Documentation**: Complete usage examples and API reference
- **Configuration Guide**: Detailed setup and configuration instructions
- **Integration Examples**: VS Code and CI/CD integration examples
- **Troubleshooting Guide**: Common issues and solutions

### 🐛 **Bug Fixes**

- Fixed TypeScript compilation errors in enhanced AI provider
- Improved error handling in real-time analysis
- Fixed model health monitoring issues
- Enhanced pattern detection accuracy

### 🔗 **API Endpoints**

#### New Endpoints

- `POST /api/realtime/session` - Create real-time analysis session
- `POST /api/realtime/analyze/:sessionId` - Analyze code chunk
- `GET /api/realtime/session/:sessionId/results` - Get session results
- `GET /api/realtime/session/:sessionId/status` - Get session status
- `DELETE /api/realtime/session/:sessionId` - Close session
- `WebSocket: ws://localhost:8082/api/realtime/stream` - Real-time streaming

#### Enhanced Endpoints

- `GET /api/analyze/providers` - Enhanced with analysis profiles
- `POST /api/analyze/flexible` - Enhanced with progressive analysis

### 🎯 **Breaking Changes**

- **Node.js Version**: Requires Node.js 22.0.0 or higher
- **VSCode Version**: Requires VSCode 1.84.0 or higher
- **API Changes**: Enhanced analysis API with new response format

### 🔄 **Migration Guide**

#### For Existing Users

1. Update to Node.js 22.0.0 or higher
2. Update VSCode to 1.84.0 or higher
3. Reinstall the extension (v1.1.0)
4. Configure new settings in VSCode preferences

#### For API Users

1. Update API calls to use enhanced analysis endpoints
2. Add analysis profile parameter to requests
3. Handle new response format with pattern detection results
4. Implement WebSocket connections for real-time analysis

### 🏆 **Performance Improvements**

- **50% Faster Analysis**: Intelligent model selection and caching
- **Real-time Feedback**: Live analysis as you type
- **Better Resource Management**: Automatic cleanup and optimization
- **Enhanced Reliability**: Circuit breaker pattern and graceful fallbacks

### 🌟 **Highlights**

- **Enhanced AI Analysis**: Comprehensive multi-layer analysis with intelligent fallback
- **Real-time Capabilities**: Live code analysis with WebSocket streaming
- **Pattern Detection**: ML-inspired pattern detection without ML dependencies
- **Model Management**: Intelligent routing and health monitoring
- **Developer Experience**: Rich UI with comprehensive documentation

---

## [1.0.8] - Previous Release

### Features

- Basic code scanning and analysis
- Security vulnerability detection
- Compliance checking
- Quality metrics
- VSCode integration

---

## Support

For issues and questions:

- Check the [documentation](./ENHANCED_AI_ANALYZER.md)
- Review the [troubleshooting guide](./docs/troubleshooting.md)
- Open an issue on GitHub

## Roadmap

### Upcoming Features

- Custom pattern definition
- Multi-language support expansion
- Collaborative analysis sessions
- Advanced metrics tracking
- Integration marketplace

---

**Thank you for using SimpleBeacon Enhanced AI Extension!** 🎉
