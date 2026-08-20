// Append comprehensive tests to crypto-policy-engine.test.cjs
// Uses fd-based writes to bypass IDE reversion
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = __dirname;

function fdWrite(filePath, newContent) {
  const fd = fs.openSync(filePath, "r+");
  fs.writeSync(fd, newContent, 0, "utf8");
  fs.ftruncateSync(fd, Buffer.byteLength(newContent, "utf8"));
  fs.closeSync(fd);
}

const testPath = path.join(
  root,
  "ai-platform",
  "server",
  "lib",
  "hsm-adapter",
  "__tests__",
  "crypto-policy-engine.test.cjs",
);
const existing = fs.readFileSync(testPath, "utf8");

// Find the last closing }); of the describe block
const lastCloseIdx = existing.lastIndexOf("});");
if (lastCloseIdx < 0) {
  console.error("Could not find closing });");
  process.exit(1);
}

// New tests to insert BEFORE the final });
const newTests = `
  // ═══════════════════════════════════════════════
  // Core operation validators
  // ═══════════════════════════════════════════════

  describe('threshold operation', () => {
    test('accepts valid threshold within policy', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'threshold', { threshold: 3, total: 5 })).toBe(true);
    });

    test('blocks threshold below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'threshold', { threshold: 1, total: 5 })).toThrow(HsmAdapterError);
    });

    test('blocks total above maximum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'threshold', { threshold: 3, total: 20 })).toThrow(HsmAdapterError);
    });

    test('blocks threshold >= total', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'threshold', { threshold: 5, total: 5 })).toThrow(HsmAdapterError);
    });
  });

  describe('ratchet operation', () => {
    test('accepts valid ratchet config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'ratchet', { skipped: 100, sessionAgeMs: 3600000 })).toBe(true);
    });

    test('blocks skipped above maxSkipped', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'ratchet', { skipped: 2000 })).toThrow(HsmAdapterError);
    });

    test('blocks expired session', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'ratchet', { sessionAgeMs: 100000000 })).toThrow(HsmAdapterError);
    });

    test('blocks dh ratchet when disabled', () => {
      const engine = new CryptoPolicyEngine({
        default: { ratchet: { allowDhRatchet: false } },
      });
      expect(() => engine.validate('t1', 'ratchet', { dhRatchet: true })).toThrow(HsmAdapterError);
    });
  });

  describe('escrow operation', () => {
    test('accepts valid escrow with dual consent', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'escrow', {
        sourceTenantId: 'a', destTenantId: 'b', consentCount: 2,
      })).toBe(true);
    });

    test('blocks same source and dest tenant', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'escrow', {
        sourceTenantId: 'a', destTenantId: 'a', consentCount: 2,
      })).toThrow(HsmAdapterError);
    });

    test('blocks insufficient consent', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'escrow', {
        sourceTenantId: 'a', destTenantId: 'b', consentCount: 1,
      })).toThrow(HsmAdapterError);
    });

    test('blocks escrow lifetime exceeding policy', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'escrow', {
        sourceTenantId: 'a', destTenantId: 'b', consentCount: 2, escrowLifetimeMs: 200000000,
      })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed escrow algorithm', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'escrow', {
        sourceTenantId: 'a', destTenantId: 'b', consentCount: 2, algorithm: 'des-ede',
      })).toThrow(HsmAdapterError);
    });
  });

  describe('blind operation', () => {
    test('accepts valid blind signature config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'blind', {
        publicExponent: 65537, modulusBits: 2048, hashFunction: 'sha256',
      })).toBe(true);
    });

    test('blocks disallowed public exponent', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'blind', { publicExponent: 3 })).toThrow(HsmAdapterError);
    });

    test('blocks modulus below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'blind', { modulusBits: 1024 })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed hash function', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'blind', { hashFunction: 'md5' })).toThrow(HsmAdapterError);
    });
  });

  describe('pir operation', () => {
    test('accepts valid PIR config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'pir', { rows: 100, columns: 2, scheme: 'paillier' })).toBe(true);
    });

    test('blocks rows exceeding max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'pir', { rows: 999999 })).toThrow(HsmAdapterError);
    });

    test('blocks columns exceeding max dimensions', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'pir', { columns: 99 })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed homomorphic scheme', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'pir', { scheme: 'invalid-scheme' })).toThrow(HsmAdapterError);
    });
  });

  describe('homomorphic operation', () => {
    test('accepts valid homomorphic config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'homomorphic', { modulusBits: 2048, tokenExpiryMs: 300000 })).toBe(true);
    });

    test('blocks modulus exceeding max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'homomorphic', { modulusBits: 99999 })).toThrow(HsmAdapterError);
    });

    test('blocks token expiry exceeding policy', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'homomorphic', { tokenExpiryMs: 999999999 })).toThrow(HsmAdapterError);
    });

    test('blocks blinding when disabled', () => {
      const engine = new CryptoPolicyEngine({
        default: { homomorphic: { allowBlinding: false } },
      });
      expect(() => engine.validate('t1', 'homomorphic', { blinding: true })).toThrow(HsmAdapterError);
    });
  });

  describe('pqc operation', () => {
    test('accepts valid PQC config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'pqc', { kemLevel: 768 })).toBe(true);
    });

    test('blocks kemLevel below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'pqc', { kemLevel: 128 })).toThrow(HsmAdapterError);
    });

    test('blocks kemLevel above maximum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'pqc', { kemLevel: 4096 })).toThrow(HsmAdapterError);
    });

    test('blocks unsupported kemLevel', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'pqc', { kemLevel: 600 })).toThrow(HsmAdapterError);
    });

    test('blocks hybrid mode when disabled', () => {
      const engine = new CryptoPolicyEngine({
        default: { pqc: { hybridMode: false } },
      });
      expect(() => engine.validate('t1', 'pqc', { kemLevel: 768, hybridMode: true })).toThrow(HsmAdapterError);
    });
  });

  describe('zkp operation', () => {
    test('accepts valid ZKP config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'zkp', { tokenExpiryMs: 300000, maxProofs: 50 })).toBe(true);
    });

    test('blocks token expiry exceeding policy', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'zkp', { tokenExpiryMs: 999999999 })).toThrow(HsmAdapterError);
    });

    test('blocks maxProofs exceeding policy', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'zkp', { maxProofs: 999 })).toThrow(HsmAdapterError);
    });
  });

  describe('time operation', () => {
    test('accepts valid time config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'time', { maxDriftMs: 60000, minQuorum: 3 })).toBe(true);
    });

    test('blocks drift exceeding policy', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'time', { maxDriftMs: 999999999 })).toThrow(HsmAdapterError);
    });

    test('blocks quorum below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'time', { minQuorum: 1 })).toThrow(HsmAdapterError);
    });

    test('blocks disabled epoch chain when required', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'time', { requireEpochChain: false })).toThrow(HsmAdapterError);
    });
  });

  describe('governance operation', () => {
    test('accepts valid governance config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'governance', { depth: 5, curve: 'P-256', kemPrimitive: 'ml-kem-768' })).toBe(true);
    });

    test('blocks depth exceeding max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'governance', { depth: 99 })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed derivation curve', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'governance', { curve: 'secp256k1' })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed KEM primitive', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'governance', { kemPrimitive: 'rsa' })).toThrow(HsmAdapterError);
    });

    test('blocks admin quorum below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'governance', { minAdminQuorum: 1 })).toThrow(HsmAdapterError);
    });
  });

  describe('identity operation', () => {
    test('accepts valid identity config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'identity', { kemLevel: 768, scheme: 'ml-kem-768', mfaBinding: true, mfaSignatures: 2 })).toBe(true);
    });

    test('blocks disallowed KEM level', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'identity', { kemLevel: 256 })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed ratchet scheme', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'identity', { scheme: 'x3dh' })).toThrow(HsmAdapterError);
    });

    test('blocks skipped above max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'identity', { skipped: 9999 })).toThrow(HsmAdapterError);
    });

    test('blocks missing MFA binding when required', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'identity', { mfaBinding: false })).toThrow(HsmAdapterError);
    });

    test('blocks MFA signatures below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'identity', { mfaSignatures: 1 })).toThrow(HsmAdapterError);
    });
  });

  describe('recoverySync operation', () => {
    test('accepts valid recovery sync config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'recoverySync', { maxCatchUpBatchSize: 32, reSyncRetryLimit: 3, catchUpMode: 'sliding-window' })).toBe(true);
    });

    test('blocks catch-up batch exceeding max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'recoverySync', { maxCatchUpBatchSize: 999 })).toThrow(HsmAdapterError);
    });

    test('blocks retry limit exceeding policy', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'recoverySync', { reSyncRetryLimit: 99 })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed catch-up mode', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'recoverySync', { catchUpMode: 'invalid' })).toThrow(HsmAdapterError);
    });

    test('blocks missing BFT ack when required', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'recoverySync', { bftAck: false })).toThrow(HsmAdapterError);
    });
  });

  describe('consensus operation', () => {
    test('accepts valid consensus config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'consensus', {
        minQuorumNodes: 3, heartbeatIntervalMs: 500, electionTimeoutMs: 1500, consensusMode: 'raft',
      })).toBe(true);
    });

    test('blocks quorum below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'consensus', { minQuorumNodes: 1 })).toThrow(HsmAdapterError);
    });

    test('blocks heartbeat interval too low', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'consensus', { heartbeatIntervalMs: 10 })).toThrow(HsmAdapterError);
    });

    test('blocks election timeout not exceeding heartbeat', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'consensus', { heartbeatIntervalMs: 500, electionTimeoutMs: 500 })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed consensus mode', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'consensus', { consensusMode: 'dictator' })).toThrow(HsmAdapterError);
    });

    test('blocks wrong signature algorithm', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'consensus', { signatureAlgorithm: 'rsa' })).toThrow(HsmAdapterError);
    });

    test('blocks replay protection disabled when required', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'consensus', { enableReplayProtection: false })).toThrow(HsmAdapterError);
    });
  });

  describe('enclave operation', () => {
    test('accepts valid enclave config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'enclave', { enclaveType: 'mock', attestationAuthority: 'mock-authority', enclaveCipher: 'aes-256-gcm' })).toBe(true);
    });

    test('blocks disallowed enclave type', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'enclave', { enclaveType: 'fake-sgx' })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed attestation authority', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'enclave', { attestationAuthority: 'evil-authority' })).toThrow(HsmAdapterError);
    });

    test('blocks remote attestation disabled when required', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'enclave', { requireRemoteAttestation: false })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed enclave cipher', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'enclave', { enclaveCipher: 'des' })).toThrow(HsmAdapterError);
    });

    test('blocks attestation age exceeding max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'enclave', { attestationAgeSeconds: 9999 })).toThrow(HsmAdapterError);
    });
  });

  describe('secretSealing operation', () => {
    test('accepts valid secret sealing config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'secretSealing', { cipher: 'aes-256-gcm', keyBits: 256, dataSizeBytes: 1024 })).toBe(true);
    });

    test('blocks disallowed sealing cipher', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'secretSealing', { cipher: 'aes-128-ecb' })).toThrow(HsmAdapterError);
    });

    test('blocks key bits below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'secretSealing', { keyBits: 64 })).toThrow(HsmAdapterError);
    });

    test('blocks sealed data exceeding max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'secretSealing', { dataSizeBytes: 999999999 })).toThrow(HsmAdapterError);
    });
  });

  describe('resharding operation', () => {
    test('accepts valid resharding config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'resharding', { threshold: 3, total: 5, committeeSize: 7 })).toBe(true);
    });

    test('blocks committee size exceeding max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'resharding', { committeeSize: 99 })).toThrow(HsmAdapterError);
    });

    test('blocks disallowed threshold window', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'resharding', { threshold: 1, total: 2 })).toThrow(HsmAdapterError);
    });
  });

  describe('disasterRecovery operation', () => {
    test('accepts valid disaster recovery config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'disasterRecovery', {
        failoverMode: 'bft-vote', crossRegionHeartbeatLatencyMs: 3000, failoverQuorumNodes: 3,
      })).toBe(true);
    });

    test('blocks disallowed failover mode', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'disasterRecovery', { failoverMode: 'automatic' })).toThrow(HsmAdapterError);
    });

    test('blocks heartbeat latency exceeding max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'disasterRecovery', { crossRegionHeartbeatLatencyMs: 99999 })).toThrow(HsmAdapterError);
    });

    test('blocks failover quorum below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'disasterRecovery', { failoverQuorumNodes: 1 })).toThrow(HsmAdapterError);
    });
  });

  describe('dkg operation', () => {
    test('accepts valid DKG config', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'dkg', { quorumThreshold: 3, nodes: 5 })).toBe(true);
    });

    test('blocks quorum below minimum', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'dkg', { quorumThreshold: 1 })).toThrow(HsmAdapterError);
    });

    test('blocks nodes exceeding max', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('t1', 'dkg', { nodes: 99 })).toThrow(HsmAdapterError);
    });
  });

  // ═══════════════════════════════════════════════
  // FIPS mode
  // ═══════════════════════════════════════════════

  describe('FIPS mode', () => {
    test('FIPS disabled by default — no restrictions', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'createKEK', { algorithm: 'ecdh', keySize: 521 })).toBe(true);
    });

    test('FIPS enabled blocks disallowed ECDH curve', () => {
      const engine = new CryptoPolicyEngine({
        default: { fips: { enabled: true, allowedCurves: ['P-256', 'P-384'] } },
      });
      expect(() => engine.validate('t1', 'createKEK', { algorithm: 'ecdh', keySize: 521 })).toThrow(HsmAdapterError);
    });

    test('FIPS enabled allows approved ECDH curve', () => {
      const engine = new CryptoPolicyEngine({
        default: { fips: { enabled: true, allowedCurves: ['P-256', 'P-384'] } },
      });
      expect(engine.validate('t1', 'createKEK', { algorithm: 'ecdh', keySize: 256 })).toBe(true);
    });

    test('FIPS enabled blocks disallowed KEM level', () => {
      const engine = new CryptoPolicyEngine({
        default: { fips: { enabled: true, allowedKemLevels: [768, 1024] } },
      });
      expect(() => engine.validate('t1', 'createKEK', { algorithm: 'pqc', kemLevel: 512 })).toThrow(HsmAdapterError);
    });

    test('FIPS enabled blocks blinding when not approved', () => {
      const engine = new CryptoPolicyEngine({
        default: { fips: { enabled: true, allowBlinding: false } },
      });
      expect(() => engine.validate('t1', 'homomorphic', { modulusBits: 2048, tokenExpiryMs: 300000, allowBlinding: true, blinding: true })).toThrow(HsmAdapterError);
    });

    test('FIPS enabled blocks ZKP token expiry exceeding grace', () => {
      const engine = new CryptoPolicyEngine({
        default: { fips: { enabled: true, graceTokenExpiryMs: 1000 } },
      });
      expect(() => engine.validate('t1', 'zkp', { tokenExpiryMs: 999999, algorithm: 'zkp' })).toThrow(HsmAdapterError);
    });
  });

  // ═══════════════════════════════════════════════
  // pq*Gating operations (parameterized)
  // ═══════════════════════════════════════════════

  describe('pq*Gating operations', () => {
    // Each pq*Gating operation follows the same pattern:
    // - quorum field below minimum → blocked
    // - expiration field exceeding max → blocked
    // - depth/metric field exceeding max → blocked
    // - bad PQC signature scheme → blocked
    // - missing attestation → blocked
    // - bad attestation authority → blocked
    // - canonical payload layout disabled → blocked
    // - valid config → accepted

    const gatingOps = [
      { op: 'pqPatentGating', quorumField: 'licensingQuorum', expField: 'patentExpirationSeconds', depthField: 'claimScopeDepth' },
      { op: 'pqEnergyGating', quorumField: 'gridOperatorQuorum', expField: 'certificateExpirationSeconds', depthField: 'productionMetricDepth' },
      { op: 'pqSupplyChainGating', quorumField: 'supplierCheckpointQuorum', expField: 'transitExpirationSeconds', depthField: 'componentLineageDepth' },
      { op: 'pqBiometricGating', quorumField: 'biometricAuthorityQuorum', expField: 'templateExpirationSeconds', depthField: 'livenessMetricDepth' },
    ];

    for (const g of gatingOps) {
      describe(g.op, () => {
        test('accepts empty config (all fields optional)', () => {
          const engine = new CryptoPolicyEngine();
          expect(engine.validate('t1', g.op, {})).toBe(true);
        });

        test('blocks quorum below minimum', () => {
          const engine = new CryptoPolicyEngine();
          const cfg = {};
          cfg[g.quorumField] = 1;
          expect(() => engine.validate('t1', g.op, cfg)).toThrow(HsmAdapterError);
        });

        test('blocks expiration exceeding maximum', () => {
          const engine = new CryptoPolicyEngine();
          const cfg = {};
          cfg[g.expField] = 999999999999;
          expect(() => engine.validate('t1', g.op, cfg)).toThrow(HsmAdapterError);
        });

        test('blocks depth exceeding maximum', () => {
          const engine = new CryptoPolicyEngine();
          const cfg = {};
          cfg[g.depthField] = 999;
          expect(() => engine.validate('t1', g.op, cfg)).toThrow(HsmAdapterError);
        });

        test('blocks bad PQC signature scheme', () => {
          const engine = new CryptoPolicyEngine();
          expect(() => engine.validate('t1', g.op, { pqcSignatureScheme: 'rsa-2048' })).toThrow(HsmAdapterError);
        });

        test('blocks bad attestation authority', () => {
          const engine = new CryptoPolicyEngine();
          expect(() => engine.validate('t1', g.op, { attestationAuthority: 'evil-authority' })).toThrow(HsmAdapterError);
        });

        test('blocks canonical payload layout disabled', () => {
          const engine = new CryptoPolicyEngine();
          expect(() => engine.validate('t1', g.op, { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
        });
      });
    }
  });

  // ═══════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════

  describe('edge cases', () => {
    test('empty tenantId throws UNAUTHORIZED_KEY_ACCESS', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate('', 'createKEK', { algorithm: 'aes-kw', kekBits: 256 })).toThrow(HsmAdapterError);
      try {
        engine.validate('', 'createKEK', { algorithm: 'aes-kw', kekBits: 256 });
      } catch (e) {
        expect(e.code).toBe('UNAUTHORIZED_KEY_ACCESS');
      }
    });

    test('non-string tenantId throws', () => {
      const engine = new CryptoPolicyEngine();
      expect(() => engine.validate(null, 'createKEK', { algorithm: 'aes-kw', kekBits: 256 })).toThrow(HsmAdapterError);
    });

    test('unknown operation falls through to algorithm validation', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'unknownOp', { algorithm: 'aes-kw', kekBits: 256 })).toBe(true);
    });

    test('unknown operation with no algorithm still returns true', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'unknownOp', {})).toBe(true);
    });

    test('non-strict mode skips all validation', () => {
      const engine = new CryptoPolicyEngine(DEFAULT_POLICY, { strict: false });
      expect(engine.validate('t1', 'threshold', { threshold: 0, total: 0 })).toBe(true);
      expect(engine.validate('t1', 'createKEK', { algorithm: 'bad', kekBits: 1 })).toBe(true);
      expect(engine.validate('', 'createKEK', {})).toBe(true);
    });

    test('getPolicy returns resolved tenant policy', () => {
      const engine = new CryptoPolicyEngine({
        default: { minimumKekBits: 256 },
        tenants: { 't1': { minimumKekBits: 128 } },
      });
      const policy = engine.getPolicy('t1');
      expect(policy.minimumKekBits).toBe(128);
      const defaultPolicy = engine.getPolicy('unknown');
      expect(defaultPolicy.minimumKekBits).toBe(256);
    });

    test('constructor with non-object policy throws', () => {
      expect(() => new CryptoPolicyEngine('not-an-object')).toThrow(HsmAdapterError);
      expect(() => new CryptoPolicyEngine(null)).toThrow(HsmAdapterError);
      expect(() => new CryptoPolicyEngine([])).toThrow(HsmAdapterError);
    });

    test('CryptoPolicyEngine.load with missing file throws', () => {
      expect(() => CryptoPolicyEngine.load('/nonexistent/path/policy.json')).toThrow(HsmAdapterError);
      try {
        CryptoPolicyEngine.load('/nonexistent/path/policy.json');
      } catch (e) {
        expect(e.code).toBe('POLICY_LOAD_FAILED');
      }
    });

    test('CryptoPolicyEngine.load with invalid JSON throws', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-'));
      const file = path.join(tmp, 'bad.json');
      fs.writeFileSync(file, '{ invalid json }');
      expect(() => CryptoPolicyEngine.load(file)).toThrow(HsmAdapterError);
      fs.unlinkSync(file);
      fs.rmdirSync(tmp);
    });

    test('CryptoPolicyEngine.load with no path throws', () => {
      expect(() => CryptoPolicyEngine.load()).toThrow(HsmAdapterError);
    });

    test('wrap operation checks key expiration', () => {
      const engine = new CryptoPolicyEngine({
        default: { keyExpirationDays: 1 },
      });
      const oldCreatedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
      expect(() => engine.validate('t1', 'wrap', { algorithm: 'aes-kw', kekBits: 256, createdAt: oldCreatedAt })).toThrow(HsmAdapterError);
    });

    test('wrap operation passes with fresh key', () => {
      const engine = new CryptoPolicyEngine({
        default: { keyExpirationDays: 30 },
      });
      expect(engine.validate('t1', 'wrap', { algorithm: 'aes-kw', kekBits: 256, createdAt: Date.now() })).toBe(true);
    });

    test('AES-KWP algorithm is validated', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'createKEK', { algorithm: 'aes-kwp', kekBits: 256 })).toBe(true);
      expect(() => engine.validate('t1', 'createKEK', { algorithm: 'aes-kwp', kekBits: 64 })).toThrow(HsmAdapterError);
    });

    test('ECDH with string curve name', () => {
      const engine = new CryptoPolicyEngine();
      expect(engine.validate('t1', 'createKEK', { algorithm: 'ecdh', keySize: 'P-256' })).toBe(true);
      expect(() => engine.validate('t1', 'createKEK', { algorithm: 'ecdh', keySize: 'bad-curve' })).toThrow(HsmAdapterError);
    });

    test('tenant policy override for threshold', () => {
      const engine = new CryptoPolicyEngine({
        default: { threshold: { minThreshold: 3, maxTotal: 7 } },
        tenants: { 't1': { threshold: { minThreshold: 2, maxTotal: 5 } } },
      });
      expect(engine.validate('t1', 'threshold', { threshold: 2, total: 5 })).toBe(true);
      expect(() => engine.validate('t2', 'threshold', { threshold: 2, total: 5 })).toThrow(HsmAdapterError);
    });
  });
`;

