// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const htmlPath = path.join(__dirname, '__test_dashboard.html');
if (!fs.existsSync(htmlPath)) {
  process.stdout.write('Dashboard HTML not found, extracting...\n');
  spawnSync('node', [path.join(__dirname, '__extract_html.cjs')], { stdio: 'inherit' });
}

if (!fs.existsSync(htmlPath)) {
  console.error('Failed to generate dashboard HTML. Run "npm run compile" first.');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const PORT = process.env.SB_TEST_PORT || 8766;
const HOST = process.env.SB_TEST_HOST || '127.0.0.1';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Server running at http://${HOST}:${PORT}\n`);
});
