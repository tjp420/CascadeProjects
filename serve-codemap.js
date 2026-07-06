const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/Trevor/CascadeProjects/.simplebeacon';

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  let filePath = path.join(dir, decodeURIComponent(req.url));
  if (!filePath.startsWith(dir)) filePath = dir;
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
  } catch (e) {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(8084, '127.0.0.1', () => console.log('http://127.0.0.1:8084'));
