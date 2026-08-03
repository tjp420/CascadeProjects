const Mixnet = require('./mixnet.cjs');
const { wrapOnionPayload } = require('./client.cjs');
const { unwrapLayer } = require('./crypto.cjs');

const seedBase = 'demo-seed';
const m = new Mixnet(3, { seed: seedBase, threshold: 3, epochMs: 1000 });
const route = m.nodes.map((n, i) => ({ id: n.id, seed: `${seedBase}-${i}` }));
const wrapped = wrapOnionPayload('hello-mixnet', route, { paddingSize: 256 });

console.log('wrapped len', wrapped.length);
let layer = wrapped;
for (let i = 0; i < m.nodes.length; i++) {
  const node = m.nodes[i];
  try {
    const res = unwrapLayer(layer, node.nodeKey);
    console.log('node', node.id, 'unwrap ok?', res.ok);
    if (!res.ok) break;
    console.log(' next:', res.next, ' payload len:', res.payload.length);
    layer = res.payload;
  } catch (e) {
    console.error('error at node', node.id, e);
    break;
  }
}
