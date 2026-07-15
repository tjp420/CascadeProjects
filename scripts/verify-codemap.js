// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const h = fs.readFileSync('.simplebeacon/codemap.html', 'utf8');
const s = h.indexOf('id="graphData"') + 14;
const e = h.indexOf('</script>', s);
const d = JSON.parse(h.slice(s, e));
console.log('Nodes:', d.nodes.length, 'Edges:', d.edges.length);
console.log('First:', d.nodes[0].id);
console.log('Last:', d.nodes[d.nodes.length - 1].id);
