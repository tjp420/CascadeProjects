# SimpleBeacon 2.0 Intelligence Architecture

**Version:** 1.0.0
**Date:** 2026-06-27
**Status:** Design Document

---

## 1. Overview

Phase 2 Intelligence transforms SimpleBeacon from a passive scanner into an active AI-powered development companion. The architecture must handle:

- **Deterministic rule findings** → **AI-generated fixes** (local-only by default)
- **Small code snippets** → **Context-aware patches** (respecting token limits)
- **Single fixes** → **Batch remediation pipelines** (with rollback support)
- **Stateless scans** → **Persistent fix tracking** (for analytics and learning)

---

## 2. Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  VS Code: Extension  │  CLI  │  Web Dashboard  │  MCP        │
└───────────────────────┴───────┴─────────────────┴───────────┘
                            │
┌───────────────────────────┴───────────────────────────────┐
│                  ORCHESTRATION LAYER                         │
│  FixOrchestrator  │  BatchPipeline  │  ContextAssembler     │
└────────────────────┴───────────────┴───────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────┐
│                  PROMPT ENGINE LAYER                        │
│  PromptBuilder  │  TemplateRegistry  │  TokenBudgetManager  │
└────────────────┴───────────────────┴──────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────┐
│                  MODEL BRIDGE LAYER                         │
│  OllamaAdapter  │  CloudAdapter  │  GGUFAdapter          │
└────────────────┴──────────────┴─────────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────┐
│                  PERSISTENCE LAYER                          │
│  FixHistory  │  ContextCache  │  FeedbackStore             │
└─────────────┴──────────────┴────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Fix Attempts Table (`fix_attempts`)

Tracks every AI-generated fix attempt for analytics and improvement.

| Column             | Type      | Description                                     |
| ------------------ | --------- | ----------------------------------------------- |
| `id`               | UUID PK   | Unique fix attempt ID                           |
| `scan_id`          | UUID FK   | Links to originating scan                       |
| `finding_id`       | TEXT      | SimpleBeacon finding identifier                 |
| `file_path`        | TEXT      | Relative path within repo                       |
| `issue_type`       | TEXT      | e.g., "credential-leak", "llm-slop"             |
| `severity`         | ENUM      | critical / high / medium / low                  |
| `model_used`       | TEXT      | e.g., "llama3.2:latest", "gpt-4o"               |
| `provider`         | ENUM      | local / cloud / gguf                            |
| `prompt_tokens`    | INTEGER   | Token count of sent prompt                      |
| `response_tokens`  | INTEGER   | Token count of model response                   |
| `latency_ms`       | INTEGER   | Round-trip time                                 |
| `status`           | ENUM      | pending / applied / rejected / failed / dry-run |
| `search_snippet`   | TEXT      | Original code (hashed for privacy)              |
| `replace_snippet`  | TEXT      | Proposed replacement (hashed)                   |
| `syntax_valid`     | BOOLEAN   | Did `node -c` pass after patch?                 |
| `tests_pass`       | BOOLEAN   | Did test suite pass after patch?                |
| `user_accepted`    | BOOLEAN   | Did user click "Accept Fix"?                    |
| `rejection_reason` | TEXT      | Why user rejected (optional)                    |
| `created_at`       | TIMESTAMP | Attempt timestamp                               |
| `applied_at`       | TIMESTAMP | When patch was written to disk                  |

### 3.2 Context Cache Table (`context_cache`)

Stores extracted snippets to avoid re-reading files for overlapping findings.

| Column         | Type      | Description                              |
| -------------- | --------- | ---------------------------------------- |
| `cache_key`    | TEXT PK   | `sha256(filePath + startLine + endLine)` |
| `file_path`    | TEXT      | Absolute path                            |
| `start_line`   | INTEGER   | 0-indexed start                          |
| `end_line`     | INTEGER   | 0-indexed end                            |
| `content_hash` | TEXT      | `sha256(snippet_content)`                |
| `content`      | TEXT      | Cached snippet text                      |
| `expires_at`   | TIMESTAMP | TTL (default: 1 hour)                    |

