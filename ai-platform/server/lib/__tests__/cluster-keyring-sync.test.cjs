'use strict';

const crypto = require('crypto');

let keyRotationStore;

beforeEach(() => {
  jest.resetModules();
  keyRotationStore = require('../key-rotation-store.cjs');
  keyRotationStore._reset();
});

afterEach(() => {
  delete process.env.NODE_ID;
  delete process.env.CLUSTER_NODES;
  delete process.env.CLUSTER_KEYRING_PORT;
});

describe('cluster-keyring-sync', () => {
  test('loads and exposes required API', () => {
    process.env.NODE_ID = 'node-test';
    process.env.CLUSTER_NODES = '';
    const clusterSync = require('../cluster-keyring-sync.cjs');
    expect(typeof clusterSync.init).toBe('function');
    expect(typeof clusterSync.shutdown).toBe('function');
    expect(typeof clusterSync.isLeader).toBe('function');
    expect(typeof clusterSync.getStatus).toBe('function');
    expect(typeof clusterSync.proposeRotate).toBe('function');
  });

  test('proposeRotate throws not_leader when no quorum', () => {
    process.env.NODE_ID = 'node-a';
    process.env.CLUSTER_NODES = '127.0.0.1:7001';
    process.env.CLUSTER_KEYRING_PORT = '0';
    const clusterSync = require('../cluster-keyring-sync.cjs');
    clusterSync.init();
    try {
      expect(() => clusterSync.proposeRotate(crypto.randomBytes(64).toString('hex'))).toThrow(/not_leader/);
    } finally {
      clusterSync.shutdown();
    }
  });

  test('getStatus returns structured status with no leader without quorum', () => {
    process.env.NODE_ID = 'node-a';
    process.env.CLUSTER_NODES = '127.0.0.1:7001';
    const clusterSync = require('../cluster-keyring-sync.cjs');
    const status = clusterSync.getStatus();
    expect(status.nodeId).toBe('node-a');
    expect(status.leaderId).toBeNull();
    expect(status.isLeader).toBe(false);
    expect(Array.isArray(status.members)).toBe(true);
  });
});

describe('key-rotation-store cluster helpers', () => {
  test('getKeyRingHex returns hex values after init', () => {
    keyRotationStore._reset();
    const hex = keyRotationStore.getKeyRingHex();
    expect(hex.activeHex).toBeNull();
    expect(hex.previousHex).toBeNull();
  });

  test('rotateKey returns hex values', () => {
    const result = keyRotationStore.rotateKey(crypto.randomBytes(64).toString('hex'));
    expect(result.activeHex).toMatch(/^[a-f0-9]{64}$/);
    expect(result.previousHex).toBeNull();
  });

  test('applyKeyringCommit sets keyring state deterministically', () => {
    const active = crypto.randomBytes(32).toString('hex');
    const previous = crypto.randomBytes(32).toString('hex');
    keyRotationStore.applyKeyringCommit(active, previous, 123456789, 3600000);
    const hex = keyRotationStore.getKeyRingHex();
    expect(hex.activeHex).toBe(active);
    expect(hex.previousHex).toBe(previous);
    const status = keyRotationStore.getRotationStatus();
    expect(status.rotatedAt).toBe(123456789);
    expect(status.graceMs).toBe(3600000);
  });

  test('applyKeyringCommit rejects invalid hex', () => {
    expect(() => keyRotationStore.applyKeyringCommit('not-hex', null, 1, null)).toThrow(/64-character/);
  });
});
