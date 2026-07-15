// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const h = fs.readFileSync('.simplebeacon/codemap.html', 'utf8');
const s = h.indexOf('id="graphData"') + 14;
const e = h.indexOf('</script>', s);
const json = h.substring(s, e);
const d = JSON.parse(json);
console.log('Nodes:', d.nodes.length);
console.log('Edges:', d.edges.length);
console.log('First node:', d.nodes[0].id);
