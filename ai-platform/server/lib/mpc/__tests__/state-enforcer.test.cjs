const crypto = require('crypto');
const { MpcStateEnforcer } = require('../state_enforcer.cjs');

describe('MpcStateEnforcer basic validation', () => {
  test('accepts properly signed envelope and rejects duplicate', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const senderId = 'node-test-1';

    const enforcer = new MpcStateEnforcer({ nodePublicKeys: new Map([[senderId, publicKey.export({ type: 'spki', format: 'pem' })]]) });

    const envelope = {
      session_id: 'sess-1',
      round_number: 1,
      step_index: 0,
      sequence_counter: 1,
      timestamp_ms: Date.now(),
      sender_id: senderId,
      cleartext_payload: Buffer.from('hello world')
    };

    const body = Buffer.concat([
      Buffer.from(envelope.session_id, 'utf8'),
      Buffer.from([envelope.round_number & 0xff, envelope.step_index & 0xff]),
      Buffer.from(envelope.sequence_counter.toString(), 'utf8'),
      envelope.cleartext_payload
    ]);

    envelope.detached_signature = crypto.sign(null, body, privateKey);

    expect(enforcer.validateTurnMessage(envelope)).toBe(true);
    expect(() => enforcer.validateTurnMessage(envelope)).toThrow('MPC_DUPLICATE_SEQUENCE');
  });
});
