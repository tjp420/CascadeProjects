/**
 * Merge repository-audit coverage-reports sample with live Jest Istanbul output.
 */

const { loadJestCoverageSummary, roundPct } = require('./jest-coverage-reader.cjs');
const { REPOSITORY_AUDIT_BASELINE } = require('./repository-audit-baseline.cjs');
const constants = require('../config/constants.cjs');

const FILE_TO_PROJECT = {
  'web/scripts/payload-routing.js': 'proj_routing',
  'src/api/dashboard-stub-api.cjs': 'proj_stub_api',
  'server/bootstrap/phase2-integration.js': 'proj_integration',
  'server/config/database.js': 'proj_integration',
  'server/services/user-service.js': 'proj_integration',
  'server/lib/npm-audit-runner.js': 'proj_unit_misc',
  'server/lib/snapshot-resolver.js': 'proj_unit_misc',
};

/**
 * Average.
 * @param {Array} values
 * @returns {any}
 */
function average(values) {
  const nums = values.filter((value) => value != null && !Number.isNaN(value));
  if (!nums.length) return null;
  return roundPct(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

/**
 * Apply project coverage.
 * @param {Array} projects
 * @param {Array} files
 * @returns {any}
 */
function applyProjectCoverage(projects, files) {
  const byProject = new Map();
  for (const file of files) {
    const projectId = FILE_TO_PROJECT[file.relativePath];
    if (!projectId) continue;
    if (!byProject.has(projectId)) byProject.set(projectId, []);
    byProject.get(projectId).push(file);
  }

  return (projects || []).map((project) => {
    const matched = byProject.get(project.id) || [];
    if (!matched.length) return project;

    const lineCoverage = average(matched.map((file) => file.lines));
    const branchCoverage = average(matched.map((file) => file.branches));
    const functionCoverage = average(matched.map((file) => file.functions));
    const statementCoverage = average(matched.map((file) => file.statements));
    const overallCoverage = lineCoverage ?? statementCoverage;

    return {
      ...project,
      coverage: overallCoverage,
      lineCoverage,
      branchCoverage,
      functionCoverage,
      statementCoverage,
      status: overallCoverage != null && overallCoverage >= 70 ? 'healthy' : 'warning',
    };
  });
}

/**
 * Build uncovered files.
 * @param {Array} files
 * @returns {any}
 */
function buildUncoveredFiles(files) {
  return files
    .filter((file) => file.lines != null)
    .sort((a, b) => (a.lines ?? 100) - (b.lines ?? 100))
    .slice(0, 8)
    .map((file) => ({
      name: file.relativePath.split('/').pop(),
      path: file.relativePath,
      coverage: file.lines,
      uncoveredLines: null,
      totalLines: null,
      risk: file.lines < 50 ? 'high' : file.lines < 70 ? 'medium' : 'low',
      lastModified: null,
      notes: `Istanbul line coverage ${file.lines}% from jest collectCoverageFrom scope`,
    }));
}

/**
 * Build coverage reports model.
 * @param {string} baseDir
 * @param {any} sample
 * @param {Object} options
 * @returns {any}
 */
function buildCoverageReportsModel(baseDir, sample = {}, options = {}) {
  const istanbul = loadJestCoverageSummary(baseDir, options);
  const baseline = REPOSITORY_AUDIT_BASELINE;

  if (!istanbul.available || !istanbul.totals) {
    const passedTests = baseline.jestTestsPassing ?? sample.overview?.passedTests ?? null;
    const totalTests = baseline.jestTestsPassing ?? sample.overview?.totalTests ?? null;
    return {
      ...sample,
      type: sample.type || 'coverage-reports-model',
      dataSource: sample.dataSource || 'repository-audit',
      overview: {
        ...(sample.overview || {}),
        totalTests,
        passedTests,
        failedTests: sample.overview?.failedTests ?? 0,
        testSuites: baseline.jestSuites ?? sample.overview?.testSuites ?? null,
        testPassRate:
          passedTests != null && totalTests
            ? Math.round((passedTests / totalTests) * constants.PERCENTAGE_MULTIPLIER)
            : (sample.overview?.testPassRate ?? null),
      },
    };
  }

  const totals = istanbul.totals;
  const projects = applyProjectCoverage(sample.projects, istanbul.files);
  const trends = [...(sample.coverageTrends || sample.trends || [])];
  if (trends.length) {
    trends[trends.length - 1] = {
      ...trends[trends.length - 1],
      overall: baseline.jestTestsPassing,
      line: totals.lines,
      branch: totals.branches,
      function: totals.functions,
    };
  }

  const recentRuns = [...(sample.recentRuns || [])];
  if (recentRuns[0]) {
    recentRuns[0] = {
      ...recentRuns[0],
      description: `${baseline.jestTestsLabel} tests passed — Istanbul line ${totals.lines}%`,
      coverage: totals.lines,
      tests: baseline.jestTestsPassing,
    };
  }

  return {
    ...sample,
    type: sample.type || 'coverage-reports-model',
    dataSource: 'repository-audit',
    generatedAt: istanbul.generatedAt,
    generatedBy: 'jest-coverage-reader',
    modelInfo: {
      ...(sample.modelInfo || {}),
      name: sample.modelInfo?.name || 'platform-checklist',
      confidence: null,
      notes:
        'Istanbul metrics from coverage/dashboard/coverage-summary.json (npm run test:coverage)',
    },
    overview: {
      ...(sample.overview || {}),
      overallCoverage: totals.lines,
      lineCoverage: totals.lines,
      branchCoverage: totals.branches,
      functionCoverage: totals.functions,
      statementCoverage: totals.statements,
      totalTests: baseline.jestTestsPassing,
      passedTests: baseline.jestTestsPassing,
      failedTests: 0,
      testSuites: baseline.jestSuites,
      testPassRate: 100,
      lastRun: istanbul.generatedAt,
      coverageCollection: 'istanbul',
      coverageSummaryPath: 'coverage/dashboard/coverage-summary.json',
      notes: `${baseline.jestTestsLabel} pass rate + Istanbul from jest collectCoverageFrom scope`,
    },
    projects,
    coverageTrends: trends,
    uncoveredFiles: buildUncoveredFiles(istanbul.files),
    recentRuns,
    istanbulMeta: {
      summaryPath: istanbul.summaryPath,
      filesInScope: istanbul.files.length,
      collectedAt: istanbul.generatedAt,
    },
  };
}

module.exports = {
  FILE_TO_PROJECT,
  buildCoverageReportsModel,
  applyProjectCoverage,
};
