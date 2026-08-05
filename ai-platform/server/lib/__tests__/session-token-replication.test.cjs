'use strict';

const { SessionTokenReplicator } = require('../session-token-replication.cjs');

describe('Session Token Replication Engine', () => {
  let replicator;
  let sentMessages;

  beforeEach(() => {
    sentMessages = [];
    replicator = new SessionTokenReplicator({
      nodeId: 'node-1',
      sendFn: (msg) => sentMessages.push(msg),
      syncIntervalMs: 999999,
      expirySweepMs: 999999,
    });
  });

  afterEach(() => {
    replicator.stop();
  });

  test('SESS-REPL-01: SessionTokenReplicator can be instantiated', () => {
    expect(replicator).toBeInstanceOf(SessionTokenReplicator);
    expect(replicator.nodeId).toBe('node-1');
    expect(replicator.size()).toBe(0);
  });

  test('SESS-REPL-02: issueToken stores token locally', () => {
    const result = replicator.issueToken({
      tokenId: 'tok-1',
      tokenHash: 'abc123',
      userId: 'user-1',
      family: 'fam-1',
      expiresAt: Date.now() + 3600000,
    });
    expect(result).toBe(true);
    expect(replicator.size()).toBe(1);
  });

  test('SESS-REPL-03: issueToken broadcasts SESSION_TOKEN_ISSUE to peers', () => {
    replicator.issueToken({
      tokenId: 'tok-1',
      tokenHash: 'abc123',
      userId: 'user-1',
      family: 'fam-1',
      expiresAt: Date.now() + 3600000,
    });
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe('SESSION_TOKEN_ISSUE');
    expect(sentMessages[0].tokenId).toBe('tok-1');
    expect(sentMessages[0].tokenHash).toBe('abc123');
    expect(sentMessages[0].from).toBe('node-1');
  });

  test('SESS-REPL-03b: duplicate issueToken is idempotent', () => {
    replicator.issueToken({ tokenId: 'tok-1', userId: 'user-1' });
    const result = replicator.issueToken({ tokenId: 'tok-1', userId: 'user-1' });
    expect(result).toBe(false);
    expect(replicator.size()).toBe(1);
    expect(sentMessages.length).toBe(1);
  });

  test('SESS-REPL-04: revokeToken marks revoked and broadcasts', () => {
    replicator.issueToken({ tokenId: 'tok-1', userId: 'user-1' });
    sentMessages.length = 0;
    const result = replicator.revokeToken('tok-1', 'user_logout');
    expect(result).toBe(true);
    expect(replicator.isTokenRevoked('tok-1')).toBe(true);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe('SESSION_TOKEN_REVOKE');
    expect(sentMessages[0].reason).toBe('user_logout');
  });

  test('SESS-REPL-04b: revokeToken on unknown token returns false', () => {
    const result = replicator.revokeToken('nonexistent');
    expect(result).toBe(false);
  });

  test('SESS-REPL-04c: revokeToken on already revoked token returns false', () => {
    replicator.issueToken({ tokenId: 'tok-1' });
    replicator.revokeToken('tok-1');
    const result = replicator.revokeToken('tok-1');
    expect(result).toBe(false);
  });

  test('SESS-REPL-05: revokeFamily revokes all tokens in family', () => {
    replicator.issueToken({ tokenId: 'tok-1', family: 'fam-1' });
    replicator.issueToken({ tokenId: 'tok-2', family: 'fam-1' });
    replicator.issueToken({ tokenId: 'tok-3', family: 'fam-2' });
    sentMessages.length = 0;
    const count = replicator.revokeFamily('fam-1', 'reuse_detected');
    expect(count).toBe(2);
    expect(replicator.isTokenRevoked('tok-1')).toBe(true);
    expect(replicator.isTokenRevoked('tok-2')).toBe(true);
    expect(replicator.isTokenRevoked('tok-3')).toBe(false);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe('SESSION_FAMILY_REVOKE');
    expect(sentMessages[0].family).toBe('fam-1');
    expect(sentMessages[0].revokedTokenIds).toContain('tok-1');
    expect(sentMessages[0].revokedTokenIds).toContain('tok-2');
  });

  test('SESS-REPL-06: isTokenRevoked returns true for unknown tokens (fail-safe)', () => {
    expect(replicator.isTokenRevoked('unknown-token')).toBe(true);
  });

  test('SESS-REPL-07: getTokenState returns metadata without token hash', () => {
    replicator.issueToken({
      tokenId: 'tok-1',
      tokenHash: 'secret-hash',
      userId: 'user-1',
      family: 'fam-1',
      expiresAt: Date.now() + 3600000,
    });
    const state = replicator.getTokenState('tok-1');
    expect(state).toBeDefined();
    expect(state.userId).toBe('user-1');
    expect(state.family).toBe('fam-1');
    expect(state.revoked).toBe(false);
    expect(state.tokenHash).toBeUndefined();
  });

  test('SESS-REPL-07b: getTokenState returns null for unknown token', () => {
    expect(replicator.getTokenState('nonexistent')).toBeNull();
  });

  test('SESS-REPL-08: handlePeerSync routes messages correctly', () => {
    replicator.handlePeerSync({
      type: 'SESSION_TOKEN_ISSUE',
      from: 'node-2',
      tokenId: 'remote-tok-1',
      userId: 'user-2',
      family: 'fam-2',
      expiresAt: Date.now() + 3600000,
      timestamp: Date.now(),
    });
    expect(replicator.size()).toBe(1);
    expect(replicator.isTokenValid('remote-tok-1')).toBe(true);
  });

  test('SESS-REPL-09: handleTokenIssue applies remote issuance', () => {
    replicator.handleTokenIssue({
      type: 'SESSION_TOKEN_ISSUE',
      from: 'node-2',
      tokenId: 'remote-tok-1',
      tokenHash: 'remote-hash',
      userId: 'user-2',
      family: 'remote-fam',
      expiresAt: Date.now() + 3600000,
    });
    expect(replicator.size()).toBe(1);
    const state = replicator.getTokenState('remote-tok-1');
    expect(state.userId).toBe('user-2');
    expect(state.issuedBy).toBe('node-2');
  });

  test('SESS-REPL-09b: handleTokenIssue is idempotent', () => {
    replicator.handleTokenIssue({ tokenId: 'tok-1', userId: 'user-1' });
    replicator.handleTokenIssue({ tokenId: 'tok-1', userId: 'user-1' });
    expect(replicator.size()).toBe(1);
  });

  test('SESS-REPL-10: handleTokenRevoke applies remote revocation', () => {
    replicator.issueToken({ tokenId: 'tok-1', userId: 'user-1' });
    replicator.handleTokenRevoke({
      type: 'SESSION_TOKEN_REVOKE',
      from: 'node-2',
      tokenId: 'tok-1',
      reason: 'remote_logout',
    });
    expect(replicator.isTokenRevoked('tok-1')).toBe(true);
  });

  test('SESS-REPL-10b: handleTokenRevoke creates placeholder for unknown token', () => {
    replicator.handleTokenRevoke({
      type: 'SESSION_TOKEN_REVOKE',
      from: 'node-2',
      tokenId: 'unknown-tok',
      reason: 'remote_revoke',
    });
    expect(replicator.isTokenRevoked('unknown-tok')).toBe(true);
  });

  test('SESS-REPL-11: handleFamilyRevoke applies remote family revocation', () => {
    replicator.issueToken({ tokenId: 'tok-1', family: 'fam-1' });
    replicator.issueToken({ tokenId: 'tok-2', family: 'fam-1' });
    replicator.handleFamilyRevoke({
      type: 'SESSION_FAMILY_REVOKE',
      from: 'node-2',
      family: 'fam-1',
      reason: 'remote_reuse',
      revokedTokenIds: ['tok-1', 'tok-2'],
    });
    expect(replicator.isTokenRevoked('tok-1')).toBe(true);
    expect(replicator.isTokenRevoked('tok-2')).toBe(true);
  });

  test('SESS-REPL-12: requestStateFromPeers broadcasts SESSION_STATE_REQUEST', () => {
    replicator.requestStateFromPeers();
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe('SESSION_STATE_REQUEST');
    expect(sentMessages[0].from).toBe('node-1');
  });

  test('SESS-REPL-13: _handleStateResponse applies tokens from peer', () => {
    replicator._handleStateResponse({
      type: 'SESSION_STATE_RESPONSE',
      from: 'node-2',
      to: 'node-1',
      tokens: [
        { tokenId: 'tok-a', userId: 'user-a', family: 'fam-a', expiresAt: Date.now() + 3600000 },
        { tokenId: 'tok-b', userId: 'user-b', family: 'fam-b', expiresAt: Date.now() + 3600000 },
      ],
      timestamp: Date.now(),
    });
    expect(replicator.size()).toBe(2);
    expect(replicator.isTokenValid('tok-a')).toBe(true);
    expect(replicator.isTokenValid('tok-b')).toBe(true);
  });

  test('SESS-REPL-13b: _handleStateResponse ignores responses for other nodes', () => {
    replicator._handleStateResponse({
      type: 'SESSION_STATE_RESPONSE',
      from: 'node-2',
      to: 'node-3',
      tokens: [{ tokenId: 'tok-a', userId: 'user-a' }],
      timestamp: Date.now(),
    });
    expect(replicator.size()).toBe(0);
  });

  test('SESS-REPL-14: _handleStateRequest responds with local state', () => {
    replicator.issueToken({ tokenId: 'tok-1', userId: 'user-1', family: 'fam-1', expiresAt: Date.now() + 3600000 });
    sentMessages.length = 0;
    replicator._handleStateRequest({ type: 'SESSION_STATE_REQUEST', from: 'node-2' });
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe('SESSION_STATE_RESPONSE');
    expect(sentMessages[0].to).toBe('node-2');
    expect(sentMessages[0].tokens.length).toBe(1);
    expect(sentMessages[0].tokens[0].tokenId).toBe('tok-1');
  });

  test('SESS-REPL-15: expiry sweep removes expired tokens', () => {
    const fastReplicator = new SessionTokenReplicator({
      nodeId: 'node-1',
      sendFn: () => {},
      syncIntervalMs: 999999,
      expirySweepMs: 50,
    });
    fastReplicator.issueToken({ tokenId: 'tok-1', expiresAt: Date.now() - 1000 });
    expect(fastReplicator.size()).toBe(1);
    fastReplicator.start();
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(fastReplicator.size()).toBe(0);
        expect(fastReplicator.getMetrics().tokens_expired_swept_total).toBe(1);
        fastReplicator.stop();
        resolve();
      }, 150);
    });
  });

  test('SESS-REPL-16: getMetrics returns all metrics', () => {
    replicator.issueToken({ tokenId: 'tok-1' });
    replicator.revokeToken('tok-1');
    const metrics = replicator.getMetrics();
    expect(metrics.tokens_replicated_total).toBe(1);
    expect(metrics.tokens_revoked_total).toBe(1);
    expect(metrics.activeTokens).toBe(1);
    expect(metrics.sync_messages_sent_total).toBe(2);
  });

  test('SESS-REPL-17: works standalone without sendFn (local-only mode)', () => {
    const localReplicator = new SessionTokenReplicator({ nodeId: 'node-1' });
    expect(localReplicator.sendFn).toBeNull();
    localReplicator.issueToken({ tokenId: 'tok-1', userId: 'user-1' });
    expect(localReplicator.size()).toBe(1);
    expect(localReplicator.isTokenValid('tok-1')).toBe(true);
    localReplicator.stop();
  });

  test('SESS-REPL-17b: isTokenValid checks expiry', () => {
    replicator.issueToken({ tokenId: 'tok-1', expiresAt: Date.now() - 1000 });
    expect(replicator.isTokenValid('tok-1')).toBe(false);
  });

  test('SESS-REPL-17c: isTokenValid returns false for revoked tokens', () => {
    replicator.issueToken({ tokenId: 'tok-1', expiresAt: Date.now() + 3600000 });
    replicator.revokeToken('tok-1');
    expect(replicator.isTokenValid('tok-1')).toBe(false);
  });

  test('SESS-REPL-17d: setSendFn updates the send function', () => {
    const localReplicator = new SessionTokenReplicator({ nodeId: 'node-1' });
    const msgs = [];
    localReplicator.setSendFn((msg) => msgs.push(msg));
    localReplicator.issueToken({ tokenId: 'tok-1' });
    expect(msgs.length).toBe(1);
    localReplicator.stop();
  });

  test('SESS-REPL-17e: start/stop lifecycle works', () => {
    replicator.start();
    expect(replicator._running).toBe(true);
    replicator.stop();
    expect(replicator._running).toBe(false);
  });

  test('SESS-REPL-17f: _reset clears all state', () => {
    replicator.issueToken({ tokenId: 'tok-1' });
    replicator.revokeToken('tok-1');
    replicator._reset();
    expect(replicator.size()).toBe(0);
    expect(replicator.getMetrics().tokens_replicated_total).toBe(0);
  });
});
