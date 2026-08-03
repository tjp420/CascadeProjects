const Mixnet = require('../mixnet.cjs');

test('deterministic shuffle changes order and delivers to sink', () => {
  const m = new Mixnet(3, { seed: 'test-seed', threshold: 3, epochMs: 1000 });
  const packets = [];
  for (let i = 0; i < 6; i++) {
    const payload = Buffer.concat([Buffer.from([0x01]), Buffer.from(`msg-${i}`)]);
    packets.push({ id: `p-${i}`, payload });
    m.submitPacket({ id: `p-${i}`, payload });
  }
  // flush synchronously across nodes
  const out = m.flushAllSync();
  // sink should contain 6 entries
  expect(out.length).toBe(6);
  // order should not equal original ordering in most cases (probabilistic determinism)
  const outIds = out.map(p => p.id);
  const inIds = packets.map(p => p.id);
  // at least one position differs
  const same = outIds.every((v, i) => v === inIds[i]);
  expect(same).toBe(false);
  // payloads should have had their leading layer peeled
  for (const p of out) expect(p.payload.toString()).toMatch(/^msg-/);
});
