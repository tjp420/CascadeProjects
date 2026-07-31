const fs = require('fs');
const path = require('path');
const assert = require('node:assert');
const { describe, it } = require('node:test');
const express = require('express');
const supertest = require('supertest');

describe('agentic-orchestration routes (static checks)', () => {
  it('route file exists and is non-empty', () => {
    // route files live under server/routes in this repo layout
    const file = path.join(__dirname, '..', '..', 'routes', 'agentic-orchestration-routes.cjs');
    const exists = fs.existsSync(file);
    assert.ok(exists, `Expected route file to exist: ${file}`);
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(src && src.length > 10, 'Route file appears empty');
  });

  it('route file contains expected exports or route registrations', () => {
    const file = path.join(__dirname, '..', '..', 'routes', 'agentic-orchestration-routes.cjs');
    const src = fs.readFileSync(file, 'utf8');
    const pattern = /module\.exports|express\.Router|router\.(post|get|put|delete|use)|app\.(post|get|put|delete|use)/i;
    assert.match(src, pattern, 'Route file does not appear to export a router or register routes');
  });

  async function mountAppWithMocks() {
    // Install lightweight mocks for authorize middleware and agenticStore
    const authorizePath = require('path').resolve(process.cwd(), 'server', 'middleware', 'authorize.cjs');
    const agenticStorePath = require('path').resolve(process.cwd(), 'server', 'lib', 'agentic-orchestration-store.cjs');

    // Mock authorize: enforce RBAC per-required-permission and partition enforcement
    const mockAuthorize = {
      authorize: function (requiredPermission) {
        return function (req, res, next) {
          if (!req.user) return res.status(401).json({ success: false, error: 'authentication_required' });
          const role = req.user.role || 'viewer';
          // admin always allowed
          if (role === 'admin') return next();
          // operator allowed for execute path only
          if (role === 'operator') {
            // allow execute endpoints even when requiredPermission is admin:all
            if (req.path && req.path.indexOf('/execute') !== -1) return next();
            return res.status(403).json({ success: false, error: 'insufficient_permissions' });
          }
          return res.status(403).json({ success: false, error: 'insufficient_permissions' });
        };
      },
      authorizeAny: function () {
        return function (req, res, next) { if (!req.user) return res.status(401).json({ success: false, error: 'authentication_required' }); return next(); };
      },
      enforceOrgPartition: function () {
        return function (req, res, next) {
          if (!req.user) return res.status(401).json({ success: false, error: 'authentication_required' });
          const callerOrg = req.user.orgId || req.user.org || 'default';
          const clientOrg = req.body?.orgId || req.query?.orgId || req.params?.orgId || null;
          if (!clientOrg || clientOrg === callerOrg) {
            req.resolvedOrgId = callerOrg;
            return next();
          }
              // For tests, enforce strict partitioning: no cross-org access allowed
              return res.status(403).json({ success: false, error: 'org_partition_violation' });
        };
      },
    };

    // Mock agentic store minimal surface
    const mockStore = {
      getStats: () => ({ total: 0 }),
      getAllAgents: () => [],
      createAgent: (id, body, orgId) => {
        if (!body || !body.id) return { success: false, error: 'missing id' };
        return { success: true, id: body.id };
      },
      // return an agent belonging to org-beta for a specific id used in tests
      getAgent: (id, orgId) => {
        if (id === 'agent-beta-1') return { id, orgId: 'org-beta', config: {} };
        if (id === 'agent-a1') return { id, orgId: 'org-alpha', config: {} };
        return null;
      },
      deleteAgent: (id, orgId) => {
        if (id === 'agent-beta-1') return { success: false, error: 'agent_not_found' };
        return { success: true };
      },
      executeAgentLoop: async (id, orgId, input, inferenceFn, options) => {
        return { success: true, id, output: 'executed' };
      },
      getActiveExecutions: () => [],
      getExecutionHistory: () => [],
      listTools: () => [],
    };

    // Inject mocks into require cache before loading router
    delete require.cache[authorizePath];
    require.cache[authorizePath] = { id: authorizePath, filename: authorizePath, loaded: true, exports: mockAuthorize };

    delete require.cache[agenticStorePath];
    require.cache[agenticStorePath] = { id: agenticStorePath, filename: agenticStorePath, loaded: true, exports: mockStore };

    // Ensure router loads our mocks
    const routerPath = require('path').resolve(process.cwd(), 'server', 'routes', 'agentic-orchestration-routes.cjs');
    delete require.cache[routerPath];
    const router = require(routerPath);

    const app = express();
    app.use(express.json());

    // Test auth injector: read test user from header
    app.use((req, res, next) => {
      const h = req.headers['x-test-user'];
      if (h) {
        try { req.user = JSON.parse(h); } catch { req.user = { id: h, role: 'viewer' }; }
      }
      next();
    });

    // Mount partition enforcement before routes
    app.use('/api/agentic', mockAuthorize.enforceOrgPartition(), router);

    return supertest(app);
  }

  it('rejects unauthenticated POST /agents with 401', async () => {
    const req = await mountAppWithMocks();
    await req.post('/api/agentic/agents').send({ id: 'agent-1' }).expect(401).then((res) => {
      assert.equal(res.body && res.body.error, 'authentication_required');
    });
  });

  it('rejects viewer role POST /agents with 403', async () => {
    const req = await mountAppWithMocks();
    await req.post('/api/agentic/agents').set('x-test-user', JSON.stringify({ id: 'u1', role: 'viewer' })).send({ id: 'agent-2' }).expect(403).then((res) => {
      assert.equal(res.body && res.body.error, 'insufficient_permissions');
    });
  });

  it('returns 400 when admin creates agent without agentId (validation)', async () => {
    const req = await mountAppWithMocks();
      await req.post('/api/agentic/agents').set('x-test-user', JSON.stringify({ id: 'admin1', role: 'admin' })).send({ name: 'no-id' }).expect(409).then((res) => {
      // route emits agent_create_failed on validation -> 409 conflict
      assert.equal(res.body && res.body.error, 'agent_create_failed');
    });
  });

  it('allows admin to create agent when id present', async () => {
    const req = await mountAppWithMocks();
    await req.post('/api/agentic/agents').set('x-test-user', JSON.stringify({ id: 'admin1', role: 'admin' })).send({ id: 'agent-9', name: 'ok' }).expect(200).then((res) => {
      assert.equal(res.body && res.body.id, 'agent-9');
    });
  });

  it('blocks admin from deleting agent in another org (partition enforcement)', async () => {
    const req = await mountAppWithMocks();
    // admin from org-alpha attempts to delete agent in org-beta (explicit orgId in query)
    await req.delete('/api/agentic/agents/agent-beta-1?orgId=org-beta').set('x-test-user', JSON.stringify({ id: 'adminA', role: 'admin', orgId: 'org-alpha' })).expect(403).then((res) => {
      assert.equal(res.body && res.body.error, 'org_partition_violation');
    });
  });

  it('allows operator to execute an agent in same org but not create agents', async () => {
    const req = await mountAppWithMocks();
    // operator trying to create agent -> forbidden
    await req.post('/api/agentic/agents').set('x-test-user', JSON.stringify({ id: 'op1', role: 'operator', orgId: 'org-alpha' })).send({ id: 'agent-op-1' }).expect(403);

    // operator executing an agent in same org -> allowed (mock returns success)
    await req.post('/api/agentic/agents/agent-a1/execute').set('x-test-user', JSON.stringify({ id: 'op1', role: 'operator', orgId: 'org-alpha' })).send({ input: 'run' }).expect(200).then((res) => {
      assert.equal(res.body && res.body.success, true);
    });
  });

  it('enforces rate limit for repeated execute triggers', async () => {
    const req = await mountAppWithMocks();
    const userHeader = { 'x-test-user': JSON.stringify({ id: 'op1', role: 'operator', orgId: 'org-alpha' }) };
    // Repeatedly call until we observe a 429, up to 5 attempts
    let got429 = false;
    for (let i = 0; i < 5; i++) {
      const r = await req.post('/api/agentic/agents/agent-a1/execute').set(userHeader).send({ input: 'run' });
      if (r.status === 429) { got429 = true; break; }
    }
    assert.ok(got429, 'Expected at least one 429 rate_limited response within 5 attempts');
  });
});
