const express = require('express');
const request = require('supertest');

// Mock authorize middleware and agentic store before loading the router
jest.mock('../../../server/middleware/authorize.cjs', () => {
  return {
    authorize: (requiredPermission) => (req, res, next) => {
      if (!req.user) return res.status(401).json({ success: false, error: 'authentication_required' });
      const role = req.user.role || 'viewer';
      if (role === 'admin') return next();
      if (role === 'operator') {
        if (req.path && req.path.indexOf('/execute') !== -1) return next();
        return res.status(403).json({ success: false, error: 'insufficient_permissions' });
      }
      return res.status(403).json({ success: false, error: 'insufficient_permissions' });
    },
    authorizeAny: () => (req, res, next) => { if (!req.user) return res.status(401).json({ success: false, error: 'authentication_required' }); return next(); },
    enforceOrgPartition: () => (req, res, next) => {
      if (!req.user) return res.status(401).json({ success: false, error: 'authentication_required' });
      const callerOrg = req.user.orgId || req.user.org || 'default';
      const clientOrg = req.body?.orgId || req.query?.orgId || req.params?.orgId || null;
      if (!clientOrg || clientOrg === callerOrg) { req.resolvedOrgId = callerOrg; return next(); }
      return res.status(403).json({ success: false, error: 'org_partition_violation' });
    },
  };
});

jest.mock('../../../server/lib/agentic-orchestration-store.cjs', () => ({
  getStats: () => ({ total: 0 }),
  getAllAgents: () => [],
  createAgent: (id, body, orgId) => {
    if (!body || !body.id) return { success: false, error: 'missing id' };
    return { success: true, id: body.id };
  },
  getAgent: (id, orgId) => {
    if (id === 'agent-beta-1') return { id, orgId: 'org-beta', config: {} };
    if (id === 'agent-a1') return { id, orgId: 'org-alpha', config: {} };
    return null;
  },
  deleteAgent: (id, orgId) => {
    if (id === 'agent-beta-1') return { success: false, error: 'agent_not_found' };
    return { success: true };
  },
  // executeAgentLoop will call the inferenceFn passed from the router to exercise the lazy-loaded provider
  executeAgentLoop: async (id, orgId, input, inferenceFn, options) => {
    if (typeof inferenceFn === 'function') {
      try {
        const inf = await inferenceFn(input || 'test', { provider: 'mock', model: 'mock' });
        return { success: true, id, output: inf.text || '', usage: inf.usage || null };
      } catch (e) {
        return { success: false, error: e && e.message };
      }
    }
    return { success: true, id, output: 'executed' };
  },
  getActiveExecutions: () => [],
  getExecutionHistory: () => [],
  listTools: () => [],
}));

// Mock the cloud inference service used by the route's lazy loader
jest.mock('../../../server/services/cloud-inference-service.cjs', () => ({
  generateWithProvider: async (provider, prompt, opts) => {
    return { text: `mocked:${prompt}`, usage: { total_tokens: 5 } };
  }
}));

// Mock audit logger so we can assert calls on quota/rate-limit
jest.mock('../../../server/lib/audit-logger.cjs', () => ({
  logEvent: jest.fn(),
}));

function buildApp() {
  // Ensure a fresh router module (clears in-memory rate windows between tests)
  const routerPath = require.resolve('../../../server/routes/agentic-orchestration-routes.cjs');
  delete require.cache[routerPath];
  const router = require(routerPath);
  const auth = require('../../../server/middleware/authorize.cjs');
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const h = req.headers['x-test-user'];
    if (h) {
      try { req.user = JSON.parse(h); } catch { req.user = { id: h, role: 'viewer' }; }
    }
    next();
  });

  app.use('/api/agentic', auth.enforceOrgPartition(), router);
  return request(app);
}

describe('agentic-orchestration routes (Jest mirror)', () => {
  test('router module loads', () => {
    const router = require('../../../server/routes/agentic-orchestration-routes.cjs');
    expect(router).toBeDefined();
  });

  test('rejects unauthenticated POST /agents with 401', async () => {
    await buildApp().post('/api/agentic/agents').send({ id: 'agent-1' }).expect(401).then((res) => {
      expect(res.body.error).toBe('authentication_required');
    });
  });

  test('rejects viewer role POST /agents with 403', async () => {
    await buildApp().post('/api/agentic/agents').set('x-test-user', JSON.stringify({ id: 'u1', role: 'viewer' })).send({ id: 'agent-2' }).expect(403).then((res) => {
      expect(res.body.error).toBe('insufficient_permissions');
    });
  });

  test('admin create without id returns 409', async () => {
    await buildApp().post('/api/agentic/agents').set('x-test-user', JSON.stringify({ id: 'admin1', role: 'admin' })).send({ name: 'no-id' }).expect(409).then((res) => {
      expect(res.body.error).toBe('agent_create_failed');
    });
  });

  test('admin can create agent when id present', async () => {
    await buildApp().post('/api/agentic/agents').set('x-test-user', JSON.stringify({ id: 'admin1', role: 'admin' })).send({ id: 'agent-9', name: 'ok' }).expect(200).then((res) => {
      expect(res.body.id).toBe('agent-9');
    });
  });

  test('blocks admin from deleting agent in another org (partition enforcement)', async () => {
    await buildApp().delete('/api/agentic/agents/agent-beta-1?orgId=org-beta').set('x-test-user', JSON.stringify({ id: 'adminA', role: 'admin', orgId: 'org-alpha' })).expect(403).then((res) => {
      expect(res.body.error).toBe('org_partition_violation');
    });
  });

  test('operator cannot create agent but can execute in same org', async () => {
    await buildApp().post('/api/agentic/agents').set('x-test-user', JSON.stringify({ id: 'op1', role: 'operator', orgId: 'org-alpha' })).send({ id: 'agent-op-1' }).expect(403);

    await buildApp().post('/api/agentic/agents/agent-a1/execute').set('x-test-user', JSON.stringify({ id: 'op1', role: 'operator', orgId: 'org-alpha' })).send({ input: 'run' }).expect(200).then((res) => {
      expect(res.body.success).toBe(true);
    });
  });

  test('enforces rate limit for repeated execute triggers', async () => {
    const app = buildApp();
    const hdr = { 'x-test-user': JSON.stringify({ id: 'op1', role: 'operator', orgId: 'org-alpha' }) };
    // Attempt up to 5 times; expect to observe a 429 within that window
    let saw429 = false;
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await app.post('/api/agentic/agents/agent-a1/execute').set(hdr).send({ input: 'run' });
      if (res.status === 429) { saw429 = true; break; }
    }
    expect(saw429).toBe(true);
    // Assert audit logger called
    const audit = require('../../../server/lib/audit-logger.cjs');
    expect(audit.logEvent).toHaveBeenCalled();
  });
});
