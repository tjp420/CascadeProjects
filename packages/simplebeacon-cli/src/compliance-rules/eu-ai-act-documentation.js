module.exports = function evaluateEuAiActDocumentation(rule, { report }) {
    const summary = report.euAiActSummary;
    if (report.euAiActScanned == null && !summary) {
        return { id: rule.id, title: rule.title, category: rule.category, severity: rule.severity, remediation: rule.remediation || null, status: 'skip', evidence: 'EU AI Act scan not run — enable eu-ai-act-patterns rule' };
    }
    const aiHits = (summary?.aiSystemIndicators ?? 0) + (summary?.highRiskIndicators ?? 0);
    const docs = summary?.documentationArtifacts ?? 0;
    if (aiHits === 0) {
        return { id: rule.id, title: rule.title, category: rule.category, severity: rule.severity, remediation: rule.remediation || null, status: 'pass', evidence: 'No AI system indicators — documentation not required by scan' };
    }
    const ok = docs >= 2;
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: ok ? 'pass' : 'fail',
        evidence: ok
            ? `${docs} documentation artifact(s) found for ${aiHits} AI indicator(s)`
            : `${aiHits} AI indicator(s) but only ${docs} doc artifact(s) — add model-card and technical documentation`
    };
};
