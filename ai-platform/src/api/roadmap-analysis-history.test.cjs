'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  HISTORY_KEY,
  MAX_ENTRIES,
  loadRoadmapHistoryFromDb,
  appendHistoryEntry,
  clearHistory,
  setupRoadmapAnalysisHistoryRoutes,
} = require('./roadmap-analysis-history.cjs');

function mockDb(rows) {
  return {
    query: async (sql, params) => {
      if (params && params[0] === HISTORY_KEY) {
        return { rows: rows || [] };
      }
      return { rows: [] };
    },
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.jsonBody = body;
      return this;
    },
  };
  return res;
}

function mockApp() {
  const routes = {};
  return {
    get(path, handler) {
      routes[`GET ${path}`] = handler;
    },
    post(path, handler) {
      routes[`POST ${path}`] = handler;
    },
    delete(path, handler) {
      routes[`DELETE ${path}`] = handler;
    },
    routes,
  };
}

describe('roadmap-analysis-history', () => {
  it('exports expected constants and functions', () => {
    assert.strictEqual(typeof HISTORY_KEY, 'string');
    assert.strictEqual(MAX_ENTRIES, 25);
    assert.strictEqual(typeof loadRoadmapHistoryFromDb, 'function');
    assert.strictEqual(typeof appendHistoryEntry, 'function');
    assert.strictEqual(typeof clearHistory, 'function');
    assert.strictEqual(typeof setupRoadmapAnalysisHistoryRoutes, 'function');
  });

  it('loadRoadmapHistoryFromDb returns empty entries when db is missing', async () => {
    const result = await loadRoadmapHistoryFromDb(null);
    assert.deepStrictEqual(result, { entries: [] });
  });

  it('loadRoadmapHistoryFromDb returns stored entries', async () => {
    const db = mockDb([{ payload: { entries: [{ id: '1', projectPath: '/p' }] } }]);
    const result = await loadRoadmapHistoryFromDb(db);
    assert.strictEqual(result.entries.length, 1);
    assert.strictEqual(result.entries[0].id, '1');
  });

  it('loadRoadmapHistoryFromDb returns empty entries for non-object payload', async () => {
    const db = mockDb([{ payload: 'invalid' }]);
    const result = await loadRoadmapHistoryFromDb(db);
    assert.deepStrictEqual(result, { entries: [] });
  });

  it('appendHistoryEntry prepends entry and enforces MAX_ENTRIES', async () => {
    let stored = { entries: [] };
    const db = {
      query: async (sql, params) => {
        if (params[0] === HISTORY_KEY) {
          if (sql.toLowerCase().includes('select')) {
            return { rows: [{ payload: stored }] };
          }
          stored = JSON.parse(params[1]);
          return { rows: [] };
        }
        return { rows: [] };
      },
    };

    for (let i = 0; i < MAX_ENTRIES + 3; i++) {
      await appendHistoryEntry(db, { id: String(i), projectPath: `/p${i}` });
    }
    const entries = await appendHistoryEntry(db, { id: 'new', projectPath: '/new' });
    assert.strictEqual(entries.length, MAX_ENTRIES);
    assert.strictEqual(entries[0].id, 'new');
  });

  it('clearHistory writes empty entries', async () => {
    let capturedEntries = null;
    const db = {
      query: async (sql, params) => {
        if (params[0] === HISTORY_KEY) {
          capturedEntries = JSON.parse(params[1]).entries;
        }
        return { rows: [] };
      },
    };
    const result = await clearHistory(db);
    assert.deepStrictEqual(result, []);
    assert.deepStrictEqual(capturedEntries, []);
  });

  it('GET /api/dynamic-roadmap/history returns client-only when db is missing', async () => {
    const app = mockApp();
    setupRoadmapAnalysisHistoryRoutes(app);
    const req = { app: { locals: {} } };
    const res = mockRes();
    await app.routes['GET /api/dynamic-roadmap/history'](req, res);
    assert.strictEqual(res.jsonBody.success, true);
    assert.strictEqual(res.jsonBody.source, 'client-only');
  });

  it('POST /api/dynamic-roadmap/history rejects invalid entries', async () => {
    const app = mockApp();
    setupRoadmapAnalysisHistoryRoutes(app);
    const req = { app: { locals: { db: {} } }, body: { entry: { id: '1' } } };
    const res = mockRes();
    await app.routes['POST /api/dynamic-roadmap/history'](req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonBody.success, false);
  });

  it('DELETE /api/dynamic-roadmap/history works without db', async () => {
    const app = mockApp();
    setupRoadmapAnalysisHistoryRoutes(app);
    const req = { app: { locals: {} } };
    const res = mockRes();
    await app.routes['DELETE /api/dynamic-roadmap/history'](req, res);
    assert.strictEqual(res.jsonBody.success, true);
    assert.strictEqual(res.jsonBody.cleared, false);
  });
});
