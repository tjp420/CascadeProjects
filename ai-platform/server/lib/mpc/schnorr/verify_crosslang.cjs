const { JcsCanonicalizer } = require('./jcs.cjs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const path = require('path');

const goBin = path.join(__dirname, 'reference-runner-go', process.platform === 'win32' ? 'reference-runner-go.exe' : 'reference-runner-go');
const canonicalizer = new JcsCanonicalizer();

const vectors = [];

// helper to add numeric vectors
function addNum(name, val) {
  vectors.push({ name, jsValue: { n: val }, jsonStr: JSON.stringify({ n: val }) });
}

addNum('zero', 0);
addNum('neg_zero', -0);
addNum('small', 1.2345);
addNum('large_precise', 9007199254740991); // 2^53-1
addNum('large_imprecise', 9007199254740992); // 2^53
addNum('big_exp', 1e+30);
addNum('small_exp', 1e-30);

vectors.push({ name: 'key_order', jsValue: { b: 2, a: 1 }, jsonStr: JSON.stringify({ b: 2, a: 1 }) });
vectors.push({ name: 'array_negzero', jsValue: { arr: [-0, 0, 1] }, jsonStr: JSON.stringify({ arr: [-0, 0, 1] }) });

// 64-bit boundary BigInt vectors and extremes
const bigIntVectors = [
  { name: 'i64_min', v: -(2n ** 63n) },
  { name: 'i64_min_plus1', v: -(2n ** 63n) + 1n },
  { name: 'i64_max', v: (2n ** 63n) - 1n },
  { name: 'u64_max', v: (2n ** 64n) - 1n },
  { name: 'big_128_max', v: (2n ** 128n) - 1n },
  { name: 'neg_big_128', v: -(2n ** 128n) },
];

for (const it of bigIntVectors) {
  const hex = it.v.toString(16);
  // For JS canonicalizer use actual BigInt typed value
  const jsVal = { bi: it.v < 0n ? -it.v : it.v };
  // But represent as marker in JSON for the Go runner: {"__bigint_hex":"..."}
  const marker = JSON.stringify({ __bigint_hex: hex });
  // For JS, we need to pass BigInt typed; embed as BigInt in the object
  const jsObj = { bi: it.v < 0n ? -it.v : it.v };
  // The canonicalizer expects the BigInt value itself; use direct object with BigInt
  vectors.push({ name: it.name, jsValue: { bi: it.v }, jsonStr: '{"bi":' + marker + '}' });
}

function jsCanonicalAndDigest(obj) {
  const can = canonicalizer.canonicalize(obj);
  const h = crypto.createHash('sha256').update(can).digest('hex');
  return { can, h };
}

function runGoWithJson(jsonStr) {
  const proc = spawnSync(goBin, [], { input: jsonStr, encoding: 'utf8' });
  if (proc.error) throw proc.error;
  if (proc.status !== 0) {
    return { error: proc.stderr || String(proc.status) };
  }
  const out = (proc.stdout || '').trim().split(/\r?\n/);
  return { can: out[0] || '', h: out[1] || '' };
}

let mismatches = [];
for (const v of vectors) {
  // Prepare JSON string and JS value for canonicalization
  let jsonStr = v.jsonStr;
  if (!jsonStr) {
    if (v.name === 'neg_zero') jsonStr = '{"n":-0}';
    else if (v.name === 'array_negzero') jsonStr = '{"arr":[-0,0,1]}';
    else jsonStr = JSON.stringify(v.jsValue);
  }

  const jsVal = v.jsValue !== undefined ? v.jsValue : v.value;
  const jsRes = jsCanonicalAndDigest(jsVal);
  const goRes = runGoWithJson(jsonStr);

  const ok = (!goRes.error) && jsRes.h === goRes.h;
  console.log(`${v.name}: JS_DIGEST=${jsRes.h} GO_DIGEST=${goRes.h} OK=${ok}`);
  if (!ok) {
    mismatches.push({ name: v.name, js: jsRes, go: goRes, json: jsonStr });
    console.log('  JS_CANON:', jsRes.can);
    console.log('  GO_CANON:', goRes.can || goRes.error);
  }
}

console.log('\nSummary:');
if (mismatches.length === 0) console.log('All vectors matched across JS and Go.');
else {
  console.log(`${mismatches.length} mismatches:`);
  for (const m of mismatches) console.log('-', m.name);
}

process.exit(mismatches.length === 0 ? 0 : 2);
