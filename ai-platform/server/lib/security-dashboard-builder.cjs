/**
 * Merge repository-audit security checklist with live npm audit results.
 */

const { runNpmAuditAsync } = require('./npm-audit-runner.cjs');

function isNpmAuditFinding(item) {
    return item?.source === 'npm-audit';
}

function isOpenFinding(item) {
    return item?.status !== 'resolved';
}

function buildOverviewFromVulnerabilities(raw) {
    const threats = raw.threats || [];
    const vulnerabilities = raw.vulnerabilities || [];
    const incidents = raw.incidents || [];
    const compliance = raw.compliance || {};
    const openFindings = vulnerabilities.filter(isOpenFinding);
    const openEngineeringFindings = openFindings.filter((item) => !isNpmAuditFinding(item));
    const openNpmFindings = openFindings.filter(isNpmAuditFinding);
    const npmSummaryTotal = raw.npmAudit?.summary?.total;
    const npmAuditTotal = npmSummaryTotal != null ? npmSummaryTotal : openNpmFindings.length;
    const criticalVulns = openNpmFindings.filter((item) => item.severity === 'critical').length;

    return {
        activeThreats: threats.length,
        criticalVulnerabilities: criticalVulns,
        openVulnerabilities: npmAuditTotal,
        openEngineeringFindings: openEngineeringFindings.length,
        securityScore: raw.overview?.securityScore ?? compliance.overall ?? 0,
        complianceRate: raw.overview?.complianceRate ?? compliance.overall ?? 0,
        totalIncidents: incidents.length,
        resolvedIncidents: incidents.filter((item) => item.status === 'resolved').length,
        npmAuditTotal
    };
}

function mergeNpmAuditIntoSecurityModel(model, auditPayload) {
    if (!model || !auditPayload || auditPayload.error) {
        return { ...model, overview: buildOverviewFromVulnerabilities(model || {}) };
    }

    const checklist = (model.vulnerabilities || []).filter((item) => item.source !== 'npm-audit');
    const updatedChecklist = checklist.map((item) => (
        item.id === 'SEC-004'
            ? {
                ...item,
                status: 'resolved',
                title: 'Dependency audit wired to Security page (npm audit)'
            }
            : item
    ));
    const npmVulns = auditPayload.vulnerabilities || [];
    const mergedVulnerabilities = [...updatedChecklist, ...npmVulns];

    const insights = (model.insights || []).filter((item) =>
        !String(item.title || '').match(/Run npm audit separately/i)
    );
    const summary = auditPayload.summary || auditPayload.metadata || {};
    if (summary.total != null) {
        const hasAuditInsight = insights.some((item) =>
            String(item.title || '').startsWith('npm audit:')
        );
        if (!hasAuditInsight) {
            insights.push({
                priority: summary.critical ? 'high' : summary.high ? 'medium' : 'low',
                title: `npm audit: ${summary.total} dependency ${summary.total === 1 ? 'issue' : 'issues'}`,
                description: `Live npm audit — critical ${summary.critical || 0}, high ${summary.high || 0}, moderate ${summary.moderate || 0}, low ${summary.low || 0}.`,
                impact: 'Measured dependency posture'
            });
        }
    }

    const merged = {
        ...model,
        vulnerabilities: mergedVulnerabilities,
        insights,
        npmAudit: {
            generatedAt: auditPayload.generatedAt || new Date().toISOString(),
            summary,
            error: auditPayload.error || null
        }
    };
    merged.overview = buildOverviewFromVulnerabilities(merged);
    return merged;
}

async function buildSecurityDashboardModel(baseDir, sample = {}, options = {}) {
    const audit = await runNpmAuditAsync(baseDir, options);
    return mergeNpmAuditIntoSecurityModel(
        {
            ...sample,
            type: sample.type || 'security-dashboard-model',
            dataSource: sample.dataSource || 'repository-audit'
        },
        audit
    );
}

module.exports = {
    buildOverviewFromVulnerabilities,
    mergeNpmAuditIntoSecurityModel,
    buildSecurityDashboardModel
};
