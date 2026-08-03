const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { encodeEnvelope, decodeEnvelope } = require('./message_pb.cjs');
const { MpcStateEnforcer } = require('./state_enforcer.cjs');

const OUT_DIR = path.join(__dirname, '..', '..', '.artifacts', 'mpc-latency');
const OUT_FILE = path.join(OUT_DIR, 'latency_report.csv');

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const fd = fs.openSync(OUT_FILE, 'w');
  fs.writeSync(fd, 'operation,round,iteration,elapsed_ms\n');

  const ITER = Number(process.env.MPC_LATENCY_ITER || 1000);
  const ROUNDS = Number(process.env.MPC_LATENCY_ROUNDS || 3);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const senderId = 'bench-node-1';

  const enforcer = new MpcStateEnforcer({ nodePublicKeys: new Map([[senderId, publicKey.export({ type: 'spki', format: 'pem' })]]) });

  for (let round = 1; round <= ROUNDS; round++) {
    for (let i = 0; i < ITER; i++) {
      const envelope = {
        session_id: 'session-bench',
        round_number: round,
        step_index: 0,
        sequence_counter: i + 1 + (round - 1) * ITER,
        timestamp_ms: Date.now(),
        sender_id: senderId,
        cleartext_payload: Buffer.from('payload-' + i)
      };

      const body = Buffer.concat([
        Buffer.from(envelope.session_id, 'utf8'),
        Buffer.from([envelope.round_number & 0xff, envelope.step_index & 0xff]),
        Buffer.from(envelope.sequence_counter.toString(), 'utf8'),
        envelope.cleartext_payload
      ]);
      envelope.detached_signature = crypto.sign(null, body, privateKey);

      let t0 = performance.now();
      const ser = encodeEnvelope(envelope);
      let t1 = performance.now();
      fs.writeSync(fd, `serialize,${round},${i},${(t1 - t0).toFixed(4)}\n`);

      t0 = performance.now();
      const dec = decodeEnvelope(ser);
      t1 = performance.now();
      fs.writeSync(fd, `decode,${round},${i},${(t1 - t0).toFixed(4)}\n`);

      t0 = performance.now();
      enforcer.validateTurnMessage(dec);
      t1 = performance.now();
      fs.writeSync(fd, `validate,${round},${i},${(t1 - t0).toFixed(4)}\n`);
    }
  }

  fs.closeSync(fd);
  console.log('Wrote', OUT_FILE);
}

run().catch(err => { console.error(err); process.exit(2); });
