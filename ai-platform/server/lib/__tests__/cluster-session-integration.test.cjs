'use strict';

const {
  IPC_SCHEMAS,
  setSessionReplicator,
  setBroker,
  _validateMessageSchema,
} = require('../cluster-keyring-sync.cjs');

describe('Cluster Session Token Integration', () => {
  test('CLUSTER-SESS-01: IPC_SCHEMAS includes SESSION_TOKEN_ISSUE', () => {
    expect(IPC_SCHEMAS.SESSION_TOKEN_ISSUE).toBeDefined();
    expect(IPC_SCHEMAS.SESSION_TOKEN_ISSUE.required.type).toBe('string');
    expect(IPC_SCHEMAS.SESSION_TOKEN_ISSUE.required.tokenId).toBe('string');
  });

  test('CLUSTER-SESS-01b: IPC_SCHEMAS includes SESSION_TOKEN_REVOKE', () => {
    expect(IPC_SCHEMAS.SESSION_TOKEN_REVOKE).toBeDefined();
    expect(IPC_SCHEMAS.SESSION_TOKEN_REVOKE.required.tokenId).toBe('string');
  });

  test('CLUSTER-SESS-01c: IPC_SCHEMAS includes SESSION_FAMILY_REVOKE', () => {
    expect(IPC_SCHEMAS.SESSION_FAMILY_REVOKE).toBeDefined();
    expect(IPC_SCHEMAS.SESSION_FAMILY_REVOKE.required.family).toBe('string');
  });

  test('CLUSTER-SESS-01d: IPC_SCHEMAS includes SESSION_TOKEN_SYNC', () => {
    expect(IPC_SCHEMAS.SESSION_TOKEN_SYNC).toBeDefined();
    expect(IPC_SCHEMAS.SESSION_TOKEN_SYNC.required.tokenCount).toBe('number');
  });

  test('CLUSTER-SESS-01e: IPC_SCHEMAS includes SESSION_STATE_REQUEST', () => {
    expect(IPC_SCHEMAS.SESSION_STATE_REQUEST).toBeDefined();
    expect(IPC_SCHEMAS.SESSION_STATE_REQUEST.required.from).toBe('string');
  });

  test('CLUSTER-SESS-01f: IPC_SCHEMAS includes SESSION_STATE_RESPONSE', () => {
    expect(IPC_SCHEMAS.SESSION_STATE_RESPONSE).toBeDefined();
    expect(IPC_SCHEMAS.SESSION_STATE_RESPONSE.required.tokens).toEqual(['object', 'array']);
  });

  test('CLUSTER-SESS-02: setSessionReplicator is a function', () => {
    expect(typeof setSessionReplicator).toBe('function');
  });

  test('CLUSTER-SESS-03: setSessionReplicator accepts a replicator object', () => {
    const mockReplicator = { handlePeerSync: () => {} };
    expect(() => setSessionReplicator(mockReplicator)).not.toThrow();
    setSessionReplicator(null);
  });

  test('CLUSTER-SESS-04: setBroker is still a function', () => {
    expect(typeof setBroker).toBe('function');
  });

  test('CLUSTER-SESS-05: SESSION_TOKEN_ISSUE schema validates valid message', () => {
    const msg = {
      type: 'SESSION_TOKEN_ISSUE',
      from: 'node-1',
      tokenId: 'tok-123',
      userId: 'user-1',
      family: 'fam-1',
      expiresAt: Date.now() + 3600000,
      timestamp: Date.now(),
    };
    const mockSocket = { remoteAddress: '10.0.0.1', remotePort: 7000, destroy: () => {} };
    const result = _validateMessageSchema(msg, mockSocket);
    expect(result).toBe(true);
  });

  test('CLUSTER-SESS-06: SESSION_TOKEN_REVOKE schema validates valid message', () => {
    const msg = {
      type: 'SESSION_TOKEN_REVOKE',
      from: 'node-1',
      tokenId: 'tok-123',
      reason: 'user_logout',
      timestamp: Date.now(),
    };
    const mockSocket = { remoteAddress: '10.0.0.1', remotePort: 7000, destroy: () => {} };
    const result = _validateMessageSchema(msg, mockSocket);
    expect(result).toBe(true);
  });

  test('CLUSTER-SESS-07: SESSION_FAMILY_REVOKE schema validates valid message', () => {
    const msg = {
      type: 'SESSION_FAMILY_REVOKE',
      from: 'node-1',
      family: 'fam-1',
      reason: 'reuse_detected',
      revokedTokenIds: ['tok-1', 'tok-2'],
      timestamp: Date.now(),
    };
    const mockSocket = { remoteAddress: '10.0.0.1', remotePort: 7000, destroy: () => {} };
    const result = _validateMessageSchema(msg, mockSocket);
    expect(result).toBe(true);
  });

  test('CLUSTER-SESS-08: SESSION_TOKEN_ISSUE schema rejects missing tokenId', () => {
    const msg = { type: 'SESSION_TOKEN_ISSUE', from: 'node-1' };
    const mockSocket = { remoteAddress: '10.0.0.1', remotePort: 7000, destroy: () => {} };
    const result = _validateMessageSchema(msg, mockSocket);
    expect(result).toBe(false);
  });

  test('CLUSTER-SESS-09: SESSION_TOKEN_SYNC schema validates valid message', () => {
    const msg = {
      type: 'SESSION_TOKEN_SYNC',
      from: 'node-1',
      tokenCount: 42,
      familyCount: 5,
      timestamp: Date.now(),
    };
    const mockSocket = { remoteAddress: '10.0.0.1', remotePort: 7000, destroy: () => {} };
    const result = _validateMessageSchema(msg, mockSocket);
    expect(result).toBe(true);
  });

  test('CLUSTER-SESS-10: SESSION_STATE_REQUEST schema validates valid message', () => {
    const msg = {
      type: 'SESSION_STATE_REQUEST',
      from: 'node-2',
      timestamp: Date.now(),
    };
    const mockSocket = { remoteAddress: '10.0.0.1', remotePort: 7000, destroy: () => {} };
    const result = _validateMessageSchema(msg, mockSocket);
    expect(result).toBe(true);
  });

  test('CLUSTER-SESS-11: SESSION_STATE_RESPONSE schema validates valid message', () => {
    const msg = {
      type: 'SESSION_STATE_RESPONSE',
      from: 'node-2',
      to: 'node-1',
      tokens: [{ tokenId: 'tok-1', userId: 'user-1' }],
      timestamp: Date.now(),
    };
    const mockSocket = { remoteAddress: '10.0.0.1', remotePort: 7000, destroy: () => {} };
    const result = _validateMessageSchema(msg, mockSocket);
    expect(result).toBe(true);
  });
});
