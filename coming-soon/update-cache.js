const fs = require('fs');
const path = require('path');

const hash = 'h=' + Date.now();
const files = ['audit.html', 'roadmap.html'];

files.forEach(f => {
  const fp = path.join(__dirname, f);
  if (!fs.existsSync(fp)) return;
  let content = fs.readFileSync(fp, 'utf8');
  const before = content;
  content = content.replace(/\?v=[^"'&\s]+/g, '?' + hash);
  if (content !== before) {
    fs.writeFileSync(fp, content);
  }
});

// Keep build-hash.json in sync
fs.writeFileSync(path.join(__dirname, 'build-hash.json'), JSON.stringify({ hash }, null, 2) + '\n');
