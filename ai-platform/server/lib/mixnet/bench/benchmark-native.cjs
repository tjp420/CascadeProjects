const { nativeShuffle, _hasNative } = require('../native/index.cjs');

function makeArray(n) {
  const a = new Uint32Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  return a;
}

function clone(arr) {
  const c = new Uint32Array(arr.length);
  c.set(arr);
  return c;
}

async function bench(n, iterations = 100) {
  const original = makeArray(n);
  let totalNative = 0n;
  let totalJs = 0n;
  for (let i = 0; i < iterations; i++) {
    const a1 = clone(original);
    const s1 = process.hrtime.bigint();
    nativeShuffle(a1, 0);
    const e1 = process.hrtime.bigint();
    totalNative += (e1 - s1);

    const a2 = clone(original);
    const s2 = process.hrtime.bigint();
    // require and call fallback explicitly from the same module
    const { nativeShuffle: jsShuffle } = require('../native/index.cjs');
    jsShuffle(a2, 0);
    const e2 = process.hrtime.bigint();
    totalJs += (e2 - s2);
  }

  console.log(`n=${n}, iterations=${iterations}, hasNative=${_hasNative}`);
  console.log(`native avg ns: ${Number(totalNative / BigInt(iterations))}`);
  console.log(`js avg ns: ${Number(totalJs / BigInt(iterations))}`);
}

async function run() {
  const sizes = [1000, 5000, 10000];
  for (const s of sizes) {
    await bench(s, 200);
  }
}

run().catch(err => { console.error(err); process.exitCode = 1 });
