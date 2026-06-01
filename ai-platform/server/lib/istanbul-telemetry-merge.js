/**
 * Merge live Jest Istanbul totals into dashboard samples when coverage-summary exists.
 */

const { loadJestCoverageSummary } = require('./jest-coverage-reader');

function isOpenIstanbulAlert(alert) {
    const text = `${alert?.title || ''} ${alert?.message || ''} ${alert?.type || ''}`.toLowerCase();
    if (!text.includes('istanbul')) return false;
    if (alert?.resolved === true || alert?.status === 'resolved') return false;
    return alert?.resolved === false || alert?.status === 'open' || alert?.status == null;
}

function mergeIstanbulTelemetry(sample = {}, baseDir, options = {}) {
    const istanbul = loadJestCoverageSummary(baseDir, options);
    if (!istanbul.available || !istanbul.totals) {
        return { ...sample };
    }

    const line = istanbul.totals.lines;
    const branch = istanbul.totals.branches;
    const date = (istanbul.generatedAt || new Date().toISOString()).slice(0, 10);
    const message = `Line ${line}% / branch ${branch}% — dashboard-ci.yml runs npm run test:coverage`;

    const alerts = (sample.alerts || []).filter((alert) => !isOpenIstanbulAlert(alert));
    const hasResolvedIstanbul = alerts.some((alert) =>
        String(alert.title || alert.message || '').toLowerCase().includes('istanbul collected')
    );
    if (!hasResolvedIstanbul) {
        alerts.unshift({
            severity: 'info',
            title: 'Istanbul collected in CI',
            message,
            time: date,
            resolved: true
        });
    }

    const bottlenecks = (sample.bottlenecks || []).filter((item) =>
        !/istanbul not collected/i.test(String(item.title || item.impact || ''))
    );

    const insights = (sample.insights || []).filter((item) =>
        !/enable istanbul/i.test(String(item.title || ''))
    );

    const businessIntelligence = (sample.businessIntelligence || []).map((item) =>
        item.title === 'Jest Health'
            ? {
                ...item,
                description: `${line}% Istanbul line in CI — default npm test uses --no-coverage`
            }
            : item
    );

    const performance = {
        ...(sample.performance || {}),
        lineCoverage: line,
        branchCoverage: branch,
        testCoverage: line,
        coverageCollection: 'istanbul'
    };

    return {
        ...sample,
        alerts,
        bottlenecks,
        insights,
        businessIntelligence,
        performance
    };
}

module.exports = {
    mergeIstanbulTelemetry,
    isOpenIstanbulAlert
};
