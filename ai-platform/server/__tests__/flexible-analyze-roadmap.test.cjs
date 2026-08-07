'use strict';

// Ensure tests run under a generous memory ceiling when executed inside Jest.
// Jest's runner adds RSS/heap overhead and can trip the module's memory guard;
// set a safe default here so the suite is self-contained.
process.env.ROADMAP_MEMORY_LIMIT_MB = process.env.ROADMAP_MEMORY_LIMIT_MB || '1024';

jest.mock('../lib/flexible-analyze-utils.cjs', () => ({
  normalizeStringList: jest.fn().mockReturnValue([]),
  safeBasename: jest.fn().mockReturnValue('project')
}));
jest.mock('../lib/strategic-insights-engine.cjs', () => ({
  analyzeStrategicInsights: jest.fn()
}));
jest.mock('../lib/roadmap-history-metrics.cjs', () => ({
  buildHistoryEntryFromRoadmap: jest.fn().mockReturnValue({ id: 'test-entry' })
}));

const { buildRoadmapFromPath } = require('../routes/lib/flexible-analyze-roadmap.cjs');

describe('server/routes/lib/flexible-analyze-roadmap', () => {
  test('exports buildRoadmapFromPath function', () => {
    expect(typeof buildRoadmapFromPath).toBe('function');
  });

  test('buildRoadmapFromPath throws TypeError for null input', async () => {
    await expect(buildRoadmapFromPath(null)).rejects.toThrow(TypeError);
  });

  test('buildRoadmapFromPath throws TypeError for non-string input', async () => {
    await expect(buildRoadmapFromPath(123)).rejects.toThrow(TypeError);
  });

  test('buildRoadmapFromPath throws for nonexistent path', async () => {
    await expect(buildRoadmapFromPath('/nonexistent/path/xyz')).rejects.toThrow('does not exist');
  });

  test('buildRoadmapFromPath throws for file path (not directory)', async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const tmpFile = path.join(os.tmpdir(), `roadmap-test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, 'test');
    try {
      await expect(buildRoadmapFromPath(tmpFile)).rejects.toThrow('must be an existing directory');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
