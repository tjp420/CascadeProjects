// JS wrapper for native vdf squaring addon with JS fallback.
const path = require('path');
let native = null;
try {
  // Attempt to load compiled addon from build output
  native = require(path.join(__dirname, 'build', 'Release', 'vdf_squaring_native'));
} catch (e) {
  try {
    // Try node-gyp-build helper if present
    native = require('node-gyp-build')(__dirname);
  } catch (err) {
    native = null;
  }
}

function jsSquaringInPlace(iterations, buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('buffer must be a Buffer');
  if (buffer.length % 8 !== 0) throw new RangeError('buffer length must be divisible by 8');
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const lanes = buffer.length / 8;
  for (let iter = 0; iter < iterations; ++iter) {
    for (let i = 0; i < lanes; ++i) {
      // read unsigned 64-bit (as BigInt), square, mask to 64 bits
      const v = view.getBigUint64(i * 8, true);
      const x = (v * v) & 0xFFFFFFFFFFFFFFFFn;
      view.setBigUint64(i * 8, x, true);
    }
  }
  return buffer;
}

function squaringInPlace(iterations, buffer) {
  if (native && typeof native.squaring_inplace === 'function') {
    try {
      return native.squaring_inplace(iterations, buffer);
    } catch (e) {
      // fallthrough to JS fallback on native failure
    }
  }
  return jsSquaringInPlace(iterations, buffer);
}

module.exports = {
  squaringInPlace,
  _native: native
};
