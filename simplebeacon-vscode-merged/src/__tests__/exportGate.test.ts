// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts — all findings are false positives
import * as crypto from 'crypto';
import {
  hashReport,
  canonicalJsonString,
  embedServerSignature,
  verifySignatureLocally,
  PREMIUM_EXPORT_TYPES,
  BASIC_EXPORT_TYPES,
  resolveSigningApiUrl,
  normalizeAccountTier,
  tierCanExport,
  minTierForExport,
  calculateSummary,
  filterFindingsForFreeTier,
  filterFindingsForDeveloperTier,
  buildFreeTierMarkdown,
  buildDeveloperTierJson,
  buildTeamTierJson,
  filterReportByTier,
  TIER_EXPORT_PERMISSIONS,
  type ServerSignature,
  type RawFinding,
} from '../exportGate';

// Generate an RSA key pair for verification tests
const testKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const sampleFindings: RawFinding[] = [
  { severity: 'critical', type: 'SQL Injection', file: 'src/db.ts', line: 42, description: 'Unsanitized input', id: 'SQL-001', matchedText: 'query(input)' },
  { severity: 'high', type: 'XSS', file: 'src/view.ts', line: 10, description: 'innerHTML assignment', id: 'XSS-002' },
  { severity: 'low', type: 'Style', file: 'src/css.ts', line: 5, description: 'Missing semicolon', id: 'STYLE-003' },
];

