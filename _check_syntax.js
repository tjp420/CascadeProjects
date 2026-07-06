const fs = require('fs');
const h = fs.readFileSync('c:/Users/Trevor/CascadeProjects/.simplebeacon/codemap.html', 'utf8');
const m = h.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
if (!m) {
  console.log('no script');
  process.exit(1);
}
try {
  new Function(m[1]);
  console.log('Syntax OK');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