### 3.3 Feedback Store Table (`fix_feedback`)

Captures user thumbs-up/down on fixes for reinforcement learning.

| Column           | Type      | Description                      |
| ---------------- | --------- | -------------------------------- |
| `id`             | UUID PK   | Unique feedback ID               |
| `fix_attempt_id` | UUID FK   | Links to fix_attempts            |
| `rating`         | INTEGER   | -1 (bad), 0 (neutral), +1 (good) |
| `comment`        | TEXT      | Optional user explanation        |
| `created_at`     | TIMESTAMP | Feedback timestamp               |

### 3.4 Model Performance Table (`model_performance`)

Tracks per-model success rates to auto-select the best model.

| Column           | Type      | Description                |
| ---------------- | --------- | -------------------------- |
| `model_id`       | TEXT PK   | e.g., "llama3.2:latest"    |
| `issue_type`     | TEXT PK   | e.g., "credential-leak"    |
| `attempts`       | INTEGER   | Total fixes attempted      |
| `applied`        | INTEGER   | Count applied to disk      |
| `syntax_valid`   | INTEGER   | Count passing syntax check |
| `user_accepted`  | INTEGER   | Count user-approved        |
| `avg_latency_ms` | INTEGER   | Average round-trip time    |
| `updated_at`     | TIMESTAMP | Last update                |

---

## 4. Context-Window Management

### 4.1 Token Budget Allocation

For a model with context window `C` (e.g., 4096, 8192, 128K):

```
┌──────────────────────────────────────────────────┐
│  SYSTEM PROMPT  (~200 tokens)  — fixed overhead  │
├──────────────────────────────────────────────────┤
│  ISSUE CONTEXT  (~150 tokens)  — type, severity  │
├──────────────────────────────────────────────────┤
│  FILE METADATA  (~100 tokens)  — path, language │
├──────────────────────────────────────────────────┤
│  CODE SNIPPET   (remaining ~70%)               │
├──────────────────────────────────────────────────┤
│  OUTPUT BUFFER  (~200 tokens)  — JSON response   │
└──────────────────────────────────────────────────┘
```

**Snippet sizing algorithm:**

```typescript
function calculateContextLines(contextWindow: number): number {
  const overhead = 450; // system + issue + metadata + output
  const available = contextWindow - overhead;
  const avgTokensPerLine = 8; // heuristic for code
  const maxLines = Math.floor(available / avgTokensPerLine);
  return Math.min(maxLines, 120); // cap at 120 lines for readability
}
```

### 4.2 Smart Expansion

When a finding spans multiple lines (e.g., a function with a hardcoded secret):

1. **Expand to enclosing function/method** (AST-based)
2. **If still too large**, expand to enclosing block (`if`, `for`, `try`)
3. **If still too large**, use `contextLines` symmetric window around finding line
4. **If finding line is near file start/end**, shift window asymmetrically

### 4.3 Multi-Part Files

For files >500 lines, the fix engine may need broader context:

- **Phase 1:** Extract immediate snippet (±8 lines) → 80% of fixes
- **Phase 2:** If Phase 1 fails, expand to enclosing function → 15% of fixes
- **Phase 3:** If Phase 2 fails, ask model to reason about file structure → 5% of fixes

---

## 5. Prompt-Handling Pipeline

### 5.1 Prompt Builder (`PromptBuilder`)

```typescript
interface PromptTemplate {
  id: string; // e.g., "fix-credential-leak"
  systemPrompt: string; // Role definition
  userPromptTemplate: string; // Mustache-style template
  requiredContext: ('snippet' | 'filePath' | 'language' | 'imports')[];
  maxTokens: number;
  temperature: number;
}
```

**Template Registry:**

| Template ID           | Purpose                     | Temperature |
| --------------------- | --------------------------- | ----------- |
| `fix-credential-leak` | Extract secret to env var   | 0.0         |
| `fix-llm-slop`        | Remove placeholder comments | 0.0         |
| `fix-hardcoded-url`   | Parameterize URL            | 0.0         |
| `fix-empty-catch`     | Add proper error handling   | 0.0         |
| `fix-missing-strict`  | Add 'use strict'            | 0.0         |
| `explain-issue`       | Explain why finding matters | 0.3         |