describe('exportGate', () => {
  describe('canonicalJsonString', () => {
    it('produces sorted-key JSON for objects', () => {
      expect(canonicalJsonString({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    });

    it('preserves array order', () => {
      expect(canonicalJsonString([3, 1, 2])).toBe('[3,1,2]');
    });

    it('canonicalizes nested objects', () => {
      expect(canonicalJsonString({ z: { y: 1, x: 2 }, a: 0 })).toBe(
        '{"a":0,"z":{"x":2,"y":1}}',
      );
    });

    it('handles primitives', () => {
      expect(canonicalJsonString('hi')).toBe('"hi"');
      expect(canonicalJsonString(42)).toBe('42');
      expect(canonicalJsonString(null)).toBe('null');
      expect(canonicalJsonString(true)).toBe('true');
    });
  });

  describe('hashReport', () => {
    it('returns a 64-char hex SHA-256', () => {
      const h = hashReport({ a: 1, b: 2 });
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic regardless of key order', () => {
      const h1 = hashReport({ a: 1, b: 2 });
      const h2 = hashReport({ b: 2, a: 1 });
      expect(h1).toBe(h2);
    });

    it('differs for different content', () => {
      const h1 = hashReport({ a: 1 });
      const h2 = hashReport({ a: 2 });
      expect(h1).not.toBe(h2);
    });

    it('matches a manual crypto SHA-256 of the canonical string', () => {
      const report = { b: 2, a: 1, nested: { d: 4, c: 3 } };
      const expected = crypto
        .createHash('sha256')
        .update('{"a":1,"b":2,"nested":{"c":3,"d":4}}', 'utf8')
        .digest('hex');
      expect(hashReport(report)).toBe(expected);
    });
  });

  describe('embedServerSignature', () => {
    it('adds a serverSignature field without mutating the original', () => {
      const report = { qualityScore: 80, findings: [] };
      const sig: ServerSignature = {
        signature: 'abc123',
        signedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-01-08T00:00:00Z',
        tier: 'pro',
        serverKeyId: 'sb-edge-v1',
        user: { sub: 'user-1', email: 'u@example.com' },
        metadata: {
          reportHash: hashReport(report),
          reportType: 'certificate',
          tier: 'pro',
          userSub: 'user-1',
          signedAt: '2026-01-01T00:00:00Z',
          serverKeyId: 'sb-edge-v1',
        },
      };
      const embedded = embedServerSignature(report, sig);
      expect((embedded as any).serverSignature).toBe(sig);
      expect((report as any).serverSignature).toBeUndefined();
    });
  });

  describe('PREMIUM_EXPORT_TYPES / BASIC_EXPORT_TYPES', () => {
    it('marks certificate as premium', () => {
      expect(PREMIUM_EXPORT_TYPES.has('certificate')).toBe(true);
    });

    it('marks report-json as premium', () => {
      expect(PREMIUM_EXPORT_TYPES.has('report-json')).toBe(true);
    });

    it('marks diagnostic-log as basic', () => {
      expect(BASIC_EXPORT_TYPES.has('diagnostic-log')).toBe(true);
    });

    it('marks code-map as basic', () => {
      expect(BASIC_EXPORT_TYPES.has('code-map')).toBe(true);
    });

    it('does not overlap premium and basic sets', () => {
      for (const t of PREMIUM_EXPORT_TYPES) {
        expect(BASIC_EXPORT_TYPES.has(t as any)).toBe(false);
      }
    });
  });

  describe('resolveSigningApiUrl', () => {
    it('returns a URL string', () => {
      const url = resolveSigningApiUrl();
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      expect(() => new URL(url)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------
  // Phase 1: 3-tier data filtering tests
  // ---------------------------------------------------------------
  describe('normalizeAccountTier', () => {
    it('maps free aliases to free', () => {
      expect(normalizeAccountTier('free')).toBe('free');
      expect(normalizeAccountTier('community')).toBe('free');
      expect(normalizeAccountTier('sandbox')).toBe('free');
      expect(normalizeAccountTier('')).toBe('free');
      expect(normalizeAccountTier(undefined)).toBe('free');
    });

    it('maps developer aliases to developer', () => {
      expect(normalizeAccountTier('developer')).toBe('developer');
      expect(normalizeAccountTier('pro')).toBe('developer');
      expect(normalizeAccountTier('startup')).toBe('developer');
      expect(normalizeAccountTier('developer_tier')).toBe('developer');
    });

    it('maps team aliases to team', () => {
      expect(normalizeAccountTier('team')).toBe('team');
      expect(normalizeAccountTier('team_pro')).toBe('team');
      expect(normalizeAccountTier('growth')).toBe('team');
    });

    it('maps enterprise aliases to enterprise', () => {
      expect(normalizeAccountTier('enterprise')).toBe('enterprise');
      expect(normalizeAccountTier('compliance')).toBe('enterprise');
      expect(normalizeAccountTier('admin')).toBe('enterprise');
    });

    it('defaults unknown tiers to free', () => {
      expect(normalizeAccountTier('unknown_tier')).toBe('free');
    });
  });

  describe('tierCanExport', () => {
    it('allows free tier to export markdown', () => {
      expect(tierCanExport('free', 'report-markdown')).toBe(true);
    });

    it('denies free tier from exporting JSON', () => {
      expect(tierCanExport('free', 'report-json')).toBe(false);
    });

    it('denies free tier from exporting certificates', () => {
      expect(tierCanExport('free', 'certificate')).toBe(false);
    });

    it('allows developer tier to export JSON', () => {
      expect(tierCanExport('developer', 'report-json')).toBe(true);
    });

    it('allows developer tier to export certificates', () => {
      expect(tierCanExport('developer', 'certificate')).toBe(true);
    });

    it('denies developer tier from exporting PDF (board-ready)', () => {
      expect(tierCanExport('developer', 'report-pdf')).toBe(false);
    });

    it('allows team tier to export PDF', () => {
      expect(tierCanExport('team', 'report-pdf')).toBe(true);
    });

    it('allows team tier to export trust reports', () => {
      expect(tierCanExport('team', 'trust-report')).toBe(true);
    });

    it('allows enterprise tier to export everything', () => {
      expect(tierCanExport('enterprise', 'report-pdf')).toBe(true);
      expect(tierCanExport('enterprise', 'certificate')).toBe(true);
      expect(tierCanExport('enterprise', 'email-report')).toBe(true);
    });
  });

  describe('minTierForExport', () => {
    it('returns free for basic exports', () => {
      expect(minTierForExport('report-markdown')).toBe('free');
      expect(minTierForExport('diagnostic-log')).toBe('free');
    });

    it('returns developer for JSON and certificates', () => {
      expect(minTierForExport('report-json')).toBe('developer');
      expect(minTierForExport('certificate')).toBe('developer');
    });

    it('returns team for PDF and board-ready exports', () => {
      expect(minTierForExport('report-pdf')).toBe('team');
      expect(minTierForExport('trust-report')).toBe('team');
      expect(minTierForExport('email-report')).toBe('team');
    });
  });

  describe('calculateSummary', () => {
    it('counts findings by severity', () => {
      const m = calculateSummary(sampleFindings);
      expect(m.totalCount).toBe(3);
      expect(m.criticalCount).toBe(1);
      expect(m.highCount).toBe(1);
      expect(m.lowCount).toBe(1);
    });

    it('computes a quality score', () => {
      const m = calculateSummary(sampleFindings);
      expect(m.score).toBe(100 - (1 * 25 + 1 * 15 + 0 * 5 + 1 * 2));
      expect(m.score).toBe(58);
    });

    it('clamps score to 0', () => {
      const manyCritical = Array(10).fill({ severity: 'critical' });
      const m = calculateSummary(manyCritical);
      expect(m.score).toBe(0);
    });
  });

  describe('filterFindingsForFreeTier', () => {
    it('strips file paths and line numbers', () => {
      const filtered = filterFindingsForFreeTier(sampleFindings);
      expect(filtered).toHaveLength(3);
      expect(filtered[0].severity).toBe('critical');
      expect(filtered[0].type).toBe('SQL Injection');
      expect(filtered[0].description).toBe('Unsanitized input');
      // No file path or line number fields
      expect((filtered[0] as any).file).toBeUndefined();
      expect((filtered[0] as any).line).toBeUndefined();
      expect((filtered[0] as any).filePath).toBeUndefined();
    });
  });

  describe('filterFindingsForDeveloperTier', () => {
    it('keeps file paths and line numbers', () => {
      const filtered = filterFindingsForDeveloperTier(sampleFindings);
      expect(filtered).toHaveLength(3);
      expect(filtered[0].filePath).toBe('src/db.ts');
      expect(filtered[0].line).toBe(42);
      expect(filtered[0].ruleId).toBe('SQL-001');
      expect(filtered[0].snippet).toBe('query(input)');
    });
  });

  describe('buildFreeTierMarkdown', () => {
    it('produces markdown with summary but no file paths', () => {
      const md = buildFreeTierMarkdown(sampleFindings, { projectRoot: 'my-project' });
      expect(md).toContain('# SimpleBeacon Scan Summary');
      expect(md).toContain('Quality Score');
      expect(md).toContain('Critical: 1');
      expect(md).toContain('Upgrade');
      // Must NOT contain file paths
      expect(md).not.toContain('src/db.ts');
      expect(md).not.toContain('src/view.ts');
    });
  });

  describe('buildDeveloperTierJson', () => {
    it('produces JSON with file paths and line numbers', () => {
      const json = buildDeveloperTierJson(sampleFindings, { projectRoot: 'my-project' });
      const parsed = JSON.parse(json);
      expect(parsed.meta.tier).toBe('Developer');
      expect(parsed.findings).toHaveLength(3);
      expect(parsed.findings[0].filePath).toBe('src/db.ts');
      expect(parsed.findings[0].line).toBe(42);
    });
  });

  describe('buildTeamTierJson', () => {
    it('produces JSON with compliance metadata', () => {
      const json = buildTeamTierJson(sampleFindings, { projectRoot: 'my-project' }, {
        euAiAct: { status: 'evaluating' },
      });
      const parsed = JSON.parse(json);
      expect(parsed.meta.tier).toBe('Team Pro');
      expect(parsed.meta.complianceReady).toBe(true);
      expect(parsed.complianceMappings).toBeDefined();
      expect(parsed.findings[0].filePath).toBe('src/db.ts');
    });
  });

  describe('filterReportByTier', () => {
    it('strips findings for free tier', () => {
      const report = { findings: sampleFindings, qualityScore: 58 };
      const filtered = filterReportByTier(report, 'free');
      expect((filtered as any).findings[0].severity).toBe('critical');
      expect((filtered as any).findings[0].file).toBeUndefined();
    });

    it('keeps file paths for developer tier', () => {
      const report = { findings: sampleFindings, qualityScore: 58 };
      const filtered = filterReportByTier(report, 'developer');
      expect((filtered as any).findings[0].filePath).toBe('src/db.ts');
    });

    it('returns full report for team tier', () => {
      const report = { findings: sampleFindings, qualityScore: 58 };
      const filtered = filterReportByTier(report, 'team');
      // Team tier gets the original report unchanged
      expect(filtered).toEqual(report);
    });

    it('handles reports with no findings', () => {
      const report = { qualityScore: 100 };
      const filtered = filterReportByTier(report, 'free');
      expect(filtered).toEqual(report);
    });
  });

  describe('TIER_EXPORT_PERMISSIONS', () => {
    it('free tier has fewer exports than developer', () => {
      expect(TIER_EXPORT_PERMISSIONS.free.size).toBeLessThan(TIER_EXPORT_PERMISSIONS.developer.size);
    });

    it('developer tier has fewer exports than team', () => {
      expect(TIER_EXPORT_PERMISSIONS.developer.size).toBeLessThan(TIER_EXPORT_PERMISSIONS.team.size);
    });

    it('team and enterprise have the same exports', () => {
      expect(TIER_EXPORT_PERMISSIONS.team.size).toBe(TIER_EXPORT_PERMISSIONS.enterprise.size);
    });
  });

  // ---------------------------------------------------------------
  // Phase 2: RSA signature verification tests
  // ---------------------------------------------------------------
  describe('verifySignatureLocally (RSA)', () => {
    it('verifies a valid RSA signature', () => {
      const metadata = {
        reportHash: hashReport({ test: 'data' }),
        reportType: 'certificate' as const,
        tier: 'developer',
        userSub: 'user-123',
        signedAt: '2026-01-01T00:00:00Z',
      };
      // Sign with the test private key
      const canonical = canonicalJsonString({
        reportHash: metadata.reportHash,
        reportType: metadata.reportType,
        tier: metadata.tier,
        userSub: metadata.userSub,
        signedAt: metadata.signedAt,
      });
      const signer = crypto.createSign('SHA256');
      signer.update(canonical, 'utf8');
      const signature = signer.sign(testKeyPair.privateKey, 'hex');

      // Verify with the public key
      const isValid = verifySignatureLocally(signature, metadata, testKeyPair.publicKey);
      expect(isValid).toBe(true);
    });

    it('rejects a tampered signature', () => {
      const metadata = {
        reportHash: hashReport({ test: 'data' }),
        reportType: 'certificate' as const,
        tier: 'developer',
        userSub: 'user-123',
        signedAt: '2026-01-01T00:00:00Z',
      };
      const isValid = verifySignatureLocally('tampered-signature', metadata, testKeyPair.publicKey);
      expect(isValid).toBe(false);
    });

    it('rejects a signature with tampered metadata', () => {
      const metadata = {
        reportHash: hashReport({ test: 'data' }),
        reportType: 'certificate' as const,
        tier: 'developer',
        userSub: 'user-123',
        signedAt: '2026-01-01T00:00:00Z',
      };
      // Sign with original metadata
      const canonical = canonicalJsonString({
        reportHash: metadata.reportHash,
        reportType: metadata.reportType,
        tier: metadata.tier,
        userSub: metadata.userSub,
        signedAt: metadata.signedAt,
      });
      const signer = crypto.createSign('SHA256');
      signer.update(canonical, 'utf8');
      const signature = signer.sign(testKeyPair.privateKey, 'hex');

      // Verify with tampered metadata (different tier)
      const tamperedMetadata = { ...metadata, tier: 'enterprise' };
      const isValid = verifySignatureLocally(signature, tamperedMetadata, testKeyPair.publicKey);
      expect(isValid).toBe(false);
    });

    it('rejects with an invalid public key', () => {
      const metadata = {
        reportHash: hashReport({ test: 'data' }),
        reportType: 'certificate' as const,
        tier: 'developer',
        userSub: 'user-123',
        signedAt: '2026-01-01T00:00:00Z',
      };
      const isValid = verifySignatureLocally('any-signature', metadata, 'not-a-valid-key');
      expect(isValid).toBe(false);
    });
  });
});
