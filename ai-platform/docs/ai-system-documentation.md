# AI system documentation

Technical inventory of optional AI integrations in the Simplebeacon platform (Regulation (EU) 2024/1689 readiness).

## Scope

Simplebeacon’s core gate scan is **deterministic** — pattern rules, JSON schema checks, and filesystem inventory. Optional cloud or local LLM layers add narrative summaries only; they do not change gate pass/fail.

## Integrated components

| Component | Path | Role |
|-----------|------|------|
| Cloud inference service | `server/services/cloud-inference-service.js` | OpenAI, Anthropic, and Ollama summarization for scan reports and code understanding |
| Flexible analyze API | `server/routes/flexible-analyze-api.js` | HTTP routes that invoke deterministic scan first, then optional LLM enhancement |
| Model inference service | `server/services/model-inference-service.js` | Local registry model routing |
| Strategic insights engine | `server/lib/strategic-insights-engine.js` | Rule-based or LLM strategic layer on roadmap metrics |
| Code understanding engine | `server/lib/code-understanding/code-understanding-engine.js` | Codebase context assembly for optional LLM explanation |
| User AI keys store | `server/lib/user-ai-keys-store.js` | Per-user provider credentials (OpenAI, Anthropic, Ollama) |
| AI proxy gateway | `server/ai-proxy-gateway.js` | Enterprise DLP forward proxy for outbound AI API bodies |
| DLP dashboard | `server/dlp-dashboard.js` | Violation and compliance stats for the proxy |
| Roadmap analyzer | `src/core/RoadmapDataAnalyzer.js` | Roadmap JSON analysis (may reference Claude-style tooling labels) |

## Human oversight

- Analyze and Complete scan UIs label LLM output as **best-effort narrative**; gate results remain rule-based.
- Operators configure providers in Settings; no provider key is required for core scanning.
- DLP proxy supports monitor-only mode (`BLOCK_ON_MATCH=false`) with human review of violations.

## Logging and traceability

Inference calls emit structured **inference audit** records via `server/lib/ai-inference-audit-logger.js` (`logInferenceEvent`), including provider, operation, and trace identifiers.

## Test and development utilities

| File | Purpose |
|------|---------|
| `server/test-gateway.js` | Manual/integration tests for the DLP proxy — not deployed to production |

## Documentation cross-reference

See `docs/eu-ai-act-compliance.md` for classification posture and Article 50 transparency expectations.
