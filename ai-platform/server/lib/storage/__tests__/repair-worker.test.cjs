const assert = require('assert');
const EventEmitter = require('events');
const { RepairWorker } = require('../repair-worker.cjs');

async function run() {
  const emitter = new EventEmitter();
  const worker = new RepairWorker({ emitter, repairJitterMs: 1000, processingTimeMs: 20 });

  const payload = { tenantId: 't1', shardId: 'sh-gap', fromSeq: 3, toSeq: 3, repairJitterMs: 1000 };

  // Emit duplicate events rapidly; worker should only schedule one due to idempotency
  emitter.emit('shard:reconciler:reconcile_requested', payload);
  emitter.emit('shard:reconciler:reconcile_requested', payload);

  // Wait long enough for jitter + processing
  await new Promise((res) => setTimeout(res, 1200));

  assert.strictEqual(worker.scheduledDelays.length, 1, 'should schedule only one repair due to idempotency');
  assert.strictEqual(worker.processed.length, 1, 'should process exactly one repair');

  const delay = worker.scheduledDelays[0];
  assert.ok(delay >= 0 && delay <= 1000, 'delay should be within [0, repairJitterMs]');

  console.log('repair-worker test OK');
}

if (require.main === module) run().catch((e) => { console.error(e); process.exit(1); });

test('repair worker run to completion', async () => await run());

module.exports = { run };
