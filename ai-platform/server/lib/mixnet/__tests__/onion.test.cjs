const Mixnet = require("../mixnet.cjs");
const { wrapOnionPayload } = require("../client.cjs");

test("onion wraps and successfully traverses mixnet", () => {
  const seedBase = "test-seed";
  const m = new Mixnet(3, { seed: seedBase, threshold: 3, epochMs: 1000 });
  const route = m.nodes.map((n, i) => ({ id: n.id, seed: `${seedBase}-${i}` }));
  const plaintext = "top-secret";
  const wrapped = wrapOnionPayload(plaintext, route, { paddingSize: 128 });
  m.submitPacket({ id: "o1", payload: wrapped });
  const out = m.flushAllSync();
  expect(out.length).toBeGreaterThan(0);
  // find our packet
  const found = out.find((p) => p.id === "o1");
  expect(found).toBeDefined();
  expect(found.payload.length).toBeGreaterThan(0);
  const recovered = found.payload
    .slice(4, 4 + found.payload.readUInt32BE(0))
    .toString("utf8");
  expect(recovered).toBe(plaintext);
});

test("malformed outer layer is rejected uniformly", () => {
  const seedBase = "test-seed-mal";
  const m = new Mixnet(3, { seed: seedBase, threshold: 3, epochMs: 1000 });
  const route = m.nodes.map((n, i) => ({ id: n.id, seed: `${seedBase}-${i}` }));
  const plaintext = "attack";
  const wrapped = wrapOnionPayload(plaintext, route, { paddingSize: 64 });
  // corrupt a byte in the outer layer
  const corrupt = Buffer.from(wrapped);
  corrupt[5] ^= 0xff;
  m.submitPacket({ id: "bad1", payload: corrupt });
  const out = m.flushAllSync();
  const found = out.find((p) => p.id === "bad1");
  expect(found).toBeDefined();
  // should be marked as dropped or empty
  expect(found.payload.length).toBe(0);
});

test("onion traverses cascade and original message recovered (length-prefixed)", () => {
  const baseSeed = "test-seed";
  const m = new Mixnet(3, { seed: baseSeed, threshold: 4, epochMs: 1000 });
  const route = m.nodes.map((n, i) => ({
    id: `node-${i}`,
    seed: `${baseSeed}-${i}`,
  }));
  const msg = Buffer.from("sensitive-data");
  const packet = wrapOnionPayload(msg, route, { outerSize: 1024 });
  m.submitPacket({ id: "onion-1", payload: packet });
  const out = m.flushAllSync();
  expect(out.length).toBeGreaterThan(0);
  // Try to parse original message from sink entry
  const p = out.find((x) => x.id === "onion-1");
  expect(p).toBeDefined();
  const origLen = p.payload.readUInt32BE(0);
  const recovered = p.payload.slice(4, 4 + origLen).toString();
  expect(recovered).toBe("sensitive-data");
});

test("malformed outer layer auth fails and triggers uniform rejection", () => {
  const baseSeed = "test-seed";
  const m = new Mixnet(3, { seed: baseSeed, threshold: 4, epochMs: 1000 });
  const route = m.nodes.map((n, i) => ({
    id: `node-${i}`,
    seed: `${baseSeed}-${i}`,
  }));
  const msg = Buffer.from("attack");
  let packet = wrapOnionPayload(msg, route, { outerSize: 1024 });
  // corrupt a byte in the outer ciphertext to break auth tag
  packet[50] = (packet[50] + 1) & 0xff;
  m.submitPacket({ id: "onion-2", payload: packet });
  const out = m.flushAllSync();
  const p = out.find((x) => x.id === "onion-2");
  expect(p).toBeDefined();
  // malformed should produce empty payload (uniform rejection path)
  expect(p.payload.length).toBe(0);
});
