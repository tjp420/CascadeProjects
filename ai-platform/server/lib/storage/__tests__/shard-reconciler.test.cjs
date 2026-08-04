const assert = require('assert');
const { ShardReconciler } = require('../shard-reconciler.cjs');

async function run() {
  const r = new ShardReconciler({ pollIntervalMs: 100 });
  let started = false;
  r.once('started', () => { started = true; });
  r.start();
  // allow loop to tick once
  await new Promise((res) => setTimeout(res, 200));
  assert.ok(started, 'reconciler should emit started');

  const resSync = await r.triggerSync(['s1','s2']);
  assert.ok(resSync && resSync.ok, 'triggerSync should return ok result');
  r.stop();
  console.log('shard-reconciler test OK');
}

if (require.main === module) run().catch((e) => { console.error(e); process.exit(1); });

module.exports = { run };
