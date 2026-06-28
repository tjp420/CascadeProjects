-- SimpleBeacon FixOrchestrator — Feedback Loop & Effectiveness Schema
-- Migration: 003
-- PostgreSQL 15+

-- ── Remediation Feedback ─────────────────────────────────────────────────────
-- User or system acceptance/rejection of individual fix actions.
CREATE TABLE IF NOT EXISTS remediation_feedback (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id           UUID NOT NULL REFERENCES remediation_actions(id) ON DELETE CASCADE,
    run_id              UUID NOT NULL REFERENCES remediation_runs(id) ON DELETE CASCADE,
    feedback_type       VARCHAR(16) NOT NULL
                        CHECK (feedback_type IN ('auto_accepted', 'user_accepted', 'user_rejected', 'system_rejected', 'timeout', 'superseded')),
    rejected_reason     VARCHAR(64),                -- populated if feedback_type = 'user_rejected'
                        CHECK (rejected_reason IS NULL OR rejected_reason IN (
                            'wrong_fix', 'incomplete_fix', 'broke_build', 'broke_tests',
                            'semantic_change', 'style_preference', 'false_positive',
                            'security_risk', 'other'
                        )),
    rejected_comment    TEXT,                       -- free-text user explanation
    reviewer_id         UUID,                       -- NULL for auto/system feedback
    reviewed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source              VARCHAR(16) NOT NULL DEFAULT 'web_ui'
                        CHECK (source IN ('web_ui', 'vscode_extension', 'cli', 'ci_bot', 'auto_pipeline')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remediation_feedback_action ON remediation_feedback(action_id);
CREATE INDEX IF NOT EXISTS idx_remediation_feedback_run ON remediation_feedback(run_id);
CREATE INDEX IF NOT EXISTS idx_remediation_feedback_type ON remediation_feedback(feedback_type, reviewed_at DESC);

-- ── Gate Results Post-Fix ──────────────────────────────────────────────────
-- Records whether the quality gate passed after fixes were applied.
CREATE TABLE IF NOT EXISTS gate_results_post_fix (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID NOT NULL REFERENCES remediation_runs(id) ON DELETE CASCADE,
    action_id           UUID REFERENCES remediation_actions(id) ON DELETE SET NULL,
    scan_report_id      UUID,                       -- FK to scan_reports
    gate_pass           BOOLEAN NOT NULL,
    quality_score       DECIMAL(5,2),
    critical_count      INTEGER NOT NULL DEFAULT 0,
    high_count          INTEGER NOT NULL DEFAULT 0,
    medium_count        INTEGER NOT NULL DEFAULT 0,
    low_count           INTEGER NOT NULL DEFAULT 0,
    new_findings        JSONB NOT NULL DEFAULT '[]', -- findings introduced by the fix (regressions)
    resolved_findings   JSONB NOT NULL DEFAULT '[]', -- findings eliminated by the fix
    scanned_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gate_results_run ON gate_results_post_fix(run_id);
CREATE INDEX IF NOT EXISTS idx_gate_results_pass ON gate_results_post_fix(gate_pass, scanned_at DESC);

-- ── Fix Effectiveness Scores ─────────────────────────────────────────────────
-- Aggregated long-term effectiveness per rule, updated nightly by a background job.
CREATE TABLE IF NOT EXISTS fix_effectiveness_scores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id             VARCHAR(64) NOT NULL REFERENCES remediation_rules(id) ON DELETE CASCADE,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    total_attempts      INTEGER NOT NULL DEFAULT 0,
    auto_accepted       INTEGER NOT NULL DEFAULT 0,
    user_accepted       INTEGER NOT NULL DEFAULT 0,
    user_rejected       INTEGER NOT NULL DEFAULT 0,
    build_broken        INTEGER NOT NULL DEFAULT 0,
    tests_broken        INTEGER NOT NULL DEFAULT 0,
    gate_pass_rate      DECIMAL(5,2),               -- % of runs where gate passed after fix
    avg_quality_delta   DECIMAL(5,2),               -- average (score_after - score_before)
    avg_token_cost      INTEGER,
    avg_execution_ms    INTEGER,
    top_reject_reason   VARCHAR(64),                -- most common rejection reason this period
    model_name          VARCHAR(64),                -- which LLM generated the fixes
    score_version       INTEGER NOT NULL DEFAULT 1, -- for versioning the scoring algorithm
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rule_id, period_start, period_end, model_name)
);

CREATE INDEX IF NOT EXISTS idx_effectiveness_rule ON fix_effectiveness_scores(rule_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_effectiveness_period ON fix_effectiveness_scores(period_start, period_end);

-- ── Feedback Aggregation Trigger ─────────────────────────────────────────────
-- Automatically updates remediation_rules.success_rate when feedback is inserted.
CREATE OR REPLACE FUNCTION update_rule_success_rate()
RETURNS TRIGGER AS $$
DECLARE
    total BIGINT;
    successes BIGINT;
BEGIN
    SELECT COUNT(*) INTO total
    FROM remediation_feedback
    WHERE action_id IN (SELECT id FROM remediation_actions WHERE rule_id = (
        SELECT rule_id FROM remediation_actions WHERE id = NEW.action_id
    ));

    SELECT COUNT(*) INTO successes
    FROM remediation_feedback
    WHERE action_id IN (SELECT id FROM remediation_actions WHERE rule_id = (
        SELECT rule_id FROM remediation_actions WHERE id = NEW.action_id
    ))
    AND feedback_type IN ('auto_accepted', 'user_accepted');

    IF total > 0 THEN
        UPDATE remediation_rules
        SET success_rate = ROUND((successes::NUMERIC / total::NUMERIC) * 100, 2),
            total_attempts = total,
            total_successes = successes,
            updated_at = now()
        WHERE id = (SELECT rule_id FROM remediation_actions WHERE id = NEW.action_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_feedback_update_rule ON remediation_feedback;
CREATE TRIGGER tr_feedback_update_rule
    AFTER INSERT ON remediation_feedback
    FOR EACH ROW EXECUTE FUNCTION update_rule_success_rate();

-- ── Remediation Action Status Trigger ────────────────────────────────────────
-- When an action status changes to 'applied', update the parent run counters.
CREATE OR REPLACE FUNCTION update_run_counters_on_action_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'applied' AND (OLD.status IS NULL OR OLD.status != 'applied') THEN
        UPDATE remediation_runs
        SET successful_actions = successful_actions + 1,
            updated_at = now()
        WHERE id = NEW.run_id;
    ELSIF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN
        UPDATE remediation_runs
        SET failed_actions = failed_actions + 1,
            updated_at = now()
        WHERE id = NEW.run_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_action_update_run ON remediation_actions;
CREATE TRIGGER tr_action_update_run
    AFTER UPDATE ON remediation_actions
    FOR EACH ROW EXECUTE FUNCTION update_run_counters_on_action_change();
