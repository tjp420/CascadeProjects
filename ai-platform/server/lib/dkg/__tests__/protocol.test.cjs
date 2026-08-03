const protocol = require('../protocol.cjs');

describe('dkg protocol skeleton', () => {
  test('startRefreshEpoch returns a transcript object', async () => {
    const res = await protocol.startRefreshEpoch('test-epoch', { peers: [] , timeoutMs: 100 });
    expect(res).toHaveProperty('transcript');
    expect(res.transcript).toHaveProperty('epoch', 'test-epoch');
  });

  test('complaint and eviction flow', async () => {
    // configure low threshold for the test
    protocol.configure({ evictionThreshold: 2 });
    const epochId = 'e-evict';
    // start epoch with peers A,B,C and simulate C being bad
    const peers = ['A', 'B', 'C'];
    // prepare commitment/opening and keypair for B
    const crypto = require('crypto');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const opening = 'opening-C';
    const accusedCommitment = crypto.createHash('sha256').update(opening).digest('hex');

    // start epoch; the simulated bad peer will trigger a self-accusation but it will be unverified
    const res = await protocol.startRefreshEpoch(epochId, { peers, timeoutMs: 100, simulateBadPeers: ['C'] });
    const state = protocol._getEpochState(epochId);
    expect(state).toBeDefined();
    // inject the known commitment into epoch state so opening can be verified
    if (!state.commitments) state.commitments = new Map();
    state.commitments.set('C', accusedCommitment);

    // create evidence payload and sign it with B's key
    const evidenceData = 'encrypted-share-ciphertext';
    const evidenceHash = crypto.createHash('sha256').update(evidenceData).digest('hex');
    const message = `${epochId}|C|${evidenceHash}`;
    const signature = crypto.sign(null, Buffer.from(message), privateKey).toString('base64');
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

    // record a verified accusation from B
    const accCount = await protocol._recordAccusation(epochId, 'B', 'C', { evidenceHash, shareCommitmentOpening: opening, signature, publicKey: publicPem, accusedCommitment });
    // accCount should be 1 (since verified)
    expect(accCount).toBe(1);
    const evicted = await protocol._processAccusations(epochId);
    // since threshold is 2, single verified accusation should NOT evict yet
    expect(evicted).not.toContain('C');
    // add another verified accusation to reach threshold
    const accCount2 = await protocol._recordAccusation(epochId, 'D', 'C', { evidenceHash, shareCommitmentOpening: opening, signature, publicKey: publicPem, accusedCommitment });
    expect(accCount2).toBe(2);
    const evicted2 = await protocol._processAccusations(epochId);
    expect(evicted2).toContain('C');
    expect(state.evicted.has('C')).toBeTruthy();
  });
});
