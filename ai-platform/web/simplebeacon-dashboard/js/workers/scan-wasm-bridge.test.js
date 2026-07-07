/**
 * Node smoke test for the JS fallback analyzer in scan-wasm-bridge.js.
 * This does not test the WebAssembly path (requires Rust build), but verifies
 * the chunked JS analyzer produces the expected findings and PE detection.
 */

import { analyzeFileChunks, findingsToIssues } from './scan-wasm-bridge.js';
import assert from 'node:assert';
import { File } from 'node:buffer';

async function test() {
  // Text file with debug artifacts and TODO markers
  const text = 'console.log("debug");\n// TODO fix before release\nconst password = "secret123";\n';
  const textFile = new File([text], 'sample.js', { type: 'text/javascript' });
  const results = await analyzeFileChunks(textFile, 'sample.js', 64);
  assert.strictEqual(results.total_bytes > 0, true);
  assert.strictEqual(results.is_pe, false);
  const rules = results.findings.map((f) => f.rule).sort();
  assert.deepStrictEqual(rules, ['credentials', 'debugArtifacts', 'todoMarkers']);

  // PE binary detection (first two bytes are MZ)
  const pe = new Uint8Array([0x4D, 0x5A, 0x00, 0x00, 0x00]);
  const peFile = new File([pe], 'app.exe', { type: 'application/octet-stream' });
  const peResults = await analyzeFileChunks(peFile, 'app.exe', 64);
  assert.strictEqual(peResults.is_pe, true);

  // Issue conversion
  const issues = findingsToIssues(results, 'sample.js');
  assert.strictEqual(issues.some((i) => i.rule === 'credentials' && i.severity === 'critical'), true);

  console.log('scan-wasm-bridge JS fallback tests passed');
}

test().catch((e) => {
  console.error(e);
  process.exit(1);
});
