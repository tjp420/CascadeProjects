let native = null;
try {
  // try loading the built addon (node-gyp default output)
  native = require('./build/Release/shuffle_addon.node');
} catch (e) {
  try {
    native = require('./shuffle_addon.node');
  } catch (err) {
    native = null;
  }
}

function jsShuffle(u32arr, seed) {
  // In-place Fisher-Yates in JS operating on Uint32Array
  const n = u32arr.length;
  // simple RNG (Xorshift64*) for speed; seed must be number
  let s = seed ? BigInt(seed) : BigInt(Date.now());
  function rnd() {
    s ^= (s << 13n) & 0xFFFFFFFFFFFFFFFFn;
    s ^= (s >> 7n);
    s ^= (s << 17n);
    // return 32-bit
    return Number(s & 0xFFFFFFFFn);
  }
  for (let i = n - 1; i > 0; --i) {
    const j = rnd() % (i + 1);
    const tmp = u32arr[i];
    u32arr[i] = u32arr[j];
    u32arr[j] = tmp;
  }
}

function nativeShuffle(buf, seed) {
  if (!Buffer.isBuffer(buf) && !(buf instanceof Uint32Array) && !(ArrayBuffer.isView(buf))) {
    throw new TypeError('nativeShuffle expects a Uint32Array or a Buffer');
  }

  // normalize to Uint32Array view
  let u32;
  if (buf instanceof Uint32Array) u32 = buf;
  else if (Buffer.isBuffer(buf)) u32 = new Uint32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  else u32 = new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

  if (native && typeof native.shuffle === 'function') {
    // if addon available, call it with the typed array and optional seed
    return native.shuffle(u32, seed || 0);
  }

  // fallback JS implementation
  return jsShuffle(u32, seed || 0);
}

module.exports = {
  nativeShuffle,
  _hasNative: Boolean(native)
};
