const express = require('express');
const setupSimplebeaconAPI = require('../../src/api/simplebeacon-api');
const { REPOSITORY_AUDIT_BASELINE } = require('../../server/lib/repository-audit-baseline');

async function withSimplebeaconServer(fn) {
  const app = express();
  app.use(express.json());
  setupSimplebeaconAPI(app);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function getJson(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`);
  expect(response.ok).toBe(true);
  return response.json();
}

describe('simplebeacon API', () => {
  test('GET /api/simplebeacon/report returns simplebeacon-report', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/simplebeacon/report');
      expect(body.type).toBe('simplebeacon-report');
      expect(body.generatedBy).toBe('Simplebeacon');
    });
  });

  test('GET /api/simplebeacon/baseline returns jest baseline', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/simplebeacon/baseline');
      expect(body.jestTestsLabel).toBeDefined();
    });
  });

  test('GET /api/simplebeacon/config returns a supported profile', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/simplebeacon/config');
      expect(['minimal', 'standard', 'cascade']).toContain(body.profile);
      expect(Array.isArray(body.scanPaths)).toBe(true);
    });
  });

  test('GET /api/simplebeacon/history returns trend array', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/simplebeacon/history');
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });
  });

  test('GET /api/simplebeacon/dashboard returns aggregate payload', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/simplebeacon/dashboard');
      expect(body.type).toBe('simplebeacon-dashboard');
      expect(body.scanStatus.totalScans).toBeGreaterThan(0);
      expect(body.baselineStatus.pageSamplesLabel).toBe(REPOSITORY_AUDIT_BASELINE.pageSamplesLabel);
    });
  });

  test('PUT /api/simplebeacon/config validates and round-trips', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const original = await getJson(baseUrl, '/api/simplebeacon/config');

      const bad = await fetch(`${baseUrl}/api/simplebeacon/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanPaths: 'not-an-array' })
      });
      expect(bad.status).toBe(400);

      const ok = await fetch(`${baseUrl}/api/simplebeacon/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(original)
      });
      expect(ok.ok).toBe(true);
      const saved = await ok.json();
      expect(saved.success).toBe(true);
      expect(saved.config.profile).toBe(original.profile);

      const restored = await getJson(baseUrl, '/api/simplebeacon/config');
      expect(restored.profile).toBe(original.profile);
      expect(restored.scanPaths).toEqual(original.scanPaths);
    });
  });
});
