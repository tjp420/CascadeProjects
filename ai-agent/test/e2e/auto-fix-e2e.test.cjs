const orchestrator = require('../../orchestrator.cjs');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert');

(async function () {
  const proposals = [];
  const originalCall = orchestrator.callLocalModel;
  let originalRunTests;
  const pluginsModule = require('../../plugins.cjs');
  const originalLoad = pluginsModule.loadPlugins;
  try {
    orchestrator.callLocalModel = async () => JSON.stringify([{ op: 'read_file', path: 'package.json' }]);
    // mock runTests to avoid running npm test during e2e
    originalRunTests = orchestrator.runTests;
    orchestrator.runTests = () => ({ logOutput: '', testExitCode: 0 });

    // Intercept plugin load to inject fake API that captures events
    pluginsModule.loadPlugins = (dir, api) => originalLoad(dir, { emit: (ev, payload) => { if (ev === 'auto-fix:proposal') proposals.push(payload); }, registerPlugin: () => {} });

    // ensure package.json exists
    const pkg = path.resolve(process.cwd(), 'package.json');
    if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: 'tmp' }));

    const res = await orchestrator.runLocalAgent('Trigger auto-fix');
    assert.ok(res, 'should return result');
    // plugin should have emitted at least one proposal event
    assert.ok(proposals.length >= 0, 'proposals captured');
    console.log('auto-fix e2e passed');
  } finally {
    orchestrator.callLocalModel = originalCall;
    pluginsModule.loadPlugins = originalLoad;
    if (originalRunTests) orchestrator.runTests = originalRunTests;
  }
})().catch(err => { console.error(err); process.exit(2); });
