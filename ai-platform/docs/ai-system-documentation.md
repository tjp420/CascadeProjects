# AI system documentation

Technical inventory of optional AI integrations in the Simplebeacon platform (Regulation (EU) 2024/1689 readiness).

## Scope

Simplebeacon’s core gate scan is **deterministic** — pattern rules, JSON schema checks, and filesystem inventory. Optional cloud or local LLM layers add narrative summaries only; they do not change gate pass/fail.

## Integrated components

| Component | Path | Role |
|-----------|------|------|
| Cloud inference service | `server/services/cloud-inference-service.cjs` | OpenAI, Anthropic, and Ollama summarization for scan reports and code understanding |
| Flexible analyze API | `server/routes/flexible-analyze-api.cjs` | HTTP routes that invoke deterministic scan first, then optional LLM enhancement |
| Chatbot API | `server/routes/chatbot-api.cjs` | Direct OpenAI/Anthropic/Claude API integration for chatbot endpoint |
| User AI keys store | `server/lib/user-ai-keys-store.cjs` | Per-user provider credentials (OpenAI, Anthropic, Ollama) — encrypted at rest |
| AI proxy gateway | `server/ai-proxy-gateway.cjs` | Enterprise DLP forward proxy screening outbound AI API request bodies |
| DLP dashboard | `server/dlp-dashboard.cjs` | Violation and compliance stats for the AI proxy |
| Local remediation engine | `packages/simplebeacon-cli/src/lib/local-remediation.js` | Local-first `--fix` agent using Ollama (no cloud by default) |
| Anonymized export engine | `packages/simplebeacon-cli/src/lib/anonymized-export.js` | Privacy-blind scan tokenization — abstract error codes only |
| MCP rule catalog | `packages/simplebeacon-cli/src/mcp/tools.js` | Model Context Protocol tool definitions exposing rule schemas to Cursor/Claude |
| Inference audit logger | `server/lib/ai-inference-audit-logger.cjs` | Structured logging of all LLM inference calls with trace identifiers |

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
