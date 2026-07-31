'use strict';

/**
 * Tests for the scrubber lifecycle manager (createScrubberRegistry).
 *
 * Verifies per-org+session scrubber tracking, TTL-based cleanup,
 * LRU eviction at max capacity, stats reporting, and the E2E
 * /api/audit/scrubber-stats endpoint.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Scrubber Lifecycle Manager', () => {
  let storeModule;
  let _tempPolicyPath;
  let _tempDir;

  beforeEach(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-scrub-reg-'));
    _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');
    process.env.PII_POLICY_PATH = _tempPolicyPath;
    fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), 'utf8');
    jest.resetModules();
    storeModule = require('../pii-policy-store.cjs');
    storeModule.seedDefaults('org-reg');
  });

  afterEach(() => {
    try {
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── Basic Operations ───────────────────────────────────────────────────────

  describe('basic operations', () => {
    it('should create a scrubber on first getOrCreate', () => {
      const registry = storeModule.createScrubberRegistry();
      const scrubber = registry.getOrCreate('org-reg', 'session-1');
      assert.ok(scrubber);
      assert.ok(typeof scrubber.process === 'function');
      assert.ok(typeof scrubber.flush === 'function');
      assert.ok(typeof scrubber.getStats === 'function');
    });

    it('should return the same scrubber for same org+session', () => {
      const registry = storeModule.createScrubberRegistry();
      const s1 = registry.getOrCreate('org-reg', 'session-1');
      const s2 = registry.getOrCreate('org-reg', 'session-1');
      assert.strictEqual(s1, s2);
    });

    it('should return different scrubbers for different sessions', () => {
      const registry = storeModule.createScrubberRegistry();
      const s1 = registry.getOrCreate('org-reg', 'session-1');
      const s2 = registry.getOrCreate('org-reg', 'session-2');
      assert.notStrictEqual(s1, s2);
    });

    it('should return different scrubbers for different orgs', () => {
      const registry = storeModule.createScrubberRegistry();
      const s1 = registry.getOrCreate('org-a', 'session-1');
      const s2 = registry.getOrCreate('org-b', 'session-1');
      assert.notStrictEqual(s1, s2);
    });

    it('should return null for non-existent scrubber with get()', () => {
      const registry = storeModule.createScrubberRegistry();
      const scrubber = registry.get('org-reg', 'nonexistent');
      assert.strictEqual(scrubber, null);
    });

    it('should return existing scrubber with get()', () => {
      const registry = storeModule.createScrubberRegistry();
      registry.getOrCreate('org-reg', 'session-1');
      const scrubber = registry.get('org-reg', 'session-1');
      assert.ok(scrubber);
    });

    it('should destroy a scrubber', () => {
      const registry = storeModule.createScrubberRegistry();
      registry.getOrCreate('org-reg', 'session-1');
      const destroyed = registry.destroy('org-reg', 'session-1');
      assert.strictEqual(destroyed, true);
      assert.strictEqual(registry.get('org-reg', 'session-1'), null);
    });

    it('should return false when destroying non-existent scrubber', () => {
      const registry = storeModule.createScrubberRegistry();
      const destroyed = registry.destroy('org-reg', 'nonexistent');
      assert.strictEqual(destroyed, false);
    });

    it('should clear all scrubbers', () => {
      const registry = storeModule.createScrubberRegistry();
      registry.getOrCreate('org-reg', 's1');
      registry.getOrCreate('org-reg', 's2');
      registry.getOrCreate('org-reg', 's3');
      registry.clear();
      const stats = registry.getStats();
      assert.strictEqual(stats.activeScrubbers, 0);
    });
  });

  // ── Scrubber Functionality ─────────────────────────────────────────────────

  describe('scrubber functionality', () => {
    it('should produce working scrubbers that redact PII', () => {
      const registry = storeModule.createScrubberRegistry();
      const scrubber = registry.getOrCreate('org-reg', 'session-1');
      const out = scrubber.process('Email: alice@test.com');
      const tail = scrubber.flush();
      const combined = (typeof out === 'string' ? out : out.text) + (typeof tail === 'string' ? tail : tail.text);
      assert.ok(combined.includes('[REDACTED-EMAIL]'));
    });

    it('should pass scrubber options through', () => {
      const registry = storeModule.createScrubberRegistry({
        scrubberOptions: { skipCodeBlocks: true },
      });
      const scrubber = registry.getOrCreate('org-reg', 'session-1');
      const stats = scrubber.getStats();
      assert.strictEqual(stats.skipCodeBlocks, true);
    });

    it('should allow per-call option overrides', () => {
      const registry = storeModule.createScrubberRegistry();
      const scrubber = registry.getOrCreate('org-reg', 'session-1', { skipCodeBlocks: true });
      const stats = scrubber.getStats();
      assert.strictEqual(stats.skipCodeBlocks, true);
    });

    it('should maintain scrubber state across getOrCreate calls', () => {
      const registry = storeModule.createScrubberRegistry();
      const scrubber = registry.getOrCreate('org-reg', 'session-1');
      scrubber.process('Contact alice@'); // Partial email — buffered

      const sameScrubber = registry.getOrCreate('org-reg', 'session-1');
      const out = sameScrubber.process('test.com now');
      const tail = sameScrubber.flush();
      const combined = (typeof out === 'string' ? out : out.text) + (typeof tail === 'string' ? tail : tail.text);
      assert.ok(combined.includes('[REDACTED-EMAIL]'));
    });
  });

  // ── TTL Cleanup ────────────────────────────────────────────────────────────

  describe('TTL cleanup', () => {
    it('should expire idle scrubbers on cleanup()', () => {
      const registry = storeModule.createScrubberRegistry({ ttlMs: 50 });
      registry.getOrCreate('org-reg', 'session-1');

      // Wait for TTL to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          const expired = registry.cleanup();
          assert.ok(expired >= 1);
          assert.strictEqual(registry.get('org-reg', 'session-1'), null);
          resolve();
        }, 60);
      });
    });

    it('should NOT expire recently accessed scrubbers', () => {
      const registry = storeModule.createScrubberRegistry({ ttlMs: 100 });
      registry.getOrCreate('org-reg', 'session-1');

      return new Promise((resolve) => {
        setTimeout(() => {
          registry.touch('org-reg', 'session-1'); // Reset timer
          const expired = registry.cleanup();
          assert.strictEqual(expired, 0);
          assert.ok(registry.get('org-reg', 'session-1'));
          resolve();
        }, 60);
      });
    });

    it('should track totalExpired in stats', () => {
      const registry = storeModule.createScrubberRegistry({ ttlMs: 50 });
      registry.getOrCreate('org-reg', 'session-1');

      return new Promise((resolve) => {
        setTimeout(() => {
          registry.cleanup();
          const stats = registry.getStats();
          assert.ok(stats.totalExpired >= 1);
          resolve();
        }, 60);
      });
    });

    it('should update lastAccessedAt on touch()', () => {
      const registry = storeModule.createScrubberRegistry({ ttlMs: 1000 });
      registry.getOrCreate('org-reg', 'session-1');
      const statsBefore = registry.getStats();
      const accessTimeBefore = statsBefore.scrubbers[0].lastAccessedAt;

      return new Promise((resolve) => {
        setTimeout(() => {
          registry.touch('org-reg', 'session-1');
          const statsAfter = registry.getStats();
          const accessTimeAfter = statsAfter.scrubbers[0].lastAccessedAt;
          assert.ok(accessTimeAfter > accessTimeBefore);
          resolve();
        }, 20);
      });
    });
  });

  // ── Max Scrubbers / LRU Eviction ───────────────────────────────────────────

  describe('max scrubbers / LRU eviction', () => {
    it('should enforce maxScrubbers limit', () => {
      const registry = storeModule.createScrubberRegistry({ maxScrubbers: 3 });
      registry.getOrCreate('org-reg', 's1');
      registry.getOrCreate('org-reg', 's2');
      registry.getOrCreate('org-reg', 's3');
      // Adding a 4th should evict the LRU (s1)
      registry.getOrCreate('org-reg', 's4');

      const stats = registry.getStats();
      assert.strictEqual(stats.activeScrubbers, 3);
      assert.strictEqual(registry.get('org-reg', 's1'), null);
      assert.ok(registry.get('org-reg', 's4'));
    });

    it('should track totalEvicted in stats', () => {
      const registry = storeModule.createScrubberRegistry({ maxScrubbers: 2 });
      registry.getOrCreate('org-reg', 's1');
      registry.getOrCreate('org-reg', 's2');
      registry.getOrCreate('org-reg', 's3'); // Evicts s1

      const stats = registry.getStats();
      assert.ok(stats.totalEvicted >= 1);
    });

    it('should NOT evict when re-accessing existing scrubber', () => {
      const registry = storeModule.createScrubberRegistry({ maxScrubbers: 2 });
      registry.getOrCreate('org-reg', 's1');
      registry.getOrCreate('org-reg', 's2');

      // Re-access s1 — should move it to MRU
      registry.getOrCreate('org-reg', 's1');

      // Now add s3 — should evict s2 (LRU), not s1
      registry.getOrCreate('org-reg', 's3');

      assert.ok(registry.get('org-reg', 's1'));
      assert.strictEqual(registry.get('org-reg', 's2'), null);
    });
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  describe('stats', () => {
    it('should report activeScrubbers count', () => {
      const registry = storeModule.createScrubberRegistry();
      registry.getOrCreate('org-reg', 's1');
      registry.getOrCreate('org-reg', 's2');
      const stats = registry.getStats();
      assert.strictEqual(stats.activeScrubbers, 2);
    });

    it('should report maxScrubbers and ttlMs config', () => {
      const registry = storeModule.createScrubberRegistry({ maxScrubbers: 50, ttlMs: 30000 });
      const stats = registry.getStats();
      assert.strictEqual(stats.maxScrubbers, 50);
      assert.strictEqual(stats.ttlMs, 30000);
    });

    it('should report totalCreated', () => {
      const registry = storeModule.createScrubberRegistry();
      registry.getOrCreate('org-reg', 's1');
      registry.getOrCreate('org-reg', 's2');
      const stats = registry.getStats();
      assert.strictEqual(stats.totalCreated, 2);
    });

    it('should report per-scrubber details', () => {
      const registry = storeModule.createScrubberRegistry();
      registry.getOrCreate('org-reg', 'session-1');
      const stats = registry.getStats();
      assert.ok(stats.scrubbers.length >= 1);
      const detail = stats.scrubbers[0];
      assert.strictEqual(detail.orgId, 'org-reg');
      assert.strictEqual(detail.sessionId, 'session-1');
      assert.ok(typeof detail.createdAt === 'number');
      assert.ok(typeof detail.lastAccessedAt === 'number');
      assert.ok(typeof detail.idleMs === 'number');
      assert.ok(typeof detail.scrubberStats === 'object');
    });

    it('should report idleMs for each scrubber', () => {
      const registry = storeModule.createScrubberRegistry();
      registry.getOrCreate('org-reg', 'session-1');

      return new Promise((resolve) => {
        setTimeout(() => {
          const stats = registry.getStats();
          const detail = stats.scrubbers[0];
          assert.ok(detail.idleMs >= 10);
          resolve();
        }, 15);
      });
    });
  });

  // ── E2E: GET /api/audit/scrubber-stats ─────────────────────────────────────

  describe('E2E: GET /api/audit/scrubber-stats', () => {
    let request;
    let express;
    let adminApp;
    let regularApp;
    let noAuthApp;

    const ADMIN_USER = {
      id: 'admin@org-reg.com',
      email: 'admin@org-reg.com',
      role: 'admin',
      permissions: ['admin:all'],
    };

    const REGULAR_USER = {
      id: 'user@org-reg.com',
      email: 'user@org-reg.com',
      role: 'developer',
    };

    before(() => {
      request = require('supertest');
      express = require('express');

      jest.mock('../../middleware/auth.cjs', () => ({
        authenticate: function mockAuthenticate(req, res, next) {
          if (req.user) return next();
          return res.status(401).json({
            success: false,
            error: 'authentication_required',
            message: 'Authentication required',
          });
        },
      }));

      function createTestApp(user) {
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => {
          if (user) req.user = user;
          next();
        });
        const auditRoutes = require('../../routes/audit-routes.cjs');
        app.use('/api/audit', auditRoutes);
        return app;
      }

      adminApp = createTestApp(ADMIN_USER);
      regularApp = createTestApp(REGULAR_USER);
      noAuthApp = createTestApp(null);
    });

    it('should return scrubber stats for admin user', async () => {
      const res = await request(adminApp).get('/api/audit/scrubber-stats');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.activeScrubbers === 'number');
      assert.ok(typeof res.body.maxScrubbers === 'number');
      assert.ok(typeof res.body.ttlMs === 'number');
    });

    it('should reject non-admin user with 403', async () => {
      const res = await request(regularApp).get('/api/audit/scrubber-stats');
      assert.strictEqual(res.status, 403);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(noAuthApp).get('/api/audit/scrubber-stats');
      assert.strictEqual(res.status, 401);
    });
  });
});
