'use strict';

/**
 * Agent PDA — Gate Bridge
 *
 * Connects the policy engine to the existing scan/gate engine.
 * Provides canFinalize() — the self-gating check agents call before
 * claiming work is done.
 */

const { execSync } = require('child_process');
const { checkAction } = require('./policy-engine');

/**
 * Run the SimpleBeacon gate scan and return the result.
 * @param {string} projectRoot
 * @returns {object} { pass, blockingCount, qualityScore, report }
 */
function runGate(projectRoot) {
    const root = projectRoot || process.cwd();
    try {
        const output = execSync(
            `node "${require.resolve('../../bin/simplebeacon.js')}" scan --gate --offline --format json`,
            { cwd: root, encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const report = JSON.parse(output);
        return {
            pass: report.gate === 'pass' || report.gatePass === true,
            blockingCount: report.blockingCount || report.criticalCount || 0,
            qualityScore: report.qualityScore || 0,
            report
        };
    } catch (err) {
        return {
            pass: false,
            blockingCount: -1,
            qualityScore: 0,
            report: null,
            error: err.message
        };
    }
}

/**
 * Read the latest gate report from .simplebeacon/report.json
 * without re-running the scan.
 */
function getGateStatus(projectRoot) {
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(projectRoot || process.cwd(), '.simplebeacon', 'report.json');
    try {
        const raw = fs.readFileSync(reportPath, 'utf8');
        const report = JSON.parse(raw);
        // Handle multiple report formats:
        // - Flat: { gate: 'pass', gatePass: true, blockingCount: N }
        // - Nested: { gate: { pass: true, blockingCount: N } }
        const gateObj = typeof report.gate === 'object' ? report.gate : null;
        const pass = gateObj ? gateObj.pass === true : (report.gate === 'pass' || report.gatePass === true);
        const blockingCount = gateObj ? (gateObj.blockingCount || 0) : (report.blockingCount || report.criticalCount || 0);
        return {
            pass,
            blockingCount,
            qualityScore: report.qualityScore || 0,
            report,
            reportPath
        };
    } catch {
        return {
            pass: false,
            blockingCount: -1,
            qualityScore: 0,
            report: null,
            reportPath,
            error: 'No gate report found. Run a gate scan first.'
        };
    }
}

/**
 * The self-gating check: can the agent finalize its work?
 *
 * Combines:
 * 1. Policy check — are there forbidden_action or required_check violations?
 * 2. Gate scan — if a must-scan policy is enabled, run the gate
 *
 * @param {string} projectRoot
 * @param {string} agentId — optional, for logging
 * @param {object} opts — { runScan: true (default), action: 'finalize-changes' }
 * @returns {object} { canFinalize, blockingCount, violations, warnings, gateResult }
 */
function canFinalize(projectRoot, agentId, opts = {}) {
    const action = opts.action || 'finalize-changes';
    const policyResult = checkAction(projectRoot, action, {});

    const result = {
        canFinalize: true,
        blockingCount: 0,
        violations: policyResult.violations,
        warnings: policyResult.warnings,
        approvalsNeeded: policyResult.approvalsNeeded,
        gateResult: null,
        agentId
    };

    // Check for forbidden_action violations
    if (policyResult.blocked) {
        result.canFinalize = false;
        result.blockingCount += policyResult.violations.length;
    }

    // Check for required_check policies — run or read the gate if must-scan is enabled
    const hasMustScan = policyResult.violations.some(v => v.checkCommand) ||
                        policyResult.warnings.some(w => w.checkCommand);

    if (hasMustScan) {
        // Decide whether to run a fresh scan or use existing report
        // runScan=false + useExistingReport=true → read existing report
        // runScan=false + useExistingReport=false → skip gate entirely
        // runScan=true (default) + useExistingReport=true → read existing report
        // runScan=true (default) + useExistingReport=false → run fresh scan
        const shouldCheckGate = opts.runScan !== false || opts.useExistingReport === true;

        if (shouldCheckGate) {
            const gateResult = opts.useExistingReport
                ? getGateStatus(projectRoot)
                : runGate(projectRoot);
            result.gateResult = gateResult;

            if (gateResult.pass) {
                // Gate passed — clear the required_check violations since the check is satisfied
                result.violations = result.violations.filter(v => !v.checkCommand);
                result.warnings = result.warnings.filter(w => !w.checkCommand);
                // Recalculate blocked status (may still be blocked by forbidden_action violations)
                const remainingViolations = result.violations.length;
                if (remainingViolations === 0 && !result.approvalsNeeded.length) {
                    result.canFinalize = true;
                    result.blockingCount = 0;
                }
            } else {
                // Gate failed — if the must-scan policy is a block severity, gate failure blocks
                const blockingScanPolicy = policyResult.violations.find(v => v.checkCommand);
                if (blockingScanPolicy) {
                    result.canFinalize = false;
                    result.blockingCount += gateResult.blockingCount > 0 ? gateResult.blockingCount : 1;
                }
            }
        }
    }

    // Check for approval requirements
    if (policyResult.needsApproval) {
        result.canFinalize = false;
        result.blockingCount += policyResult.approvalsNeeded.length;
    }

    return result;
}

module.exports = {
    runGate,
    getGateStatus,
    canFinalize
};
