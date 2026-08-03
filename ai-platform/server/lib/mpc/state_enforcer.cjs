const crypto = require('crypto');

class MpcStateEnforcer {
  constructor(options = {}) {
    this.nodePublicKeys = options.nodePublicKeys || new Map();
    this.maxTimeSkewMs = options.maxTimeSkewMs || 2000;
    this.activeSessionRound = new Map();
    this.processedSequences = new Set();
  }

  validateTurnMessage(envelope) {
    const { session_id: sessionId, round_number: roundNumber, step_index: stepIndex, sequence_counter: sequenceCounter, timestamp_ms: timestampMs, sender_id: senderId, detached_signature: detachedSignature, cleartext_payload: cleartextPayload } = envelope;

    const skew = Math.abs(Date.now() - Number(timestampMs));
    if (skew > this.maxTimeSkewMs) throw new Error('MPC_TIMESTAMP_SKEW_EXCEEDED');

    if (!this.nodePublicKeys.has(senderId)) throw new Error('MPC_UNAUTHORIZED_SENDER');

    const currentRound = this.activeSessionRound.get(sessionId) || 0;
    if (roundNumber < currentRound) throw new Error('MPC_STALE_ROUND_REJECTED');
    if (roundNumber > currentRound + 1) throw new Error('MPC_ROUND_GAP_DETECTED');

    const seqKey = `${sessionId}|${senderId}|${sequenceCounter}`;
    if (this.processedSequences.has(seqKey)) throw new Error('MPC_DUPLICATE_SEQUENCE');

    const bodyToVerify = Buffer.concat([
      Buffer.from(sessionId, 'utf8'),
      Buffer.from([roundNumber & 0xff, stepIndex & 0xff]),
      Buffer.from(sequenceCounter.toString(), 'utf8'),
      Buffer.from(cleartextPayload || [])
    ]);

    const pubKey = this.nodePublicKeys.get(senderId);
    const verified = crypto.verify(null, bodyToVerify, pubKey, detachedSignature);
    if (!verified) throw new Error('MPC_INVALID_DETACHED_SIGNATURE');

    this.activeSessionRound.set(sessionId, roundNumber);
    this.processedSequences.add(seqKey);
    return true;
  }
}

module.exports = { MpcStateEnforcer };
