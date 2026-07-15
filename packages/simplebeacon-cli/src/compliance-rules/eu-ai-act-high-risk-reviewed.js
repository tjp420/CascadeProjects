// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
module.exports = function evaluateEuAiActHighRiskReviewed(rule, { report }) {
    const summary = report.euAiActSummary;
    if (report.euAiActScanned == null && !summary) {
        return { id: rule.id, title: rule.title, category: rule.category, severity: rule.severity, remediation: rule.remediation || null, status: 'skip', evidence: 'EU AI Act scan not run — enable eu-ai-act-patterns rule' };
    }
    const highRisk = summary?.highRiskIndicators ?? 0;
    const docs = summary?.documentationArtifacts ?? 0;
    if (highRisk === 0) {
        return { id: rule.id, title: rule.title, category: rule.category, severity: rule.severity, remediation: rule.remediation || null, status: 'pass', evidence: 'No Annex III high-risk AI patterns detected in scanned paths' };
    }
    const ok = docs > 0;
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: ok ? 'pass' : 'fail',
        evidence: ok
            ? `${highRisk} high-risk indicator(s) with ${docs} documentation artifact(s) — review classification`
            : `${highRisk} high-risk indicator(s) without documentation — add risk-assessment and conformity docs`
    };
};
