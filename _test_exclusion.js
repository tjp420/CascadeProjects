// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const { scanDeadCode } = require('./packages/simplebeacon-cli/src/rules/dead-code-scanner');

async function test() {
  const result = await scanDeadCode('c:/Users/Trevor/CascadeProjects', { maxDepth: 20, skipDirs: ['node_modules', '.git'] });
  console.log('Dead code findings:', result.findings);
  const jsFiles = result.issues.filter(i => i.filePath && i.filePath.includes('js-es2018'));
  console.log('js-es2018 findings:', jsFiles.length);
  jsFiles.forEach(i => console.log('  ', i.filePath, i.line, i.description?.slice(0, 60)));
}

test().catch(console.error);
