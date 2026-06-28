-- SimpleBeacon FixOrchestrator — Core Remediation Schema
-- Migration: 001
-- PostgreSQL 15+

-- ── Remediation Runs ─────────────────────────────────────────────────────────
-- Tracks each auto-remediation session triggered by a scan or user action.
CREATE TABLE IF NOT EXISTS remediation_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL,              -- FK to projects table
    scan_report_id      UUID,                       -- FK to scan_reports (nullable for manual triggers)
    triggered_by        VARCHAR(32) NOT NULL        -- 'scan_gate_failure', 'user_action', 'scheduled', 'ci_pipeline'
                        CHECK (triggered_by IN ('scan_gate_failure', 'user_action', 'scheduled', 'ci_pipeline')),
    status              VARCHAR(16) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'analyzing', 'applying', 'completed', 'partial', 'failed', 'rolled_back')),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    total_actions       INTEGER NOT NULL DEFAULT 0,
    successful_actions  INTEGER NOT NULL DEFAULT 0,
    failed_actions      INTEGER NOT NULL DEFAULT 0,
    quality_score_before DECIMAL(5,2),
    quality_score_after  DECIMAL(5,2),
    gate_pass_before    BOOLEAN,
    gate_pass_after     BOOLEAN,
    metadata            JSONB NOT NULL DEFAULT '{}', -- engine version, rule set version, AI model used
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remediation_runs_project ON remediation_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_remediation_runs_status ON remediation_runs(status);
CREATE INDEX IF NOT EXISTS idx_remediation_runs_triggered ON remediation_runs(triggered_by, started_at DESC);

-- ── Remediation Actions ────────────────────────────────────────────────────
-- Individual fix operations within a remediation run.
CREATE TABLE IF NOT EXISTS remediation_actions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID NOT NULL REFERENCES remediation_runs(id) ON DELETE CASCADE,
    rule_id             VARCHAR(64) NOT NULL,       -- e.g. 'no-hardcoded-secrets', 'remove-debug-artifact'
    rule_engine         VARCHAR(32) NOT NULL       -- 'regex', 'ast', 'llm', 'hybrid'
                        CHECK (rule_engine IN ('regex', 'ast', 'llm', 'hybrid')),
    severity            VARCHAR(16) NOT NULL
                        CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    file_path           TEXT NOT NULL,
    line_start          INTEGER,
    line_end            INTEGER,
    original_snippet    TEXT,                      -- base64 or truncated original
    fixed_snippet       TEXT,                      -- base64 or truncated replacement
    diff_patch          TEXT,                      -- unified diff of the change
    status              VARCHAR(16) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'applied', 'failed', 'rejected', 'reverted', 'superseded')),
    error_message       TEXT,                      -- populated if status = 'failed'
    applied_at          TIMESTAMPTZ,
    token_cost          INTEGER,                   -- LLM tokens consumed for this fix
    execution_ms        INTEGER,                   -- time to generate + apply fix
    confidence          DECIMAL(3,2),              -- 0.00–1.00 AI confidence in fix correctness
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remediation_actions_run ON remediation_actions(run_id);
CREATE INDEX IF NOT EXISTS idx_remediation_actions_rule ON remediation_actions(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remediation_actions_file ON remediation_actions(file_path);
CREATE INDEX IF NOT EXISTS idx_remediation_actions_status ON remediation_actions(status);

-- ── Remediation Rules (Auto-Fix Catalogue) ───────────────────────────────────
-- Metadata about which scanner rules support auto-fix and how.
CREATE TABLE IF NOT EXISTS remediation_rules (
    id                  VARCHAR(64) PRIMARY KEY,   -- matches scanner rule ID
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    engine              VARCHAR(32) NOT NULL
                        CHECK (engine IN ('regex', 'ast', 'llm', 'hybrid')),
    language_scope      VARCHAR(32)[] NOT NULL DEFAULT '{}',  -- {'js','ts','py','java'}
    fix_strategy        VARCHAR(32) NOT NULL
                        CHECK (fix_strategy IN ('delete', 'replace', 'wrap', 'insert', 'generate_config', 'refactor')),
    fix_template        TEXT,                      -- template or prompt used for LLM fixes
    requires_approval   BOOLEAN NOT NULL DEFAULT true,
    success_rate        DECIMAL(5,2),              -- rolling average from feedback table
    total_attempts      INTEGER NOT NULL DEFAULT 0,
    total_successes     INTEGER NOT NULL DEFAULT 0,
    avg_token_cost      INTEGER,                   -- average tokens per fix
    avg_execution_ms    INTEGER,                   -- average time per fix
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remediation_rules_active ON remediation_rules(is_active, engine);

-- ── Seed canonical rule catalogue ────────────────────────────────────────────
INSERT INTO remediation_rules (id, title, description, engine, language_scope, fix_strategy, requires_approval, is_active)
VALUES
    ('no-hardcoded-secrets',   'Remove hardcoded secrets',        'Replace hardcoded API keys/passwords with env var references', 'regex',  ARRAY['js','ts','py','java','go'], 'replace', true, true),
    ('remove-debug-artifact',    'Remove debug artifacts',           'Delete console.log, debugger, alert statements',              'regex',  ARRAY['js','ts'],                    'delete',  false, true),
    ('fix-missing-strict-mode',  'Add use strict directive',         'Insert \"use strict\" at top of JS functions/files',           'ast',    ARRAY['js'],                         'insert',  false, true),
    ('remove-empty-stub',        'Remove empty stub functions',      'Delete functions with only pass/return statements',             'ast',    ARRAY['js','ts','py'],               'delete',  false, true),
    ('add-gitignore-entry',      'Add missing .gitignore entries',   'Append common build/secret patterns to .gitignore',           'regex',  ARRAY['*'],                            'insert',  false, true),
    ('generate-eslint-config',   'Generate ESLint config baseline',  'Create eslint.config.js with recommended rules',            'llm',    ARRAY['js','ts'],                    'generate_config', true, true),
    ('refactor-deep-nesting',    'Flatten deeply nested blocks',     'Replace nested conditionals with guard clauses',              'ast',    ARRAY['js','ts','py','java'],        'refactor', true, true)
ON CONFLICT (id) DO NOTHING;

-- ── Updated-at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_remediation_runs_updated
    BEFORE UPDATE ON remediation_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_remediation_rules_updated
    BEFORE UPDATE ON remediation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
