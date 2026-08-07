const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const tmpDir = path.join(root, 'tmp-upload');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello world');

const licenseModule = require(path.join(root, 'packages', 'simplebeacon-cli', 'src', 'lib', 'license-token.js'));
const token = licenseModule.generateLicenseToken({ email: 'dev@example.com', tier: 'developer' }, 'simplebeacon-dev-insecure', 60);
console.log('Generated token:', token.substring(0, 40) + '...');

const curlCmd = `curl -s -v -F "files=@${path.join(tmpDir, 'test.txt')}" -F "filePaths=[\"test.txt\"]" -F "analysisType=simplebeacon" -F "licenseToken=${token}" http://127.0.0.1:58000/api/analyze/upload-directory`;
console.log('Running:', curlCmd);
try {
  const out = execSync(curlCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  console.log('Response:', out);
} catch (e) {
  console.error('Curl failed:', e.stderr ? e.stderr.toString() : e.message);
  process.exit(1);
}