### 5.2 Prompt Caching

Prompts are cached by `sha256(templateId + issueType + snippetHash)`:

- **Cache hit:** Skip model call, return cached response (if <1 hour old)
- **Cache miss:** Build prompt, call model, store response
- **Cache invalidation:** Auto-expire after 1 hour or on model version change

### 5.3 Response Normalization

All model outputs pass through `ResponseNormalizer`:

1. **Strip markdown fences** (`json ... `)
2. **Extract first JSON object** via regex `/\{[\s\S]*?\}/`
3. **Validate schema** — must have `search` and `replace` string fields
4. **Safety check** — `search` must exist in original snippet
5. **Syntax check** — run `node -c` on patched snippet (if JS/TS)

### 5.4 Retry Logic

```typescript
const RETRY_POLICY = {
  maxRetries: 2,
  backoffMs: [1000, 3000], // 1s, then 3s
  onFailure: [
    'expandContextLines', // Retry 1: give model more context
    'simplifyPrompt', // Retry 2: shorter, clearer prompt
    'fallbackToManual', // Final: mark as "needs manual review"
  ],
};
```

---

## 6. Fix Orchestrator

### 6.1 Single-Fix Flow

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Finding   │────▶│ ContextAssembler│────▶│  TokenBudgeter  │
│   (Issue)   │     │ (extract snippet)│     │ (size snippet)  │
└─────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
┌─────────────┐     ┌─────────────────┐     ┌─────────────▼─────┐
│   Patch     │◀────│ ResponseParser  │◀────│   ModelBridge     │
│   Applied   │     │ (normalize)     │     │ (Ollama/Cloud)    │
└─────────────┘     └─────────────────┘     └─────────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────────┐
│  SyntaxCheck│────▶│  FeedbackCapture│
│  (node -c)  │     │  (user accept?) │
└─────────────┘     └─────────────────┘
```

### 6.2 Batch-Fix Flow

For `runLocalRemediation(findings, options)`:

1. **Deduplicate** findings by `(filePath, line, type)`
2. **Sort by severity** (critical → high → medium → low)
3. **Group by file** to minimize disk I/O
4. **Process sequentially** per file (avoid concurrent writes)
5. **Stop on syntax failure** for that file (don't cascade breaks)
6. **Collect metrics** after each fix attempt

### 6.3 Rollback Support

Every applied fix writes to a `.simplebeacon/fix-backups/` directory:

```
.fix-backups/
├── 2026-06-27T15-30-00-src-utils-auth.js.patch
└── 2026-06-27T15-30-00-src-utils-auth.js.orig
```

Rollback command:

```bash
simplebeacon fix rollback --id <fixAttemptId>
# or
simplebeacon fix rollback --file src/utils/auth.js --last 1
```

---

## 7. Model Bridge Abstraction

### 7.1 Adapter Interface

```typescript
interface ModelAdapter {
  readonly name: string;
  readonly supportsStreaming: boolean;
  readonly maxContextTokens: number;

