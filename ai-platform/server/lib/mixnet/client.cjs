const crypto = require('crypto');
const { wrapLayer } = require('./crypto.cjs');

function deriveNodeKey(seed) {
  return crypto.createHash('sha256').update(String(seed)).digest();
}

/**
 * wrapOnionPayload(plaintext: Buffer, routeNodes: Array<{id, seed}>, options)
 * - plaintext: Buffer or string
 * - routeNodes: array of node descriptors (id, seed)
 * - options.outerSize: desired outer target size (default 1024)
 *
 * The function pads the inner payload to achieve roughly consistent layer sizes and
 * produces an outer Buffer representing the onion-encrypted packet.
 *
 * Buffers are length-prefixed so the sink can slice the original message out of padding.
 * Strings are written verbatim and padded with nulls so trailing padding can be stripped.
 */
function wrapOnionPayload(plaintext, routeNodes, options = {}) {
  const outerSize = options.outerSize || options.paddingSize || 1024;
  const isBuffer = Buffer.isBuffer(plaintext);
  const pt = isBuffer ? plaintext : Buffer.from(String(plaintext), 'utf8');
  // overhead estimate: nonce(12) + nextLen(2) + maxNext(64) + tag(16)
  const overhead = 12 + 2 + 64 + 16;

  let inner;
  if (isBuffer) {
    // length-prefixed layout for Buffer payloads
    const origLenBuf = Buffer.alloc(4);
    origLenBuf.writeUInt32BE(pt.length, 0);
    inner = Buffer.concat([origLenBuf, pt]);
  } else {
    // string payloads are written verbatim
    inner = pt;
  }

  const innerSize = Math.max(inner.length, outerSize - overhead);
  if (inner.length < innerSize) {
    inner = Buffer.concat([inner, Buffer.alloc(innerSize - inner.length)]);
  }

  // wrap from last to first
  for (let i = routeNodes.length - 1; i >= 0; i--) {
    const node = routeNodes[i];
    const nextNode = routeNodes[i + 1];
    const next = nextNode ? nextNode.id : '';
    const nodeKey = deriveNodeKey(node.seed || node.id || `node-${i}`);
    inner = wrapLayer(next, inner, nodeKey);
  }

  // If outer length less than outerSize, pad with random bytes to reach outerSize
  if (inner.length < outerSize) {
    inner = Buffer.concat([inner, crypto.randomBytes(outerSize - inner.length)]);
  }
  return inner;
}

module.exports = { wrapOnionPayload };
