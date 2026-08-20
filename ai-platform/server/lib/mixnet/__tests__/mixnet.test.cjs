const Mixnet = require("../mixnet.cjs");
const { wrapOnionPayload } = require("../client.cjs");

test("deterministic shuffle changes order and delivers to sink", () => {
  const seedBase = "test-seed";
  const m = new Mixnet(3, { seed: seedBase, threshold: 3, epochMs: 1000 });
  const route = m.nodes.map((n, i) => ({ id: n.id, seed: `${seedBase}-${i}` }));
  const packets = [];
  for (let i = 0; i < 6; i++) {
    const msg = `msg-${i}`;
    const wrapped = wrapOnionPayload(msg, route, { paddingSize: 128 });
    packets.push({ id: `p-${i}`, payload: wrapped });
    m.submitPacket({ id: `p-${i}`, payload: wrapped });
  }
  // flush synchronously across nodes
  const out = m.flushAllSync();
  // sink should contain 6 entries
  expect(out.length).toBe(6);
  // order should not equal original ordering in most cases (probabilistic determinism)
  const outIds = out.map((p) => p.id);
  const inIds = packets.map((p) => p.id);
  // at least one position differs
  const same = outIds.every((v, i) => v === inIds[i]);
  expect(same).toBe(false);
  // payloads should have had their layers peeled — recover original via 4-byte length prefix
  for (const p of out) {
    const origLen = p.payload.readUInt32BE(0);
    const recovered = p.payload.slice(4, 4 + origLen).toString();
    expect(recovered).toMatch(/^msg-/);
  }
});
