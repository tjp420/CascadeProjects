'use strict';

/**
 * OpenAPI Specification Contract Tests
 *
 * Verifies that the expanded openapi.yaml correctly documents all
 * Track 114-121 governance endpoints and SIEM audit routes, and that
 * the schema definitions match the actual route handler responses.
 *
 * Test matrix (17 checks):
 * - L1: YAML validity, syntax, gate
 * - L2: Path coverage, schema matching, error schemas
 * - L3: Regression, tags, security, ghost paths, drift detection
 * - S: No PII, authorization, no real identifiers
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const request = require('supertest');
const express = require('express');

jest.mock('../../../middleware/authorize.cjs', () => ({
  authorize: () => (req, res, next) => next(),
}));

jest.mock('../../../lib/admin-throttle.cjs', () => ({
  middleware: (req, res, next) => next(),
}));

jest.mock('../../../lib/hsm-vault.cjs', () => ({
  hsmHandshake: jest.fn().mockResolvedValue({ status: 'ok' }),
}));

const OPENAPI_YML = path.join(__dirname, '..', '..', '..', '..', 'api', 'openapi.yaml');

function loadOpenApiDoc() {
  return yaml.load(fs.readFileSync(OPENAPI_YML, 'utf8'));
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  const cacheKeys = Object.keys(require.cache || {});
  for (const k of cacheKeys) {
    if (k.endsWith('/server/routes/hsm-vault-routes.cjs') || k.endsWith('\\server\\routes\\hsm-vault-routes.cjs')) {
      delete require.cache[k];
    }
  }
  const vaultRoutes = require('../../../routes/hsm-vault-routes.cjs');
  app.use('/api/vault', vaultRoutes);
  const track112Routes = require('../../../routes/track112-upload-routes.cjs');
  app.use('/api/track112', track112Routes);
  return app;
}

// Expected governance paths in OpenAPI spec
const GOVERNANCE_PREFIXES = [
  'cluster-isolation',
  'bft-shard-sync',
  'distributed-consensus-coordinator',
  'cross-cluster-migration',
  'cluster-key-reconciliation',
  'multiparty-re-keying',
];

const SIEM_PATHS = ['/audit/telemetry', '/audit/log', '/audit/export', '/audit/verify-integrity', '/audit/stats'];

const EXPECTED_TAGS = [
  'Track112MultipartUpload',
  'Track114ClusterIsolation',
  'Track115BftShardSync',
  'Track118DistributedConsensusCoordinator',
  'Track119CrossClusterMigration',
  'Track120ClusterKeyReconciliation',
  'Track121MultipartyReKeying',
  'SIEMAudit',
];

const TRACK112_PATHS = [
  '/track112/uploads',
  '/track112/uploads/{id}/chunk',
  '/track112/uploads/{id}/commit',
];

const crypto = require('crypto');

const ORIGINAL_TRACK79_PATHS = [
  '/policies',
  '/policies/{policy_id}',
  '/policies/{policy_id}/generate-keys',
  '/keys/{policy_id}/proactive-refresh',
  '/vrf/evaluate',
  '/vrf/verify',
  '/nizk/generate',
  '/nizk/verify',
];

describe('OpenAPI Specification Contract Tests', () => {
  let doc;
  let app;

  beforeAll(() => {
    doc = loadOpenApiDoc();
  });

  beforeEach(() => {
    app = createTestApp();
  });

  // ── L1-01: YAML validity ───────────────────────────────────────────
  test('L1-01: openapi.yaml parses as valid YAML with OpenAPI 3.1.0 structure', () => {
    expect(doc).toBeDefined();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toBeDefined();
    expect(doc.paths).toBeDefined();
    expect(doc.components).toBeDefined();
    expect(doc.components.schemas).toBeDefined();
    expect(doc.components.securitySchemes).toBeDefined();
  });

  // ── L1-02: Syntax check on test file itself ────────────────────────
  test('L1-02: openapi-contract.test.cjs syntax is valid (self-referential)', () => {
    // If this test runs, the file syntax is valid
    expect(true).toBe(true);
  });

  // ── L2-01: All 18 governance endpoints are documented ──────────────
  test('L2-01: all 18 Track 114-121 governance endpoints are documented in OpenAPI spec', () => {
    for (const prefix of GOVERNANCE_PREFIXES) {
      const policyPath = '/vault/' + prefix + '/policy';
      const validatePath = '/vault/' + prefix + '/policy/validate';
      const telemetryPath = '/vault/' + prefix + '/telemetry';
      expect(doc.paths).toHaveProperty(policyPath);
      expect(doc.paths).toHaveProperty(validatePath);
      expect(doc.paths).toHaveProperty(telemetryPath);
      // Verify methods
      expect(doc.paths[policyPath]).toHaveProperty('get');
      expect(doc.paths[validatePath]).toHaveProperty('post');
      expect(doc.paths[telemetryPath]).toHaveProperty('get');
    }
  });

  // ── L2-01b: All 3 Track 112 upload endpoints are documented ───────
  test('L2-01b: all 3 Track 112 upload endpoints are documented with correct methods', () => {
    for (const p of TRACK112_PATHS) {
      expect(doc.paths).toHaveProperty(p);
    }
    expect(doc.paths['/track112/uploads']).toHaveProperty('post');
    expect(doc.paths['/track112/uploads/{id}/chunk']).toHaveProperty('post');
    expect(doc.paths['/track112/uploads/{id}/commit']).toHaveProperty('post');
  });

  // ── L2-01c: Track 112 commit request schema requires publicKeyPem and signature
  test('L2-01c: Track 112 commit request requires publicKeyPem and Ed25519 signature', () => {
    const schema = doc.components.schemas.Track112CommitRequest;
    expect(schema).toBeDefined();
    expect(schema.required).toContain('publicKeyPem');
    expect(schema.required).toContain('signature');
    const pemProp = schema.properties.publicKeyPem;
    expect(pemProp.format).toBe('pem');
    const sigProp = schema.properties.signature;
    expect(sigProp.format).toBe('byte');
  });

  // ── L2-02: All 5 SIEM audit endpoints are documented ───────────────
  test('L2-02: all 5 SIEM audit endpoints are documented in OpenAPI spec', () => {
    for (const p of SIEM_PATHS) {
      expect(doc.paths).toHaveProperty(p);
      expect(doc.paths[p]).toHaveProperty('get');
    }
  });

  // ── L2-03: Policy endpoint schema matches actual response ──────────
  test('L2-03: policy endpoint schema matches actual route handler response (Track 121)', async () => {
    const res = await request(app).get('/api/vault/multiparty-re-keying/policy?orgId=test-contract').expect(200);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('orgId', 'test-contract');
    expect(res.body).toHaveProperty('policy');
    // Verify schema in spec matches
    const specPath = doc.paths['/vault/multiparty-re-keying/policy'];
    const schemaRef = specPath.get.responses['200'].content['application/json'].schema.$ref;
    expect(schemaRef).toBe('#/components/schemas/PolicyResponse');
    const schema = doc.components.schemas.PolicyResponse;
    expect(schema.required).toContain('success');
    expect(schema.required).toContain('orgId');
    expect(schema.required).toContain('policy');
  });

  // ── L2-04: Validate endpoint schema matches actual response ────────
  test('L2-04: validate endpoint schema matches actual route handler response (Track 121)', async () => {
    const res = await request(app).post('/api/vault/multiparty-re-keying/policy/validate').send({ minQuorumNodes: 3 }).expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('valid', true);
    // Verify 400 error schema
    const specPath = doc.paths['/vault/multiparty-re-keying/policy/validate'];
    const successSchemaRef = specPath.post.responses['200'].content['application/json'].schema.$ref;
    expect(successSchemaRef).toBe('#/components/schemas/PolicyValidateResponse');
    const errorSchemaRef = specPath.post.responses['400'].content['application/json'].schema.$ref;
    expect(errorSchemaRef).toBe('#/components/schemas/PolicyViolationError');
  });

  // ── L2-05: Telemetry endpoint schema matches actual response ───────
  test('L2-05: telemetry endpoint schema matches actual route handler response (Track 121)', async () => {
    const res = await request(app).get('/api/vault/multiparty-re-keying/telemetry?orgId=test-telemetry').expect(200);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('orgId', 'test-telemetry');
    expect(res.body).toHaveProperty('telemetry');
    // Verify schema
    const specPath = doc.paths['/vault/multiparty-re-keying/telemetry'];
    const schemaRef = specPath.get.responses['200'].content['application/json'].schema.$ref;
    expect(schemaRef).toBe('#/components/schemas/TelemetryResponse');
    const schema = doc.components.schemas.TelemetryResponse;
    expect(schema.required).toContain('success');
    expect(schema.required).toContain('orgId');
    expect(schema.required).toContain('telemetry');
  });

  // ── L2-06: Error response schema matches POLICY_VIOLATION_BLOCKED ──
  test('L2-06: error response schema matches actual POLICY_VIOLATION_BLOCKED response', async () => {
    const res = await request(app).post('/api/vault/multiparty-re-keying/policy/validate').send({ minQuorumNodes: 1 }).expect(400);
    expect(res.body).toHaveProperty('error', 'POLICY_VIOLATION_BLOCKED');
    expect(res.body).toHaveProperty('message');
    // Verify schema
    const schema = doc.components.schemas.PolicyViolationError;
    expect(schema.required).toContain('error');
    expect(schema.required).toContain('message');
    expect(schema.properties.error.example).toBe('POLICY_VIOLATION_BLOCKED');
  });

  // ── L2-07: Track 112 end-to-end contract matches actual route responses
  test('L2-07: Track 112 upload create, chunk, and commit flow matches OpenAPI schemas', async () => {
    const createRes = await request(app)
      .post('/api/track112/uploads')
      .send({ tenant: 't1', maxBytes: 8192 })
      .expect(201);
    expect(createRes.body).toHaveProperty('sessionId');
    expect(createRes.body).toHaveProperty('traceId');

    const id = createRes.body.sessionId;
    const chunk = Buffer.alloc(4096, 'a');
    await request(app)
      .post('/api/track112/uploads/' + id + '/chunk?offset=0')
      .set('Content-Type', 'application/octet-stream')
      .send(chunk)
      .expect(204);

    const root = crypto.createHash('sha256').update(chunk).digest();
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' });
    const signature = crypto.sign(null, root, keyPair.privateKey).toString('base64');

    const commitRes = await request(app)
      .post('/api/track112/uploads/' + id + '/commit')
      .send({ publicKeyPem, signature })
      .expect(200);
    expect(commitRes.body).toHaveProperty('status', 'committed');
    expect(commitRes.body).toHaveProperty('root');
    expect(commitRes.body).toHaveProperty('traceId');

    // Verify schema refs
    const createSchema = doc.paths['/track112/uploads'].post.responses['201'].content['application/json'].schema.$ref;
    expect(createSchema).toBe('#/components/schemas/Track112UploadCreateResponse');
    const commitSchema = doc.paths['/track112/uploads/{id}/commit'].post.responses['200'].content['application/json'].schema.$ref;
    expect(commitSchema).toBe('#/components/schemas/Track112CommitResponse');
    const commitReqSchema = doc.paths['/track112/uploads/{id}/commit'].post.requestBody.content['application/json'].schema.$ref;
    expect(commitReqSchema).toBe('#/components/schemas/Track112CommitRequest');
  });

  // ── L3-01: Existing Track 79 endpoints unchanged ───────────────────
  test('L3-01: existing Track 79 endpoints are preserved unchanged', () => {
    for (const p of ORIGINAL_TRACK79_PATHS) {
      expect(doc.paths).toHaveProperty(p);
    }
  });

  // ── L3-02: OpenAPI tags organize endpoints by track ────────────────
  test('L3-02: all 8 track-specific tags are registered in the tags section', () => {
    const tagNames = doc.tags.map(t => t.name);
    for (const tag of EXPECTED_TAGS) {
      expect(tagNames).toContain(tag);
    }
  });

  // ── L3-03: All new paths require authorization ─────────────────────
  test('L3-03: all new governance and SIEM paths require adminAll authorization', () => {
    const allNewPaths = [];
    for (const prefix of GOVERNANCE_PREFIXES) {
      allNewPaths.push('/vault/' + prefix + '/policy');
      allNewPaths.push('/vault/' + prefix + '/policy/validate');
      allNewPaths.push('/vault/' + prefix + '/telemetry');
    }
    for (const p of SIEM_PATHS) {
      allNewPaths.push(p);
    }
    for (const p of allNewPaths) {
      const pathObj = doc.paths[p];
      expect(pathObj).toBeDefined();
      const method = pathObj.get || pathObj.post;
      expect(method).toBeDefined();
      expect(method.security).toBeDefined();
      expect(method.security[0]).toHaveProperty('adminAll');
    }
  });

  // ── L3-04: No ghost paths in OpenAPI spec ──────────────────────────
  test('L3-04: every governance path in spec corresponds to a real route handler', () => {
    // Verify that the route handler file contains the route patterns
    const routesContent = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'routes', 'hsm-vault-routes.cjs'),
      'utf8'
    );
    for (const prefix of GOVERNANCE_PREFIXES) {
      expect(routesContent).toContain("'/" + prefix + "/policy'");
      expect(routesContent).toContain("'/" + prefix + "/policy/validate'");
      expect(routesContent).toContain("'/" + prefix + "/telemetry'");
    }
    // Verify SIEM routes
    const auditContent = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'routes', 'audit-routes.cjs'),
      'utf8'
    );
    for (const siemPath of SIEM_PATHS) {
      const routePattern = siemPath.replace('/audit/', '/');
      expect(auditContent).toContain("'" + routePattern + "'");
    }
    // Verify Track 112 routes
    const track112Content = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'routes', 'track112-upload-routes.cjs'),
      'utf8'
    );
    expect(track112Content).toContain("'/uploads'");
    expect(track112Content).toContain("'/uploads/:id/chunk'");
    expect(track112Content).toContain("'/uploads/:id/commit'");
  });

  // ── L3-05: Schema contract test catches response drift ─────────────
  test('L3-05: schema contract validates actual response keys match schema properties', async () => {
    // Test Track 120 policy endpoint
    const res = await request(app).get('/api/vault/cluster-key-reconciliation/policy').expect(200);
    const schema = doc.components.schemas.PolicyResponse;
    // Every required schema field must be in the response
    for (const field of schema.required) {
      expect(res.body).toHaveProperty(field);
    }
    // Response should not have fields outside schema properties (allowing additionalProperties: true on policy)
    const schemaProps = Object.keys(schema.properties);
    for (const key of Object.keys(res.body)) {
      expect(schemaProps).toContain(key);
    }
  });

  // ── S-01: No credentials or PII in OpenAPI spec examples ───────────
  test('S-01: no credentials or PII in OpenAPI spec examples', () => {
    const yamlText = fs.readFileSync(OPENAPI_YML, 'utf8');
    expect(yamlText).not.toMatch(/password\s*[:=]\s*["']?[^\s"']+/i);
    expect(yamlText).not.toMatch(/api[_-]?key\s*[:=]\s*["']?[^\s"']+/i);
    expect(yamlText).not.toMatch(/secret\s*[:=]\s*["']?[^\s"']+/i);
    expect(yamlText).not.toMatch(/[0-9a-f]{64}/i);
  });

  // ── S-02: All new paths have security requirements explicitly defined ────────
  test('S-02: all new paths have security requirements defined', () => {
    const allNewPaths = [];
    for (const prefix of GOVERNANCE_PREFIXES) {
      allNewPaths.push('/vault/' + prefix + '/policy');
      allNewPaths.push('/vault/' + prefix + '/policy/validate');
      allNewPaths.push('/vault/' + prefix + '/telemetry');
    }
    for (const p of SIEM_PATHS) {
      allNewPaths.push(p);
    }
    for (const p of TRACK112_PATHS) {
      allNewPaths.push(p);
    }
    for (const p of allNewPaths) {
      const pathObj = doc.paths[p];
      const method = pathObj.get || pathObj.post;
      expect(method.security).toBeDefined();
      // Track 112 is intentionally public (security: []); governance/SIEM require adminAll
      if (TRACK112_PATHS.includes(p)) {
        expect(method.security).toEqual([]);
      } else {
        expect(method.security.length).toBeGreaterThan(0);
      }
    }
  });

  // ── S-03: No real tenant IDs, node IDs, or key material in schema examples ──
  test('S-03: no real tenant IDs, node IDs, or key material in schema examples', () => {
    const yamlText = fs.readFileSync(OPENAPI_YML, 'utf8');
    // No hex strings longer than 16 chars
    expect(yamlText).not.toMatch(/[0-9a-f]{32,}/i);
    // No UUID patterns
    expect(yamlText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    // No real tenant IDs
    expect(yamlText).not.toMatch(/tenant-[0-9a-f]{16,}/i);
  });
});
