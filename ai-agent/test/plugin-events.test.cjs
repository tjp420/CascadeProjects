const orchestrator = require('../orchestrator.cjs');
const pluginsLoader = require('../plugins.cjs');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('node:assert');

(async function () {
  // Mock the remote model (fetch) to return a single read_file plan
  const originalFetch = global.fetch;
  global.fetch = async function () {
    return {
      ok: true,
      json: async () => ({ response: JSON.stringify([{ op: 'read_file', path: 'package.json' }]) })
    };
  };

  try {
    const loaded = pluginsLoader.loadPlugins(path.join(__dirname, '..', 'plugins'), { debug: () => {}, registerPlugin: () => {} });
    // remove any existing marker
    const marker = path.join(os.tmpdir(), 'ai-agent-auto-fix-marker.txt');
    if (fs.existsSync(marker)) fs.unlinkSync(marker);

    const res = await orchestrator.runLocalAgent('Run plan with plugin hooks');
    assert.ok(res && res.success, 'runLocalAgent should succeed');
    // plugin should have written the marker
    assert.ok(fs.existsSync(marker), 'auto-fix plugin should write marker to tmp');
    const content = fs.readFileSync(marker, 'utf8');
    assert.ok(content.includes('executed:'), 'marker content present');
    console.log('plugin-events test passed');
  } finally {
    if (originalFetch) global.fetch = originalFetch;
  }
})().catch(err => { console.error(err); process.exit(2); });
