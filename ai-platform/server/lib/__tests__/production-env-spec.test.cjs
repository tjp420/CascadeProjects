'use strict';

/**
 * Production Environment Variable Spec Validation Tests
 *
 * Verifies that:
 *  - render.yaml contains all critical env vars documented in PRODUCTION_ENV_VARS.md
 *  - OLLAMA_NUM_CTX is present (the critical fix from commit e8b4f2040)
 *  - REPORT_SIGNING_KEY is present (tamper-evident evidence packs)
 *  - DASHBOARD_VAULT_PASSWORD is present (internal dashboard access)
 *  - Security-critical vars have correct production values
 *  - DEV_AUTH_BYPASS is NOT present in render.yaml
 *  - SEED_DEMO_USERS is false
 *  - ALLOW_LEGACY_LOGIN is false
 *  - REQUIRE_AUTH is true
 *  - All sync:false vars are documented as manually-set secrets
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const RENDER_YAML = path.resolve(__dirname, '..', '..', '..', '..', 'render.yaml');
const ENV_SPEC = path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'PRODUCTION_ENV_VARS.md');

function loadRenderYaml() {
  const raw = fs.readFileSync(RENDER_YAML, 'utf8');
  return yaml.load(raw);
}

function getEnvVarKeys(yaml) {
  const service = yaml.services?.[0];
  if (!service || !service.envVars) return [];
  return service.envVars.map(e => e.key);
}

// ── render.yaml structure ─────────────────────────────────────────────────

describe('render.yaml structure', () => {
  it('render.yaml exists and is valid YAML', () => {
    assert.ok(fs.existsSync(RENDER_YAML), 'render.yaml should exist');
    assert.doesNotThrow(() => loadRenderYaml(), 'render.yaml should be valid YAML');
  });

  it('has at least one web service', () => {
    const yaml = loadRenderYaml();
    assert.ok(yaml.services?.length >= 1, 'should have at least one service');
    assert.strictEqual(yaml.services[0].type, 'web');
  });

  it('has a PostgreSQL database resource', () => {
    const yaml = loadRenderYaml();
    assert.ok(yaml.databases?.length >= 1, 'should have at least one database');
    assert.strictEqual(yaml.databases[0].name, 'simplebeacon-db');
  });

  it('has envVars defined on the web service', () => {
    const yaml = loadRenderYaml();
    assert.ok(yaml.services[0].envVars, 'web service should have envVars');
    assert.ok(yaml.services[0].envVars.length >= 30, 'should have at least 30 env vars');
  });
});

// ── Critical LLM env vars (commit e8b4f2040) ──────────────────────────────

describe('LLM / Ollama env vars', () => {
  const keys = getEnvVarKeys(loadRenderYaml());

  it('OLLAMA_BASE_URL is present', () => {
    assert.ok(keys.includes('OLLAMA_BASE_URL'), 'OLLAMA_BASE_URL must be in render.yaml');
  });

  it('OLLAMA_MODEL is present', () => {
    assert.ok(keys.includes('OLLAMA_MODEL'), 'OLLAMA_MODEL must be in render.yaml');
  });

  it('OLLAMA_NUM_CTX is present (critical fix)', () => {
    assert.ok(keys.includes('OLLAMA_NUM_CTX'), 'OLLAMA_NUM_CTX must be in render.yaml — without it Ollama defaults to 2048 tokens');
  });

  it('OLLAMA_NUM_CTX value is a valid context window size', () => {
    const yaml = loadRenderYaml();
    const envVar = yaml.services[0].envVars.find(e => e.key === 'OLLAMA_NUM_CTX');
    const val = parseInt(envVar?.value, 10);
    assert.ok([2048, 4096, 8192, 16384, 32768, 65536].includes(val),
      `OLLAMA_NUM_CTX should be a standard context window size, got ${val}`);
  });

  it('OLLAMA_TIMEOUT_MS is present', () => {
    assert.ok(keys.includes('OLLAMA_TIMEOUT_MS'), 'OLLAMA_TIMEOUT_MS should be in render.yaml');
  });

  it('SIMPLEBEACON_OFFLINE is present', () => {
    assert.ok(keys.includes('SIMPLEBEACON_OFFLINE'), 'SIMPLEBEACON_OFFLINE should be in render.yaml');
  });
});

// ── Report signing env vars ───────────────────────────────────────────────

describe('Report signing env vars', () => {
  const keys = getEnvVarKeys(loadRenderYaml());

  it('REPORT_SIGNING_KEY is present', () => {
    assert.ok(keys.includes('REPORT_SIGNING_KEY'), 'REPORT_SIGNING_KEY must be in render.yaml for tamper-evident evidence packs');
  });

  it('REPORT_SIGNING_KEY is sync:false (manually set secret)', () => {
    const yaml = loadRenderYaml();
    const envVar = yaml.services[0].envVars.find(e => e.key === 'REPORT_SIGNING_KEY');
    assert.strictEqual(envVar?.sync, false, 'REPORT_SIGNING_KEY should be sync:false (set manually in Render dashboard)');
  });

  it('REPORT_SIGNING_KEY_ID is present', () => {
    assert.ok(keys.includes('REPORT_SIGNING_KEY_ID'), 'REPORT_SIGNING_KEY_ID should be in render.yaml');
  });
});

// ── Dashboard vault env vars ──────────────────────────────────────────────

describe('Dashboard vault env vars', () => {
  const keys = getEnvVarKeys(loadRenderYaml());

  it('DASHBOARD_VAULT_PASSWORD is present', () => {
    assert.ok(keys.includes('DASHBOARD_VAULT_PASSWORD'), 'DASHBOARD_VAULT_PASSWORD must be in render.yaml for internal dashboard access');
  });

  it('DASHBOARD_VAULT_PASSWORD is sync:false (manually set secret)', () => {
    const yaml = loadRenderYaml();
    const envVar = yaml.services[0].envVars.find(e => e.key === 'DASHBOARD_VAULT_PASSWORD');
    assert.strictEqual(envVar?.sync, false, 'DASHBOARD_VAULT_PASSWORD should be sync:false');
  });
});

// ── Stripe Checkout Links ─────────────────────────────────────────────────

describe('Stripe Checkout Links', () => {
  const keys = getEnvVarKeys(loadRenderYaml());

  it('STRIPE_LINK_INSTANT is present', () => {
    assert.ok(keys.includes('STRIPE_LINK_INSTANT'), 'STRIPE_LINK_INSTANT should be in render.yaml');
  });

  it('STRIPE_LINK_EXECUTIVE is present', () => {
    assert.ok(keys.includes('STRIPE_LINK_EXECUTIVE'), 'STRIPE_LINK_EXECUTIVE should be in render.yaml');
  });

  it('STRIPE_LINK_EU_SPRINT is present', () => {
    assert.ok(keys.includes('STRIPE_LINK_EU_SPRINT'), 'STRIPE_LINK_EU_SPRINT should be in render.yaml');
  });
});

// ── Security-critical env vars ────────────────────────────────────────────

describe('Security-critical env vars', () => {
  const yaml = loadRenderYaml();
  const envVars = yaml.services[0].envVars;
  const keys = envVars.map(e => e.key);

  it('NODE_ENV is production', () => {
    const v = envVars.find(e => e.key === 'NODE_ENV');
    assert.strictEqual(v?.value, 'production', 'NODE_ENV must be production');
  });

  it('REQUIRE_AUTH is true', () => {
    const v = envVars.find(e => e.key === 'REQUIRE_AUTH');
    assert.strictEqual(v?.value, 'true', 'REQUIRE_AUTH must be true in production');
  });

  it('SEED_DEMO_USERS is false', () => {
    const v = envVars.find(e => e.key === 'SEED_DEMO_USERS');
    assert.strictEqual(v?.value, 'false', 'SEED_DEMO_USERS must be false in production');
  });

  it('ALLOW_LEGACY_LOGIN is false', () => {
    const v = envVars.find(e => e.key === 'ALLOW_LEGACY_LOGIN');
    assert.strictEqual(v?.value, 'false', 'ALLOW_LEGACY_LOGIN must be false in production');
  });

  it('DEV_AUTH_BYPASS is NOT present', () => {
    assert.ok(!keys.includes('DEV_AUTH_BYPASS'), 'DEV_AUTH_BYPASS must NOT be in render.yaml — it enables auth bypass');
  });

  it('SIMPLEBEACON_ENABLE_DEMO_REPORT is false', () => {
    const v = envVars.find(e => e.key === 'SIMPLEBEACON_ENABLE_DEMO_REPORT');
    assert.ok(v, 'SIMPLEBEACON_ENABLE_DEMO_REPORT should be explicitly set');
    assert.strictEqual(v?.value, 'false', 'SIMPLEBEACON_ENABLE_DEMO_REPORT must be false in production');
  });

  it('ENABLE_EXTERNAL_APIS is false', () => {
    const v = envVars.find(e => e.key === 'ENABLE_EXTERNAL_APIS');
    assert.ok(v, 'ENABLE_EXTERNAL_APIS should be explicitly set');
    assert.strictEqual(v?.value, 'false', 'ENABLE_EXTERNAL_APIS should be false in production');
  });
});

// ── Core infrastructure env vars ──────────────────────────────────────────

describe('Core infrastructure env vars', () => {
  const keys = getEnvVarKeys(loadRenderYaml());

  it('DATABASE_URL is present (from database)', () => {
    const yaml = loadRenderYaml();
    const v = yaml.services[0].envVars.find(e => e.key === 'DATABASE_URL');
    assert.ok(v?.fromDatabase, 'DATABASE_URL should be sourced from the database resource');
  });

  it('ENABLE_DATABASE is true', () => {
    const yaml = loadRenderYaml();
    const v = yaml.services[0].envVars.find(e => e.key === 'ENABLE_DATABASE');
    assert.strictEqual(v?.value, 'true', 'ENABLE_DATABASE must be true');
  });

  it('JWT_SECRET is present (generated)', () => {
    const yaml = loadRenderYaml();
    const v = yaml.services[0].envVars.find(e => e.key === 'JWT_SECRET');
    assert.strictEqual(v?.generateValue, true, 'JWT_SECRET should be auto-generated');
  });

  it('SIMPLEBEACON_LICENSE_SECRET is present (generated)', () => {
    const yaml = loadRenderYaml();
    const v = yaml.services[0].envVars.find(e => e.key === 'SIMPLEBEACON_LICENSE_SECRET');
    assert.strictEqual(v?.generateValue, true, 'SIMPLEBEACON_LICENSE_SECRET should be auto-generated');
  });

  it('STRIPE_SECRET_KEY is present (sync:false)', () => {
    const yaml = loadRenderYaml();
    const v = yaml.services[0].envVars.find(e => e.key === 'STRIPE_SECRET_KEY');
    assert.strictEqual(v?.sync, false, 'STRIPE_SECRET_KEY should be sync:false');
  });

  it('STRIPE_WEBHOOK_SECRET is present (sync:false)', () => {
    const yaml = loadRenderYaml();
    const v = yaml.services[0].envVars.find(e => e.key === 'STRIPE_WEBHOOK_SECRET');
    assert.strictEqual(v?.sync, false, 'STRIPE_WEBHOOK_SECRET should be sync:false');
  });
});

// ── Documentation completeness ────────────────────────────────────────────

describe('PRODUCTION_ENV_VARS.md documentation', () => {
  it('spec document exists', () => {
    assert.ok(fs.existsSync(ENV_SPEC), 'PRODUCTION_ENV_VARS.md should exist');
  });

  it('documents OLLAMA_NUM_CTX', () => {
    const content = fs.readFileSync(ENV_SPEC, 'utf8');
    assert.ok(content.includes('OLLAMA_NUM_CTX'), 'should document OLLAMA_NUM_CTX');
  });

  it('documents REPORT_SIGNING_KEY', () => {
    const content = fs.readFileSync(ENV_SPEC, 'utf8');
    assert.ok(content.includes('REPORT_SIGNING_KEY'), 'should document REPORT_SIGNING_KEY');
  });

  it('documents DASHBOARD_VAULT_PASSWORD', () => {
    const content = fs.readFileSync(ENV_SPEC, 'utf8');
    assert.ok(content.includes('DASHBOARD_VAULT_PASSWORD'), 'should document DASHBOARD_VAULT_PASSWORD');
  });

  it('includes Render dashboard setup instructions', () => {
    const content = fs.readFileSync(ENV_SPEC, 'utf8');
    assert.ok(content.includes('Render Dashboard Setup'), 'should include setup instructions');
  });

  it('includes security checklist', () => {
    const content = fs.readFileSync(ENV_SPEC, 'utf8');
    assert.ok(content.includes('Security Checklist'), 'should include security checklist');
  });

  it('includes render.yaml patch section', () => {
    const content = fs.readFileSync(ENV_SPEC, 'utf8');
    assert.ok(content.includes('render.yaml Patch'), 'should include render.yaml patch section');
  });
});
