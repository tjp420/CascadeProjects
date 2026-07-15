'use strict';

jest.mock('../lib/assessment-retention.cjs', () => ({
  startAssessmentRetentionJob: jest.fn(),
  resolveAssessmentTtlMs: jest.fn().mockReturnValue(86400000)
}));
jest.mock('../lib/path-safety.cjs', () => ({
  validateRepoUrl: jest.fn().mockReturnValue({ ok: true }),
  resolveDefaultAllowedRoots: jest.fn().mockReturnValue([]),
  assertSafeProjectPath: jest.fn()
}));

jest.mock('../lib/simplebeacon-proxy.cjs', () => ({
  buildAssessmentReport: jest.fn(),
  evaluateGate: jest.fn().mockReturnValue({ pass: true }),
  formatJsonReport: jest.fn().mockReturnValue({ summary: {} }),
  loadSimplebeaconConfig: jest.fn().mockReturnValue({ gate: {} }),
  resolvePlatformRoot: jest.fn().mockReturnValue({ platformRoot: '/test' }),
  runScan: jest.fn().mockResolvedValue({ rawIssues: [] }),
  sanitizeScanReport: jest.fn().mockImplementation((r) => r)
}));

const AssessmentController = require('../api/assessment/AssessmentController.cjs');

describe('server/api/assessment/AssessmentController', () => {
  test('exports an instance', () => {
    expect(AssessmentController).toBeDefined();
    expect(typeof AssessmentController.createAssessment).toBe('function');
    expect(typeof AssessmentController.getAssessment).toBe('function');
    expect(typeof AssessmentController.downloadAssessment).toBe('function');
    expect(typeof AssessmentController.triggerScan).toBe('function');
    expect(typeof AssessmentController.getReport).toBe('function');
    expect(typeof AssessmentController.downloadReport).toBe('function');
  });

  test('resolveAssessmentId extracts id from params', () => {
    const id = AssessmentController.resolveAssessmentId({ params: { id: 'test-id' } });
    expect(id).toBe('test-id');
  });

  test('resolveAssessmentId extracts assessmentId from params', () => {
    const id = AssessmentController.resolveAssessmentId({ params: { assessmentId: 'other-id' } });
    expect(id).toBe('other-id');
  });

  test('createAssessment returns 400 when no repoUrl and unauthenticated', async () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await AssessmentController.createAssessment({ body: {}, user: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createAssessment returns 403 for unauthenticated user with projectPath', async () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await AssessmentController.createAssessment({ body: { projectPath: '/test' }, user: {} }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('triggerScan delegates to createAssessment', async () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await AssessmentController.triggerScan({ body: {}, user: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
