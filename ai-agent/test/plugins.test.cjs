const path = require('path');
const { loadPlugins } = require('../plugins.cjs');

const assert = require('node:assert');

async function test() {
  const agentApi = { registerPlugin: (m) => { agentApi._reg = agentApi._reg || []; agentApi._reg.push(m); }, debug: console.log };
  const pluginDir = path.join(__dirname, '..', 'plugins');
  const loaded = loadPlugins(pluginDir, agentApi);
  assert.ok(Array.isArray(loaded), 'loaded must be array');
  assert.ok(loaded.length > 0, 'should load at least one plugin');
  const ex = loaded.find(p => p.name && p.name.includes('example-plugin')) || loaded[0];
  assert.ok(ex.module, 'module present');
  assert.strictEqual(ex.meta.name, 'example-plugin');
  // ensure hooks exist on the registered meta
  assert.strictEqual(typeof ex.meta.beforePlan, 'function');
  assert.strictEqual(typeof ex.meta.modifyPlan, 'function');
  console.log('plugin loader test passed');
}

test().catch(err => { console.error(err); process.exit(2); });