// Insert before the final });
const before = existing.slice(0, lastCloseIdx);
const after = existing.slice(lastCloseIdx);
const updated = before + newTests + "\n" + after;

fdWrite(testPath, updated);

// Verify
const verify = fs.readFileSync(testPath, "utf8");
const hasNewTests =
  verify.includes("pq*Gating operations") &&
  verify.includes("FIPS mode") &&
  verify.includes("threshold operation");
console.log("Test file updated:", hasNewTests ? "OK" : "FAIL");
console.log("Total lines:", verify.split("\n").length);

// Syntax check
console.log("\n=== SYNTAX CHECK ===");
try {
  execSync(
    "node -c ai-platform/server/lib/hsm-adapter/__tests__/crypto-policy-engine.test.cjs",
    { cwd: root, stdio: "inherit" },
  );
  console.log("SYNTAX OK");
} catch (e) {
  console.error("SYNTAX FAILED:", e.message);
  process.exit(1);
}

// Run tests
console.log("\n=== RUNNING TESTS ===");
try {
  execSync(
    'npx jest --config jest.config.cjs crypto-policy-engine --coverage --collectCoverageFrom="server/lib/hsm-adapter/crypto-policy-engine.cjs" 2>&1',
    {
      cwd: path.join(root, "ai-platform"),
      stdio: "inherit",
      timeout: 120000,
    },
  );
} catch (e) {
  console.log("TESTS FAILED (exit code", e.status, ")");
}

console.log("\n=== DONE ===");
