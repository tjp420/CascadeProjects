const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const reassembler = require('../reassembler.cjs');

function tmpDir(prefix) {
  const d = path.join(os.tmpdir(), `${prefix}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function sha256HexOfObj(obj) {
  const c = reassembler.jcsCanonicalize(obj);
  return reassembler.sha256Bytes(Buffer.from(c));
}

async function testCanonicalization() {
  const a = { b: 1, a: 2 };
  const b = { a: 2, b: 1 };
  const ca = reassembler.jcsCanonicalize(a);
  const cb = reassembler.jcsCanonicalize(b);
  assert.strictEqual(ca, cb, 'canonicalization must be stable');
  const ha = reassembler.sha256Bytes(Buffer.from(ca));
  const hb = reassembler.sha256Bytes(Buffer.from(cb));
  assert.strictEqual(ha, hb, 'hashes must match');
}

async function testStageAndFinalizeSuccess() {
  const staging = tmpDir('reass-stage');
  const live = path.join(tmpDir('reass-live-root'), 'tenant1', 'shardA');
  const chunk = { filename: 'blk1.json', payload: JSON.stringify({ seq: 1, data: 'x' }) };
  const expectedHash = sha256HexOfObj(JSON.parse(chunk.payload));
  await reassembler.stageChunks(staging, [chunk]);
  const manifest = { expectedLeafHashes: { 'blk1.json': expectedHash }, labels: { tenantId: 'tenant1', shardId: 'shardA' } };

  const metrics = { calls: [], inc(name, v, labels) { this.calls.push({ name, v, labels }); } };
  const res = await reassembler.finalizeRehydration(staging, live, manifest, metrics);
  assert.ok(res.success, 'finalize must return success');
  // ensure file moved
  const exist = fs.existsSync(path.join(live, 'blk1.json'));
  assert.ok(exist, 'block must exist in live dir');
  // metrics recorded
  const found = metrics.calls.find(c => c.name === 'hsm_shard_reconstructed_blocks_total');
  assert.ok(found && found.v === 1, 'metric increment expected');
}

async function testFinalizeFailureCleansStaging() {
  const staging = tmpDir('reass-stage');
  const live = path.join(tmpDir('reass-live-root'), 'tenant2', 'shardB');
  const chunk = { filename: 'blk2.json', payload: JSON.stringify({ seq: 2, data: 'y' }) };
  await reassembler.stageChunks(staging, [chunk]);
  // provide wrong expected hash to force validation failure
  const manifest = { expectedLeafHashes: { 'blk2.json': 'deadbeef' }, labels: { tenantId: 'tenant2', shardId: 'shardB' } };
  const metrics = { calls: [], inc(name, v, labels) { this.calls.push({ name, v, labels }); } };
  let threw = false;
  try {
    await reassembler.finalizeRehydration(staging, live, manifest, metrics);
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, 'finalize must throw on hash mismatch');
  // staging should be cleaned
  assert.ok(!fs.existsSync(staging), 'staging must be removed on failure');
}

async function run() {
  await testCanonicalization();
  await testStageAndFinalizeSuccess();
  await testFinalizeFailureCleansStaging();
  console.log('reassembler tests OK');
}

run().catch(err => { console.error(err); process.exit(2); });

test('reassembler run to completion', async () => await run());
