/**
 * Scan risk and action-plan builders for roadmap generation.
 *
 * Extracted from code-roadmap-generator.cjs to reduce module size
 * and keep scan-analysis concerns in one place.
 */

/**
 * Build a list of risks from a Simplebeacon scan report.
 * @param {object|null} scanReport
 * @returns {Array<{category:string,severity:string,description:string}>}
 */
function buildScanRisks(scanReport) {
    if (!scanReport || typeof scanReport !== 'object') return [];
    const risks = [];
    const gate = scanReport.gate || {};
    const scope = scanReport.scanScope || {};
    if (gate.pass === false || gate.blockingCount > 0) {
        risks.push({
            category: 'security',
            severity: gate.blockingCount > 50 ? 'high' : 'medium',
            description: `Gate FAIL \u2014 ${gate.blockingCount || 0} blocking issue(s), ${gate.warningCount || 0} warning(s)`
        });
    }
    if (scope.euAiActPatternHits > 0) {
        risks.push({
            category: 'compliance',
            severity: scope.euAiActHighRiskIndicators > 0 ? 'high' : 'medium',
            description: `${scope.euAiActPatternHits} EU AI Act pattern hit(s) detected`
        });
    }
    if (scope.llmSlopPatternHits > 0) {
        risks.push({
            category: 'quality',
            severity: 'medium',
            description: `${scope.llmSlopPatternHits} LLM slop pattern hit(s) in production paths`
        });
    }
    if (scope.reportHealth === 'stale-full-tree-scan') {
        risks.push({
            category: 'maintainability',
            severity: 'medium',
            description: 'Scan data is stale (full-tree walk) \u2014 rescan recommended before roadmap decisions'
        });
    }
    return risks;
}

/**
 * Build a prioritized action plan from a Simplebeacon scan report.
 * @param {object|null} scanReport
 * @returns {Array<{priority:string,action:string,category:string}>}
 */
function buildScanActionPlan(scanReport) {
    if (!scanReport || typeof scanReport !== 'object') return [];
    const plan = [];
    const gate = scanReport.gate || {};
    const scope = scanReport.scanScope || {};
    if (gate.pass === false || gate.blockingCount > 0) {
        plan.push({
            priority: 'HIGH',
            action: 'Clear all gate-blocking findings before any production deploy',
            category: 'security'
        });
        plan.push({
            priority: 'HIGH',
            action: `Remediate ${gate.blockingCount || 0} blocking issue(s) and re-run gate scan`,
            category: 'security'
        });
    }
    if (scope.euAiActPatternHits > 0) {
        plan.push({
            priority: 'MEDIUM',
            action: 'Review EU AI Act pattern hits and document compliance posture',
            category: 'compliance'
        });
    }
    if (scope.llmSlopPatternHits > 0) {
        plan.push({
            priority: 'MEDIUM',
            action: 'Remove LLM slop artifacts from production paths',
            category: 'quality'
        });
    }
    if (scope.reportHealth === 'stale-full-tree-scan') {
        plan.push({
            priority: 'MEDIUM',
            action: 'Re-run scan with updated simplebeacon config to remove stale full-tree warnings',
            category: 'maintainability'
        });
    }
    return plan;
}

module.exports = { buildScanRisks, buildScanActionPlan };
