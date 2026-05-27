const express = require('express');
const setupSimplebeaconAPI = require('../../src/api/simplebeacon-api');

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

describe('AI validation API aliases', () => {
  test('GET /api/ai-validation/dashboard returns dashboard data', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/ai-validation/dashboard');
      expect(body.scanStatus).toBeDefined();
      expect(body.trends).toBeDefined();
      expect(body.baselineStatus).toBeDefined();
      expect(body.fictionCatalog.length).toBeGreaterThan(0);
    });
  });

  test('GET /api/simplebeacon/dashboard matches ai-validation dashboard', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const [simplebeacon, aiValidation] = await Promise.all([
        getJson(baseUrl, '/api/simplebeacon/dashboard'),
        getJson(baseUrl, '/api/ai-validation/dashboard')
      ]);
      expect(simplebeacon.scanStatus.qualityScore).toBe(aiValidation.scanStatus.qualityScore);
      expect(simplebeacon.fictionCatalog.length).toBe(aiValidation.fictionCatalog.length);
    });
  });

  test('GET /api/ai-validation/results/latest returns scan results', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/ai-validation/results/latest');
      expect(body.status).toBe('completed');
      expect(body.results).toBeDefined();
      expect(typeof body.results.fictionalPatternsFound).toBe('number');
      expect(Array.isArray(body.results.knownPatterns)).toBe(true);
    });
  });

  test('GET /api/simplebeacon/results/latest returns scan results', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/simplebeacon/results/latest');
      expect(body.results.qualityScore).toBeGreaterThanOrEqual(0);
    });
  });

  test('GET /api/simplebeacon/audit returns all audit layers', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/simplebeacon/audit');
      expect(body.type).toBe('simplebeacon-audit-report');
      expect(body.auditLayers.credentials).toBeDefined();
      expect(body.auditLayers.fictionKpis).toBeDefined();
      expect(body.auditLayers.schema).toBeDefined();
      expect(body.auditLayers.productionLeaks).toBeDefined();
      expect(body.fictionCatalog.length).toBeGreaterThan(0);
    });
  });

  test('GET /api/ai-validation/audit matches simplebeacon audit', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const [a, b] = await Promise.all([
        getJson(baseUrl, '/api/simplebeacon/audit'),
        getJson(baseUrl, '/api/ai-validation/audit')
      ]);
      expect(a.auditLayers.gate.pass).toBe(b.auditLayers.gate.pass);
    });
  });

  test('GET /api/simplebeacon/assessment returns assessment report', async () => {
    await withSimplebeaconServer(async (baseUrl) => {
      const body = await getJson(baseUrl, '/api/simplebeacon/assessment');
      expect(body.type).toBe('simplebeacon-assessment-report');
      expect(body.executiveSummary).toBeDefined();
    });
  });
});