  generate(prompt: string, options: GenerateOptions): Promise<ModelResponse>;
  testConnection(): Promise<{ ok: boolean; latencyMs: number }>;
  countTokens(text: string): number; // approximate
}
```

### 7.2 Adapters

| Adapter            | Backend                     | Context Window            | Local?     |
| ------------------ | --------------------------- | ------------------------- | ---------- |
| `OllamaAdapter`    | Ollama HTTP API             | Model-dependent (4K–128K) | Yes        |
| `GGUFAdapter`      | node-llama-cpp / llama-node | Model-dependent           | Yes        |
| `OpenAIAdapter`    | OpenAI API                  | 128K                      | No (cloud) |
| `AnthropicAdapter` | Claude API                  | 200K                      | No (cloud) |

### 7.3 Auto-Selection

```typescript
function selectAdapter(preferences: UserPreferences): ModelAdapter {
  if (preferences.offline) {
    // Try Ollama first, then fall back to GGUF
    return ollamaAdapter.isAvailable() ? ollamaAdapter : ggufAdapter;
  }
  // Online: use highest-performing model from model_performance table
  return getBestModelFromHistory(preferences.issueType);
}
```

---

## 8. Performance & Observability

### 8.1 Metrics

| Metric                       | Target          | Alert Threshold |
| ---------------------------- | --------------- | --------------- |
| Fix generation latency (p95) | <3s             | >10s            |
| Syntax validation pass rate  | >85%            | <70%            |
| User acceptance rate         | >60%            | <40%            |
| Cache hit rate               | >30%            | <10%            |
| Token utilization            | <80% of context | >95%            |

### 8.2 Tracing

Every fix attempt gets a trace ID:

```json
{
  "traceId": "fix_abc123",
  "spans": [
    { "name": "extractSnippet", "ms": 12 },
    { "name": "buildPrompt", "ms": 5 },
    { "name": "modelGenerate", "ms": 2340 },
    { "name": "parseResponse", "ms": 3 },
    { "name": "syntaxCheck", "ms": 45 },
    { "name": "applyPatch", "ms": 8 }
  ]
}
```

---

## 9. Security & Privacy

### 9.1 Data Boundaries

| Data            | Stored Where                    | Encrypted?  | Retention  |
| --------------- | ------------------------------- | ----------- | ---------- |
| Code snippets   | Context cache (local SQLite)    | AES-256-GCM | 1 hour TTL |
| Fix history     | `.simplebeacon/fix-history.db`  | AES-256-GCM | 90 days    |
| User feedback   | `.simplebeacon/fix-feedback.db` | AES-256-GCM | 1 year     |
| Model prompts   | Never persisted                 | N/A         | Ephemeral  |
| Model responses | Never persisted                 | N/A         | Ephemeral  |

### 9.2 Cloud Safety

When `--fix-provider openai|anthropic` is used:

- **Prompt sanitization:** Strip all comments containing internal URLs, employee names, or proprietary identifiers
- **Differential privacy:** Add small noise to line numbers in metadata
- **Audit log:** Every cloud call is logged with timestamp, model, and token count (not content)
- **Opt-in only:** Never auto-select cloud; user must explicitly pass `--fix-provider`

---

## 10. Migration Path

### From Current (v1.x) to v2.0 Intelligence

1. **v1.1** (current): `local-remediation.js` with Ollama only
2. **v1.2**: Add `FixHistory` persistence + `ContextCache`
3. **v1.3**: Add `PromptBuilder` with template registry
4. **v1.4**: Add `ModelBridge` with adapter pattern
5. **v2.0**: Full orchestration layer + batch pipeline + rollback

---

## 11. API Surface

### New CLI Commands

```bash
# Single fix
simplebeacon fix --finding-id <id> [--dry-run]

# Batch fix all high-severity findings
simplebeacon fix --severity high [--max-fixes 20] [--dry-run]

# Explain a finding (no patch)
simplebeacon explain --finding-id <id>

# Rollback last fix
simplebeacon fix rollback [--file <path>] [--last N]

# View fix history
simplebeacon fix history [--file <path>] [--since 2026-06-01]
```

### New VS Code: Commands

- `SimpleBeacon: Fix This Finding` (context menu on finding)
- `SimpleBeacon: Explain This Issue` (hover action)
- `SimpleBeacon: Batch Fix All High Issues`
- `SimpleBeacon: Rollback Last Fix`

---

## 12. Open Questions

1. **GGUF inference:** Should we embed `node-llama-cpp` or shell out to `llama.cpp` server?
2. **Cloud provider billing:** How do we track per-user token spend for enterprise invoicing?
3. **Multi-file fixes:** Some fixes require changes across 2+ files (e.g., extract secret → add to .env → update import). How do we represent atomic multi-file transactions?
4. **Test execution:** Should we auto-run `npm test` after each fix, or only on explicit request?
5. **Model fine-tuning:** Do we collect successful fixes to fine-tune a custom SimpleBeacon model?

---

_This document is a living design. Update as implementation progresses._
