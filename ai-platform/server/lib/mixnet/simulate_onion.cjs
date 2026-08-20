const Mixnet = require("./mixnet.cjs");
const { wrapOnionPayload } = require("./client.cjs");

async function run() {
  const seedBase = "demo-seed";
  const m = new Mixnet(3, { seed: seedBase, threshold: 3, epochMs: 1000 });

  // build route metadata matching Mixnet node seeds
  const route = m.nodes.map((n, i) => ({ id: n.id, seed: `${seedBase}-${i}` }));

  const plaintext = "hello-mixnet";
  const wrapped = wrapOnionPayload(plaintext, route, { paddingSize: 256 });

  await m.submitPacket({ id: "onion-1", payload: wrapped });
  const out = m.flushAllSync();
  console.log("Sink length:", out.length);
  for (const p of out) {
    if (p.payload && p.payload.length >= 4) {
      const origLen = p.payload.readUInt32BE(0);
      const msg = p.payload.slice(4, 4 + origLen).toString("utf8");
      console.log(p.id, "->", msg);
    } else {
      console.log(p.id, "-> DROPPED/INVALID");
    }
  }
}

if (require.main === module)
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
