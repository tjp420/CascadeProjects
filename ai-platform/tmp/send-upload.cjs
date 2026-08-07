const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const tmpDir = path.join(root, 'tmp-upload');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello world');

// The local license module in this workspace only exposes a verifier, not a generator.
// Synthesize a permissive token payload (the verifier decodes the payload without signature checks).
function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const payload = { email: 'dev@example.com', tier: 'instant', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
const payloadB64 = base64UrlEncode(JSON.stringify(payload));
const token = `h.${payloadB64}.s`;
console.log('Synthesized token payload:', JSON.stringify(payload));

const curlCmd = `curl -s -v -F "files=@${path.join(tmpDir, 'test.txt')}" -F "filePaths=[\"test.txt\"]" -F "analysisType=simplebeacon" -F "licenseToken=${token}" http://127.0.0.1:58000/api/analyze/upload-directory`;
console.log('Running:', curlCmd);
try {
  const out = execSync(curlCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  console.log('Response:', out);
} catch (e) {
  console.error('Curl failed:', e.stderr ? e.stderr.toString() : e.message);
  process.exit(1);
}
