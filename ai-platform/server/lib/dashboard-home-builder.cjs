/**
 * Merge .simplebeacon/baseline.json into dashboard-home sample for live Jest counts.
 */

const { REPOSITORY_AUDIT_BASELINE } = require('./repository-audit-baseline.cjs');

/**
 * Replace jest mentions.
 * @param {string} text
 * @param {any} jestLabel
 * @param {Array} suites
 * @returns {any}
 */
function replaceJestMentions(text, jestLabel, suites) {
    if (!text || !jestLabel) return text;
    const suiteSuffix = suites != null ? ` across ${suites} suites` : '';
    return String(text)
        .replace(/\d+\/\d+ tests pass(?:ing)?(?: across \d+ suites)?/gi, `${jestLabel} tests passing${suiteSuffix}`)
        .replace(/\d+\/\d+ Jest tests passing(?: across \d+ suites)?/gi, `${jestLabel} Jest tests passing${suiteSuffix}`)
        .replace(/\d+\/\d+ Jest(?: tests)?(?: \(?\d+ suites?\)?)?/gi, `${jestLabel} Jest${suites != null ? ` (${suites} suites)` : ''}`)
        .replace(/default npm test runs with --no-coverage\./i, `default npm test runs with --no-coverage (${jestLabel}).`);
}

/**
 * Build dashboard home model.
 * @param {any} sample
 * @returns {any}
 */
function buildDashboardHomeModel(sample = {}) {
    const baseline = REPOSITORY_AUDIT_BASELINE;
    const jestPassing = baseline?.jestTestsPassing;
    const jestLabel = baseline?.jestTestsLabel;
    const suites = baseline?.jestSuites;

    if (!jestPassing || !jestLabel) {
        return { ...sample };
    }

    const overview = {
        ...(sample.overview || {}),
        totalTests: jestPassing,
        passedTests: jestPassing,
        testSuites: suites ?? sample.overview?.testSuites,
        notes: replaceJestMentions(sample.overview?.notes, jestLabel, suites)
    };

/**
 * Comparative analysis.
 * @param {any} sample.comparativeAnalysis || []
 * @returns {any}
 */
    const comparativeAnalysis = (sample.comparativeAnalysis || []).map((row) => {
        if (String(row.metric || '').toLowerCase() !== 'jest tests') {
            return row;
        }
        const previous = row.previous;
        const prevNum = Number(String(previous).replace(/[^\d.-]/g, ''));
        const change = Number.isFinite(prevNum) && prevNum !== jestPassing
            ? `${jestPassing > prevNum ? '+' : ''}${jestPassing - prevNum} tests`
            : row.change;
        return { ...row, current: jestPassing, change };
    });

/**
 * Insights.
 * @param {any} sample.insights || []
 * @returns {any}
 */
    const insights = (sample.insights || []).map((item) => ({
        ...item,
        description: replaceJestMentions(item.description, jestLabel, suites)
    }));

/**
 * Kpis.
 * @param {any} sample.kpis || []
 * @returns {any}
 */
    const kpis = (sample.kpis || []).map((item) => (
        String(item.name || '').toLowerCase().includes('jest')
            ? { ...item, current: jestLabel, target: jestLabel }
            : item
    ));

    const healthSummary = sample.healthSummary
        ? {
            ...sample.healthSummary,
            highlights: (sample.healthSummary.highlights || []).map((line) =>
                replaceJestMentions(line, jestLabel, suites)
            )
        }
        : sample.healthSummary;

    return {
        ...sample,
        overview,
        comparativeAnalysis,
        insights,
        kpis,
        healthSummary,
        baselineSyncedAt: baseline.syncedAt || null
    };
}

module.exports = {
    buildDashboardHomeModel,
    replaceJestMentions
};
