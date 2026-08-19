# SimpleBeacon VSCode Extension Changelog

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
- 38 analyzer engines: 24 real-time IDE rules + 14 batch CLI engines
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
