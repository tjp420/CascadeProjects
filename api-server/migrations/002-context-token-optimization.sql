-- SimpleBeacon FixOrchestrator — Context Token Optimization Schema
-- Migration: 002
-- PostgreSQL 15+

-- ── Context Snapshots ────────────────────────────────────────────────────────
-- Compressed repo state captured before/after a remediation run for rollback
-- and for training context-window optimization models.
CREATE TABLE IF NOT EXISTS context_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID NOT NULL REFERENCES remediation_runs(id) ON DELETE CASCADE,
    snapshot_type       VARCHAR(16) NOT NULL
                        CHECK (snapshot_type IN ('pre_fix', 'post_fix', 'rollback_target')),
    file_tree_hash      VARCHAR(64) NOT NULL,      -- SHA-256 of sorted file paths + mtimes
    manifest            JSONB NOT NULL,             -- {files: [{path, size, hash}], totalBytes, totalLines}
    compressed_diff     BYTEA,                      -- zstd-compressed delta from previous snapshot (nullable for first)
    storage_bytes       INTEGER NOT NULL,           -- raw size of manifest + diff
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_snapshots_run ON context_snapshots(run_id, snapshot_type);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_hash ON context_snapshots(file_tree_hash);

-- ── Token Budgets ──────────────────────────────────────────────────────────
-- Tracks how many tokens each fix consumed and what the budget ceiling was,
-- enabling adaptive budgeting for future runs.
CREATE TABLE IF NOT EXISTS token_budgets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID NOT NULL REFERENCES remediation_runs(id) ON DELETE CASCADE,
    action_id           UUID REFERENCES remediation_actions(id) ON DELETE SET NULL,
    phase               VARCHAR(16) NOT NULL
                        CHECK (phase IN ('analysis', 'planning', 'generation', 'verification', 'rollback')),
    tokens_input        INTEGER NOT NULL DEFAULT 0,
    tokens_output       INTEGER NOT NULL DEFAULT 0,
    tokens_total        INTEGER GENERATED ALWAYS AS (tokens_input + tokens_output) STORED,
    budget_ceiling      INTEGER NOT NULL,           -- max tokens allowed for this phase
    budget_strategy     VARCHAR(16) NOT NULL
                        CHECK (budget_strategy IN ('fixed', 'adaptive', 'unlimited')),
    model_name          VARCHAR(64),                -- e.g. 'gpt-4o', 'llama3.2:70b'
    was_truncated       BOOLEAN NOT NULL DEFAULT false,
    truncation_reason   VARCHAR(64),                -- 'file_too_large', 'context_window_full', 'cost_limit'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_budgets_run ON token_budgets(run_id, phase);
CREATE INDEX IF NOT EXISTS idx_token_budgets_action ON token_budgets(action_id);
CREATE INDEX IF NOT EXISTS idx_token_budgets_truncated ON token_budgets(was_truncated) WHERE was_truncated = true;

-- ── Context Eviction Log ─────────────────────────────────────────────────────
-- Records what files / snippets were evicted from the AI context window
-- due to token pressure, to inform retry or chunking strategies.
CREATE TABLE IF NOT EXISTS context_eviction_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID NOT NULL REFERENCES remediation_runs(id) ON DELETE CASCADE,
    action_id           UUID REFERENCES remediation_actions(id) ON DELETE SET NULL,
    evicted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    evicted_type        VARCHAR(16) NOT NULL
                        CHECK (evicted_type IN ('file', 'function', 'snippet', 'comment', 'import')),
    evicted_path        TEXT,                      -- file path or identifier
    evicted_lines       INTEGER,                   -- approximate line count evicted
    evicted_tokens      INTEGER NOT NULL,          -- estimated tokens evicted
    eviction_reason     VARCHAR(32) NOT NULL
                        CHECK (eviction_reason IN ('budget_exceeded', 'window_full', 'priority_low', 'duplicate', 'timeout')),
    retry_strategy      VARCHAR(32)                -- how we recovered: 'chunked', 'summarized', 'excluded', 'deferred'
                        CHECK (retry_strategy IN ('chunked', 'summarized', 'excluded', 'deferred', null))
);

CREATE INDEX IF NOT EXISTS idx_context_eviction_run ON context_eviction_log(run_id);
CREATE INDEX IF NOT EXISTS idx_context_eviction_reason ON context_eviction_log(eviction_reason, evicted_at DESC);

-- ── Context Optimization Cache ───────────────────────────────────────────────
-- Caches successful context-window layouts (which files were included in what order)
-- so future similar projects can reuse optimal layouts without re-measuring.
CREATE TABLE IF NOT EXISTS context_optimization_cache (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key           VARCHAR(128) NOT NULL UNIQUE,  -- hash of (project_type + file_count_bucket + rule_set_version)
    project_type        VARCHAR(32) NOT NULL,         -- 'node', 'python', 'java', 'go', 'ruby'
    file_count_bucket   VARCHAR(16) NOT NULL,         -- 'tiny:<100', 'small:100-1k', 'medium:1k-10k', 'large:>10k'
    rule_set_version    VARCHAR(16) NOT NULL,
    optimal_layout      JSONB NOT NULL,               -- {includeOrder: [paths], excludePatterns: [glob], maxFileBytes: N}
    avg_token_savings   INTEGER,                      -- tokens saved vs naive full-repo inclusion
    hit_count           INTEGER NOT NULL DEFAULT 0,
    last_used_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_cache_lookup ON context_optimization_cache(project_type, file_count_bucket, rule_set_version);
