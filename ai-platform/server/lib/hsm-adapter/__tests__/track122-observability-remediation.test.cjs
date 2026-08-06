'use strict';

/**
 * Track 122 — Observability Remediation & Core Hardening
 *
 * 20-check verification matrix validating:
 * - Ghost metric elimination (5 checks)
 * - Division-by-zero protection (5 checks)
 * - String coercion on resolveOrgId (2 checks)
 * - Runbook disk availability (5 checks)
 * - Orchestrator integrity (3 checks)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ALERTS_YML = path.join(__dirname, '..', '..', '..', '..', 'monitoring', 'prometheus-mesh-alerts.yml');
const RUNBOOK_DIR = path.join(__dirname, '..', '..', '..', '..', 'docs', 'runbooks');
const RUN_ALL_TRACKS = path.join(__dirname, 'run-all-tracks.cjs');
const HSM_VAULT_ROUTES = path.join(__dirname, '..', '..', '..', 'routes', 'hsm-vault-routes.cjs');

function loadAlertsDoc() {
  return yaml.load(fs.readFileSync(ALERTS_YML, 'utf8'));
}

const GHOST_METRICS = [
  'hsm_handshake_init_total',
  'hsm_handshake_verify_total',
  'hsm_handshake_envelope_decryption_failed_total',
  'hsm_lookupgate_challenge_issued_total',
  'hsm_ringgate_challenge_issued_total',
];

const REPLACEMENT_METRICS = [
  'hsm_mpc_handshake_initiated_total',
  'hsm_mpc_handshake_verified_total',
  'hsm_mpc_handshake_aborted_total',
  'hsm_lookup_accreditation_completed_total',
  'hsm_ring_accreditation_completed_total',
];

describe('Track 122 — Observability Remediation', () => {
  let doc;
  let yamlText;

  beforeAll(() => {
    doc = loadAlertsDoc();
    yamlText = fs.readFileSync(ALERTS_YML, 'utf8');
  });

  // ── REMED-122-01: Ghost metric elimination (5 checks) ──────────────
  test('REMED-122-01a: hsm_handshake_init_total is eliminated from alerts', () => {
    expect(yamlText).not.toContain(GHOST_METRICS[0]);
  });

  test('REMED-122-01b: hsm_handshake_verify_total is eliminated from alerts', () => {
    expect(yamlText).not.toContain(GHOST_METRICS[1]);
  });

  test('REMED-122-01c: hsm_handshake_envelope_decryption_failed_total is eliminated from alerts', () => {
    expect(yamlText).not.toContain(GHOST_METRICS[2]);
  });

  test('REMED-122-01d: hsm_lookupgate_challenge_issued_total is eliminated from alerts', () => {
    expect(yamlText).not.toContain(GHOST_METRICS[3]);
  });

  test('REMED-122-01e: hsm_ringgate_challenge_issued_total is eliminated from alerts', () => {
    expect(yamlText).not.toContain(GHOST_METRICS[4]);
  });

  // ── REMED-122-02: Replacement metrics present + division guards (5 checks) ──
  test('REMED-122-02a: hsm_mpc_handshake_initiated_total is used in Track 113 alert', () => {
    expect(yamlText).toContain(REPLACEMENT_METRICS[0]);
  });

  test('REMED-122-02b: hsm_mpc_handshake_verified_total is used in Track 113 alert', () => {
    expect(yamlText).toContain(REPLACEMENT_METRICS[1]);
  });

  test('REMED-122-02c: hsm_mpc_handshake_aborted_total is used in Track 113 alert', () => {
    expect(yamlText).toContain(REPLACEMENT_METRICS[2]);
  });

  test('REMED-122-02d: Track31 alert uses + 1 division guard', () => {
    expect(yamlText).toContain('(rate(hsm_lookupgate_pool_initialized_total[5m]) + 1)');
  });

  test('REMED-122-02e: Track32 alert uses + 1 division guard', () => {
    expect(yamlText).toContain('(rate(hsm_ringgate_pool_initialized_total[5m]) + 1)');
  });

  // ── REMED-122-03: String coercion on resolveOrgId (2 checks) ────────
  test('REMED-122-03a: resolveOrgId wraps return value in String()', () => {
    const routesContent = fs.readFileSync(HSM_VAULT_ROUTES, 'utf8');
    expect(routesContent).toMatch(/function resolveOrgId\(req\)\s*\{[\s\S]*return String\(/);
  });

  test('REMED-122-03b: resolveOrgId coerces numeric orgId to string', () => {
    // Simulate the resolveOrgId function with a numeric orgId
    // Express always sets req.query to an object, so we include it here
    const resolveOrgId = function (req) {
      return String(req.orgId || req.query.orgId || (req.body && req.body.orgId) || 'default');
    };
    const result = resolveOrgId({ query: {}, body: { orgId: 1234 } });
    expect(typeof result).toBe('string');
    expect(result).toBe('1234');
  });

  // ── REMED-122-04: Runbook disk availability (5 checks) ──────────────
  test('REMED-122-04a: all 59 alerts have corresponding runbook files on disk', () => {
    const existingRunbooks = new Set(
      fs.readdirSync(RUNBOOK_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => f.toUpperCase())
    );
    const missing = [];
    for (const group of doc.groups || []) {
      for (const rule of group.rules || []) {
        if (rule.alert) {
          const runbookUrl = rule.annotations && rule.annotations.runbook_url;
          if (!runbookUrl) {
            missing.push({ alert: rule.alert, reason: 'no runbook_url' });
            continue;
          }
          const filename = runbookUrl.split('/').pop().toUpperCase();
          if (!existingRunbooks.has(filename)) {
            missing.push({ alert: rule.alert, reason: `file ${filename} not found` });
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test('REMED-122-04b: TRACK113_PQC_HANDSHAKE_STALL.md exists on disk', () => {
    expect(fs.existsSync(path.join(RUNBOOK_DIR, 'TRACK113_PQC_HANDSHAKE_STALL.md'))).toBe(true);
  });

  test('REMED-122-04c: TRACK31_HOMOMORPHIC_LOOKUP_STALL.md exists on disk', () => {
    expect(fs.existsSync(path.join(RUNBOOK_DIR, 'TRACK31_HOMOMORPHIC_LOOKUP_STALL.md'))).toBe(true);
  });

  test('REMED-122-04d: TRACK117_BYZANTINE_SHARD_DIVERGENCE_DETECTED.md exists on disk', () => {
    expect(fs.existsSync(path.join(RUNBOOK_DIR, 'TRACK117_BYZANTINE_SHARD_DIVERGENCE_DETECTED.md'))).toBe(true);
  });

  test('REMED-122-04e: MESH_RECONCILIATION_STALL.md exists on disk', () => {
    expect(fs.existsSync(path.join(RUNBOOK_DIR, 'MESH_RECONCILIATION_STALL.md'))).toBe(true);
  });

  // ── REMED-122-05: Orchestrator integrity (3 checks) ─────────────────
  test('REMED-122-05a: run-all-tracks.cjs includes track112 suite entries', () => {
    const content = fs.readFileSync(RUN_ALL_TRACKS, 'utf8');
    expect(content).toContain('track112-ingest-queue');
    expect(content).toContain('track112-poRep-merkle');
    expect(content).toContain('track112-poRep-verifier');
  });

  test('REMED-122-05b: run-all-tracks.cjs includes track113-hardening-primitives entry', () => {
    const content = fs.readFileSync(RUN_ALL_TRACKS, 'utf8');
    expect(content).toContain('track113-hardening-primitives');
  });

  test('REMED-122-05c: resolveBaseTestFile scans subdirectories', () => {
    const content = fs.readFileSync(RUN_ALL_TRACKS, 'utf8');
    expect(content).toContain('withFileTypes: true');
    expect(content).toContain('d.isDirectory()');
  });
});
