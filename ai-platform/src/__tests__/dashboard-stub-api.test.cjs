'use strict';

jest.mock('../../server/lib/npm-audit-runner.cjs', () => ({ runNpmAuditAsync: jest.fn() }));
jest.mock('../../server/lib/repository-health-payload.cjs', () => ({
  saveConsolidationReport: jest.fn(),
}));
jest.mock('../../server/lib/file-merger-reduction-scanner.cjs', () => ({
  scanFileMergerReduction: jest.fn(),
}));
jest.mock('../../server/lib/path-safety.cjs', () => ({
  resolveDefaultAllowedRoots: jest.fn().mockReturnValue([]),
  assertSafeProjectPath: jest.fn(),
}));
jest.mock('../../server/lib/coverage-reports-builder.cjs', () => ({
  buildCoverageReportsModel: jest.fn(),
}));
jest.mock('../../server/lib/analytics-builder.cjs', () => ({ buildAnalyticsModel: jest.fn() }));
jest.mock('../../server/lib/istanbul-telemetry-merge.cjs', () => ({
  mergeIstanbulTelemetry: jest.fn(),
}));
jest.mock('../../server/lib/security-dashboard-builder.cjs', () => ({
  buildSecurityDashboardModel: jest.fn(),
}));
jest.mock('../../server/lib/dashboard-home-builder.cjs', () => ({
  buildDashboardHomeModel: jest.fn(),
}));
jest.mock('../lib/app-logger.cjs', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const setupDashboardStubAPIs = require('../api/dashboard-stub-api.cjs');

describe('dashboard-stub-api', () => {
  test('exports setupDashboardStubAPIs function', () => {
    expect(typeof setupDashboardStubAPIs).toBe('function');
  });

  test('setupDashboardStubAPIs registers routes on app', () => {
    const app = { use: jest.fn() };
    setupDashboardStubAPIs(app, { webRoot: '/test' });
    expect(app.use).toHaveBeenCalled();
  });
});
