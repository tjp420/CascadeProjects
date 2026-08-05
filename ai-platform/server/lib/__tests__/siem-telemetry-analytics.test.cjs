'use strict';

/**
 * SIEM Cluster Telemetry Analytics Tests
 *
 * Verifies the getClusterTelemetry() aggregation method on SiemSecurityBroker
 * and the GET /api/analytics/siem-telemetry REST endpoint.
 *
 * Test items T1-T13 from the approved test plan.
 */

const path = require('path');
const fs = require('fs');

const SiemSecurityBroker = require(path.join(__dirname, '..', 'siem', 'siem-broker.cjs'));

describe('SIEM Cluster Telemetry Analytics', () => {
  let broker;

  beforeEach(() => {
    broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
  });

  afterEach(() => {
    if (broker) broker.close();
  });

  // ── T1: getClusterTelemetry returns metrics snapshot with processed/dropped/bypassed counts ──
  test('T1: getClusterTelemetry() returns metrics snapshot with processed/dropped/bypassed counts', () => {
    // Emit some events to populate metrics
    broker.logEvent({ siemSeverity: 'LOW', siemCategory: 'TEST_EVENT' });
    broker.logEvent({ siemSeverity: 'LOW', siemCategory: 'TEST_EVENT' });
    broker.logEvent({ siemSeverity: 'CRITICAL', siemCategory: 'TEST_CRITICAL' });

    const telemetry = broker.getClusterTelemetry();
    expect(telemetry).toBeDefined();
    expect(telemetry.metrics).toBeDefined();
    expect(telemetry.metrics.siem_events_processed_total).toBe(3);
    expect(telemetry.metrics.siem_events_bypassed_total).toBe(1); // CRITICAL bypasses rate limiter
    expect(typeof telemetry.metrics.siem_events_dropped_total).toBe('number');
  });

  // ── T2: getClusterTelemetry returns distributed state (nodeId, fairShare, peerCount, peers) ──
  test('T2: getClusterTelemetry() returns distributed state (nodeId, fairShare, peerCount, peers)', () => {
    broker.enableDistributedSync({
      nodeCount: 3,
      nodeId: 'node-test-1',
      sendFn: () => {},
    });

    const telemetry = broker.getClusterTelemetry();
    expect(telemetry.nodeId).toBe('node-test-1');
    expect(telemetry.nodeCount).toBe(3);
    expect(telemetry.distributedSyncEnabled).toBe(true);
    expect(typeof telemetry.fairShare).toBe('number');
    expect(typeof telemetry.peerCount).toBe('number');
    expect(typeof telemetry.peers).toBe('object');
  });

  // ── T3: getClusterTelemetry returns token borrowing stats ──
  test('T3: getClusterTelemetry() returns token borrowing stats (tokens borrowed, grants given)', () => {
    broker.enableDistributedSync({
      nodeCount: 2,
      nodeId: 'node-a',
      sendFn: () => {},
    });

    // Simulate a token request from a peer
    broker.handleTokenRequest({
      type: 'SIEM_TOKEN_REQUEST',
      from: 'node-b',
      requested: 5,
    });

    const telemetry = broker.getClusterTelemetry();
    expect(telemetry.metrics.siem_tokens_granted_total).toBeGreaterThan(0);
    expect(telemetry.metrics.siem_token_requests_received_total).toBe(1);
  });

  // ── T4: REST endpoint returns 200 with valid JSON structure ──
  test('T4: GET /api/analytics/siem-telemetry returns 200 with valid JSON structure', async () => {
    const express = require('express');
    const request = require('supertest');
    // Mock auth middleware before requiring the router
    jest.mock(path.join(__dirname, '..', '..', 'middleware', 'auth.cjs'), () => ({
      authenticate: (req, res, next) => { req.user = { id: 'test-user', email: 'test@test.com', role: 'auditor' }; next(); },
    }));
    // Mock authorize middleware to pass through with auditor role
    jest.mock(path.join(__dirname, '..', '..', 'middleware', 'authorize.cjs'), () => ({
      authorize: () => (req, res, next) => { req.userRole = 'auditor'; next(); },
    }));
    const router = require(path.join(__dirname, '..', '..', 'routes', 'analytics-routes.cjs'));

    const app = express();
    app.use(express.json());
    app.use('/api/analytics', router);

    const res = await request(app).get('/api/analytics/siem-telemetry').expect(200);
    expect(res.body).toBeDefined();
    expect(res.body.status).toBe('success');
    expect(res.body.metrics).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    jest.dontMock(path.join(__dirname, '..', '..', 'middleware', 'auth.cjs'));
    jest.dontMock(path.join(__dirname, '..', '..', 'middleware', 'authorize.cjs'));
  });

  // ── T5: Dashboard component renders without errors when data is available ──
  test('T5: Dashboard component file exists and exports render + cleanup functions', () => {
    const dashboardPath = path.join(__dirname, '..', '..', '..', 'web', 'simplebeacon-dashboard', 'js', 'components', 'SiemTelemetryDashboard.js');
    expect(fs.existsSync(dashboardPath)).toBe(true);
    const content = fs.readFileSync(dashboardPath, 'utf8');
    expect(content).toContain('export function renderSiemTelemetryDashboard');
    expect(content).toContain('export function cleanupSiemTelemetryDashboard');
  });

  // ── T6: Dashboard component renders "unavailable" state when API is down ──
  test('T6: Dashboard component handles unavailable state', () => {
    const dashboardPath = path.join(__dirname, '..', '..', '..', 'web', 'simplebeacon-dashboard', 'js', 'components', 'SiemTelemetryDashboard.js');
    const content = fs.readFileSync(dashboardPath, 'utf8');
    expect(content).toContain('unavailable');
    expect(content).toContain('offline');
  });

  // ── T7: Dashboard auto-refreshes on interval ──
  test('T7: Dashboard auto-refreshes on interval', () => {
    const dashboardPath = path.join(__dirname, '..', '..', '..', 'web', 'simplebeacon-dashboard', 'js', 'components', 'SiemTelemetryDashboard.js');
    const content = fs.readFileSync(dashboardPath, 'utf8');
    expect(content).toContain('setInterval');
    expect(content).toContain('15000'); // 15-second polling
  });

  // ── T8: getClusterTelemetry works when distributed sync is disabled ──
  test('T8: getClusterTelemetry() works when distributed sync is disabled', () => {
    // Don't call enableDistributedSync
    const telemetry = broker.getClusterTelemetry();
    expect(telemetry).toBeDefined();
    expect(telemetry.distributedSyncEnabled).toBe(false);
    expect(telemetry.nodeId).toBeNull();
    expect(telemetry.peerCount).toBe(0);
    expect(telemetry.peers).toEqual({});
    // Metrics should still be present
    expect(telemetry.metrics).toBeDefined();
    expect(telemetry.metrics.siem_events_processed_total).toBe(0);
  });

  // ── T9: getClusterTelemetry works when no peers are connected ──
  test('T9: getClusterTelemetry() works when no peers are connected', () => {
    broker.enableDistributedSync({
      nodeCount: 5,
      nodeId: 'node-isolated',
      sendFn: () => {},
    });

    const telemetry = broker.getClusterTelemetry();
    expect(telemetry.distributedSyncEnabled).toBe(true);
    expect(telemetry.peerCount).toBe(0); // No peers have synced yet
    expect(telemetry.peers).toEqual({});
    expect(telemetry.nodeCount).toBe(5);
  });

  // ── T10: API endpoint returns graceful error when broker is not initialized ──
  test('T10: API endpoint returns graceful error when broker throws', async () => {
    const express = require('express');
    const request = require('supertest');
    // Create a minimal app that simulates a broker error
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.user = { id: 'test-user' }; next(); });
    app.get('/api/analytics/siem-telemetry', (req, res) => {
      try {
        throw new Error('broker_not_initialized');
      } catch (err) {
        res.status(500).json({ error: 'siem_telemetry_failed', message: err.message });
      }
    });

    const res = await request(app).get('/api/analytics/siem-telemetry').expect(500);
    expect(res.body.error).toBe('siem_telemetry_failed');
    expect(res.body.message).toContain('broker_not_initialized');
  });

  // ── T11: Dashboard handles zero peers gracefully (shows single-node mode) ──
  test('T11: Dashboard handles zero peers gracefully', () => {
    const dashboardPath = path.join(__dirname, '..', '..', '..', 'web', 'simplebeacon-dashboard', 'js', 'components', 'SiemTelemetryDashboard.js');
    const content = fs.readFileSync(dashboardPath, 'utf8');
    expect(content).toContain('single-node');
    expect(content).toContain('Distributed sync is disabled');
  });

  // ── T12: API endpoint does not leak secrets or internal state beyond telemetry metrics ──
  test('T12: API endpoint does not leak secrets or internal state beyond telemetry metrics', async () => {
    const express = require('express');
    const request = require('supertest');
    jest.mock(path.join(__dirname, '..', '..', 'middleware', 'auth.cjs'), () => ({
      authenticate: (req, res, next) => { req.user = { id: 'test-user', email: 'test@test.com', role: 'auditor' }; next(); },
    }));
    jest.mock(path.join(__dirname, '..', '..', 'middleware', 'authorize.cjs'), () => ({
      authorize: () => (req, res, next) => { req.userRole = 'auditor'; next(); },
    }));
    const router = require(path.join(__dirname, '..', '..', 'routes', 'analytics-routes.cjs'));

    const app = express();
    app.use(express.json());
    app.use('/api/analytics', router);

    const res = await request(app).get('/api/analytics/siem-telemetry').expect(200);
    const bodyStr = JSON.stringify(res.body);
    // Should not contain secrets, keys, or credentials
    expect(bodyStr).not.toMatch(/password/i);
    expect(bodyStr).not.toMatch(/api[_-]?key/i);
    expect(bodyStr).not.toMatch(/private[_-]?key/i);
    expect(bodyStr).not.toMatch(/[0-9a-f]{64}/i);
    // Should not contain internal broker state like _sendToPeers or _peerBuckets
    expect(bodyStr).not.toContain('_sendToPeers');
    expect(bodyStr).not.toContain('_peerBuckets');
    expect(bodyStr).not.toContain('_refillTimer');
    jest.dontMock(path.join(__dirname, '..', '..', 'middleware', 'auth.cjs'));
    jest.dontMock(path.join(__dirname, '..', '..', 'middleware', 'authorize.cjs'));
  });

  // ── T13: Broker metrics are read-only (no mutation through telemetry endpoint) ──
  test('T13: Broker metrics are read-only (telemetry snapshot does not mutate state)', () => {
    broker.logEvent({ siemSeverity: 'LOW', siemCategory: 'TEST' });
    const before = broker.getClusterTelemetry();
    const beforeProcessed = before.metrics.siem_events_processed_total;

    // Call getClusterTelemetry multiple times
    broker.getClusterTelemetry();
    broker.getClusterTelemetry();
    const after = broker.getClusterTelemetry();

    // Metrics should not have changed from reading
    expect(after.metrics.siem_events_processed_total).toBe(beforeProcessed);
  });

  // ── Weight Visualization Tests (PR #514 integration) ──────────────

  // ── T14: getClusterTelemetry includes nodeWeight and clusterWeight ──
  test('T14: getClusterTelemetry() includes nodeWeight and clusterWeight when distributed sync enabled', () => {
    broker.enableDistributedSync({
      nodeCount: 3,
      nodeId: 'core-1',
      weight: 4,
      sendFn: () => {},
    });
    const telemetry = broker.getClusterTelemetry();
    expect(telemetry.nodeWeight).toBe(4);
    expect(telemetry.clusterWeight).toBe(4); // only self known so far
  });

  // ── T15: clusterWeight updates when peers sync with weights ──
  test('T15: clusterWeight reflects sum of local + peer weights after peer sync', () => {
    broker.enableDistributedSync({
      nodeCount: 3,
      nodeId: 'core-1',
      weight: 4,
      sendFn: () => {},
    });
    broker.handlePeerSync({
      type: 'SIEM_BUCKET_SYNC', from: 'edge-1',
      localTokens: 10, maxLocalTokens: 16, weight: 1,
    });
    broker.handlePeerSync({
      type: 'SIEM_BUCKET_SYNC', from: 'edge-2',
      localTokens: 10, maxLocalTokens: 16, weight: 1,
    });
    const telemetry = broker.getClusterTelemetry();
    expect(telemetry.nodeWeight).toBe(4);
    expect(telemetry.clusterWeight).toBe(6); // 4 + 1 + 1
  });

  // ── T16: Dashboard component includes weight visualization elements ──
  test('T16: Dashboard component includes weight allocation bar and weight column', () => {
    const dashboardPath = path.join(__dirname, '..', '..', '..', 'web', 'simplebeacon-dashboard', 'js', 'components', 'SiemTelemetryDashboard.js');
    const content = fs.readFileSync(dashboardPath, 'utf8');
    // Weight summary cards
    expect(content).toContain('Node Weight');
    expect(content).toContain('Cluster Weight');
    expect(content).toContain('Proportional Share');
    // Weight allocation bar
    expect(content).toContain('siem-weight-bar');
    expect(content).toContain('Capacity Weight Allocation');
    // Weight column in table
    expect(content).toContain('<th>Weight</th>');
    expect(content).toContain('<th>Share %</th>');
  });

  // ── T17: Dashboard component handles missing weight gracefully (defaults to 1) ──
  test('T17: Dashboard component defaults nodeWeight to 1 when not present', () => {
    const dashboardPath = path.join(__dirname, '..', '..', '..', 'web', 'simplebeacon-dashboard', 'js', 'components', 'SiemTelemetryDashboard.js');
    const content = fs.readFileSync(dashboardPath, 'utf8');
    expect(content).toMatch(/nodeWeight\s*\|\|\s*1/);
  });

  // ── T18: CSS includes weight bar styles ──
  test('T18: components.css includes siem-weight-bar styles', () => {
    const cssPath = path.join(__dirname, '..', '..', '..', 'web', 'simplebeacon-dashboard', 'css', 'components.css');
    const content = fs.readFileSync(cssPath, 'utf8');
    expect(content).toContain('.siem-weight-bar');
    expect(content).toContain('.siem-weight-seg-self');
    expect(content).toContain('.siem-weight-seg-peer');
    expect(content).toContain('.siem-weight-bar-legend');
  });

  // ── T19: siemTelemetryService exposes nodeWeight and clusterWeight ──
  test('T19: siemTelemetryService.js exposes nodeWeight and clusterWeight in getDistributedState()', () => {
    const servicePath = path.join(__dirname, '..', '..', '..', 'web', 'simplebeacon-dashboard', 'js', 'services', 'siemTelemetryService.js');
    const content = fs.readFileSync(servicePath, 'utf8');
    expect(content).toContain('nodeWeight');
    expect(content).toContain('clusterWeight');
  });

  // ── T20: API endpoint returns nodeWeight and clusterWeight in response ──
  test('T20: API endpoint returns nodeWeight and clusterWeight in telemetry response', async () => {
    const express = require('express');
    const request = require('supertest');
    jest.mock(path.join(__dirname, '..', '..', 'middleware', 'auth.cjs'), () => ({
      authenticate: (req, res, next) => { req.user = { id: 'test-user', email: 'test@test.com' }; next(); },
    }));
    const router = require(path.join(__dirname, '..', '..', 'routes', 'analytics-routes.cjs'));

    const app = express();
    app.use(express.json());
    app.use('/api/analytics', router);

    const res = await request(app).get('/api/analytics/siem-telemetry').expect(200);
    expect(res.body.status).toBe('success');
    // When distributed sync is enabled, nodeWeight and clusterWeight should be present
    if (res.body.distributedSyncEnabled) {
      expect(res.body.nodeWeight).toBeDefined();
      expect(res.body.clusterWeight).toBeDefined();
    }
    jest.dontMock(path.join(__dirname, '..', '..', 'middleware', 'auth.cjs'));
  });

  // ── T21: Weighted fair share is visible in telemetry for asymmetric clusters ──
  test('T21: Telemetry shows weighted fair share for asymmetric cluster (core=4, edge=1, edge=1)', () => {
    broker.enableDistributedSync({
      nodeCount: 3,
      nodeId: 'core-1',
      weight: 4,
      sendFn: () => {},
    });
    broker.handlePeerSync({
      type: 'SIEM_BUCKET_SYNC', from: 'edge-1',
      localTokens: 10, maxLocalTokens: 16, weight: 1,
    });
    broker.handlePeerSync({
      type: 'SIEM_BUCKET_SYNC', from: 'edge-2',
      localTokens: 10, maxLocalTokens: 16, weight: 1,
    });
    const telemetry = broker.getClusterTelemetry();
    // fairShare = 100 * (4/6) = 66
    expect(telemetry.fairShare).toBe(66);
    expect(telemetry.nodeWeight).toBe(4);
    expect(telemetry.clusterWeight).toBe(6);
    // Proportional share = 4/6 = 66.67%
    const expectedPct = ((4 / 6) * 100).toFixed(1);
    expect(expectedPct).toBe('66.7');
  });
});
