const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs').promises;
const request = require('supertest');

// Use a dedicated test store path so we don't clobber developer data
const TEST_STORE = path.join(__dirname, 'sso-configs.test.json');
process.env.SSO_CONFIG_PATH = TEST_STORE;
// Run server in development mode for tests so auth middleware injects a dev admin user
process.env.NODE_ENV = 'development';

const app = require('../index.cjs');

describe('SSO Config Routes', () => {
  before(async () => {
    // initialize empty store
    await fs.writeFile(TEST_STORE, JSON.stringify({ configs: [] }, null, 2), 'utf8');
  });

  after(async () => {
    // clean up
    try {
      await fs.unlink(TEST_STORE);
    } catch (e) {
      /* ignore */
    }
  });

  it('should create an OIDC config, list it, test it, update and delete it', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/enterprise/sso/configs')
      .send({
        orgId: 'test-org',
        displayName: 'Test OIDC',
        method: 'oidc',
        providerType: 'auth0',
        domain: 'example.com',
        enabled: true,
        oidc: { clientId: 'cid', clientSecret: 'csecret', issuer: 'https://issuer.example' },
      })
      .expect(201);
    assert.ok(createRes.body.providerId, 'providerId returned');
    const pid = createRes.body.providerId;

    // List all
    const listRes = await request(app).get('/api/enterprise/sso/configs').expect(200);
    assert.ok(Array.isArray(listRes.body.configs));
    assert.ok(listRes.body.configs.find((c) => c.providerId === pid));

    // Test endpoint
    const testRes = await request(app).get(`/api/enterprise/sso/test/${pid}`).expect(200);
    assert.strictEqual(testRes.body.success, true);
    assert.strictEqual(testRes.body.method, 'oidc');

    // Update (toggle enabled)
    const updRes = await request(app)
      .put(`/api/enterprise/sso/configs/${pid}`)
      .send({ enabled: false })
      .expect(200);
    assert.strictEqual(updRes.body.enabled, false);

    // Delete
    await request(app).delete(`/api/enterprise/sso/configs/${pid}`).expect(200);

    // Confirm deleted
    const postDel = await request(app).get('/api/enterprise/sso/configs').expect(200);
    assert.ok(!postDel.body.configs.find((c) => c.providerId === pid));
  });
});
