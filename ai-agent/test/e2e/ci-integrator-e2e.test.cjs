const orchestrator = require('../../orchestrator.cjs');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert');

(async function () {
  const statuses = [];
  const originalCall = orchestrator.callLocalModel;
  let originalRunTests;
  const plugins = require('../../plugins.cjs');
  const originalLoad = plugins.loadPlugins;
  try {
    orchestrator.callLocalModel = async () => JSON.stringify([{ op: 'read_file', path: 'package.json' }]);
    // Create package.json if missing
    const pkg = path.resolve(process.cwd(), 'package.json');
    if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: 'tmp' }));

    // Use test harness to attach an in-memory listener to capture ci:status events
    const harness = require('../test-harness.cjs');
    const listener = harness.createListenerPlugin('ci:status', (p) => statuses.push(p));
    // wrap loadPlugins to also register the in-memory listener with the real agentApi
    plugins.loadPlugins = (dir, agentApi) => {
      console.log('ci-e2e: wrapper loadPlugins called');
      const loaded = originalLoad(dir, agentApi);
      try { console.log('ci-e2e: invoking listener.register'); listener.register(agentApi); } catch (e) { console.error(e); }
      return loaded.concat([{ file: 'test-listener', name: 'test-listener', module: listener, meta: { name: 'test-listener' } }]);
    };

    // mock runTests to avoid long-running test commands in CI
    originalRunTests = orchestrator.runTests;
    orchestrator.runTests = () => ({ logOutput: '', testExitCode: 0 });
    const r = await orchestrator.runLocalAgent('Run for CI status');
    // allow event loop to tick and event bus to start processing
    await new Promise((res) => setTimeout(res, 100));
    // wait for async event bus to process events (up to 30s)
    const waitUntil = Date.now() + 30000;
    while (Date.now() < waitUntil && statuses.length === 0) {
      console.log('ci-e2e: waiting for status events...');
      await new Promise((res) => setTimeout(res, 200));
    }
    assert.ok(statuses.length >= 1, 'ci status events captured');
    console.log('ci-integrator e2e passed');
  } finally {
    plugins.loadPlugins = originalLoad;
    orchestrator.callLocalModel = originalCall;
    if (originalRunTests) orchestrator.runTests = originalRunTests;
  }
})().catch(err => { console.error(err); process.exit(2); });
