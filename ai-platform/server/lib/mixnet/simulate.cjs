const Mixnet = require('./mixnet.cjs');

async function runDemo() {
  const m = new Mixnet(3, { seed: 'demo-seed', threshold: 4, epochMs: 1000 });
  // create 8 packets
  for (let i = 0; i < 8; i++) {
    // payload: a short buffer with a leading layer byte
    const payload = Buffer.concat([Buffer.from([0x01]), Buffer.from(`message-${i}`)]);
    await m.submitPacket({ id: `pkt-${i}`, payload });
  }
  // flush synchronously for demo
  const out = m.flushAllSync();
  console.log('Final sink outputs:');
  for (const p of out) console.log(p.id, p.payload.toString());
}

if (require.main === module) runDemo().catch(err => { console.error(err); process.exit(1); });
