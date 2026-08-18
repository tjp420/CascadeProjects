const orchestrator = require('../orchestrator.cjs');
const assert = require('node:assert');

(async function testPlanModification() {
  // Mock model to return a single-step plan (read package.json)
  const originalCall = orchestrator.callLocalModel;
  orchestrator.callLocalModel = async function () {
    return JSON.stringify([{ op: 'read_file', path: 'package.json' }]);
  };

  try {
    // Inspect loaded plugins before running
    const pluginsLoader = require('../plugins.cjs');
    const loaded = pluginsLoader.loadPlugins(require('path').join(__dirname, '..', 'plugins'), { debug: console.log, registerPlugin: () => {} });
    console.log('loaded plugins in test:', loaded.map(p => ({ name: p.name, meta: p.meta && p.meta.name })));

    // Instead of running full agent (which makes network/model calls),
    // parse a mock plan and apply plugin `modifyPlan` hooks directly.
    const mockPlanResponse = JSON.stringify([{ op: 'read_file', path: 'package.json' }]);
    const plan = orchestrator.parsePlan(mockPlanResponse);
    let augmented = plan;
    for (const p of loaded) {
      if (p && p.meta && typeof p.meta.modifyPlan === 'function') {
        augmented = await p.meta.modifyPlan(augmented);
      }
    }
    // Example plugin appends package.json, so steps should be >=2
    assert.ok(Array.isArray(augmented), 'Augmented plan must be array');
    assert.ok(augmented.length >= 2, 'Plan should have been augmented by plugin');
    console.log('plan-modify test passed');
  } finally {
    orchestrator.callLocalModel = originalCall;
  }
})().catch(err => { console.error(err); process.exit(2); });
