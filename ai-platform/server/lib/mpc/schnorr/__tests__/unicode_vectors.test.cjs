const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JcsCanonicalizer } = require('../jcs.cjs');

const jcs = new JcsCanonicalizer();

const vectorsPath = path.join(__dirname, '..', 'vectors.json');
const raw = fs.readFileSync(vectorsPath, 'utf8');
const vectors = JSON.parse(raw);

let failures = 0;
for (const v of vectors) {
  try {
    if (v.equivalents) {
      const outs = v.equivalents.map(x => jcs.canonicalize(x));
      for (let i = 1; i < outs.length; i++) {
        assert.strictEqual(outs[i], outs[0], `${v.name}: equivalents differ (index ${i})`);
      }
      console.log('OK equivalents:', v.name);
    }

    if (v.orderVariants) {
      const outs = v.orderVariants.map(x => jcs.canonicalize(x.obj));
      for (let i = 1; i < outs.length; i++) {
        assert.strictEqual(outs[i], outs[0], `${v.name}: order variants differ (index ${i})`);
      }
      console.log('OK orderVariants:', v.name);
    }

    if (v.shouldDiffer) {
      const outs = v.shouldDiffer.map(x => jcs.canonicalize(x.obj || x));
      // ensure at least two different outputs
      const unique = Array.from(new Set(outs));
      assert(unique.length >= 2, `${v.name}: expected differing canonical outputs`);
      console.log('OK shouldDiffer:', v.name);
    }
  } catch (e) {
    console.error('FAIL:', v.name, e && e.message);
    failures++;
  }
}

if (failures > 0) {
  console.error(`${failures} vector tests failed`);
  process.exit(1);
}
console.log('All vector checks passed');
