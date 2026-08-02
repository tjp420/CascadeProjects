'use strict';

/**
 * Track 28: Enclave sandbox and memory shield tests.
 */
const { SandboxIsolationBroker } = require('../sandbox-isolation-broker.cjs');
const { MemoryShield } = require('../memory-shield.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 28 enclave sandbox', () => {
  test('sandbox initializes and emits telemetry', () => {
    const events = [];
    const broker = new SandboxIsolationBroker({
      mode: 'wasm',
      policy: { requireAttestationLog: true },
      audit: (event, info) => events.push({ event, info }),
    });
    const init = broker.initialize();
    expect(init.mode).toBe('wasm');
    expect(typeof init.attestation).toBe('string');
    expect(events.some((e) => e.event === 'SANDBOX_ENCLAVE_INITIALIZED')).toBe(true);
    broker.teardown();
  });

  test('sandbox executes a wrapped payload', () => {
    const broker = new SandboxIsolationBroker({ mode: 'wasm' });
    broker.initialize();
    const out = broker.execute('wrap', (x) => x * 2, 21);
    expect(out.operation).toBe('wrap');
    expect(out.result).toBe(42);
    expect(out.sandboxed).toBe(true);
    broker.teardown();
  });

  test('sandbox rejects disallowed mode', () => {
    expect(() => new SandboxIsolationBroker({ mode: 'native' }).initialize()).toThrow(HsmAdapterError);
  });

  test('memory shield registers, purges expired, and emits telemetry', (done) => {
    const events = [];
    const shield = new MemoryShield({
      memoryWipeIntervalMs: 50,
      maxSensitiveBufferAgeMs: 100,
      audit: (event, info) => events.push({ event, info }),
    });
    shield.start();
    const token = shield.register(Buffer.from('sensitive-data'), 'kek');
    expect(shield.access(token).toString()).toBe('sensitive-data');

    setTimeout(() => {
      expect(() => shield.access(token)).toThrow(HsmAdapterError);
      expect(events.some((e) => e.event === 'MEMORY_SHIELD_PURGED')).toBe(true);
      shield.stop();
      done();
    }, 180);
  });

  test('memory shield rejects oversized buffer for page tracking', () => {
    const shield = new MemoryShield({ pageSizeBytes: 4, requirePageBoundaryTracking: true });
    expect(() => shield.register(Buffer.from('12345'))).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates enclave configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'enclave', {
      sandboxMode: 'wasm',
      memoryWipeIntervalMs: 1000,
      attestationLog: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'enclave', {
      sandboxMode: 'native',
    })).toThrow(HsmAdapterError);

    expect(() => engine.validate('t1', 'enclave', {
      sandboxMode: 'wasm',
      memoryWipeIntervalMs: 10000,
    })).toThrow(HsmAdapterError);
  });

  test('regression: MemoryShield requires a Buffer', () => {
    const shield = new MemoryShield();
    expect(() => shield.register('not-a-buffer')).toThrow(HsmAdapterError);
  });
});
