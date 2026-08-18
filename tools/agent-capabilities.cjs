#!/usr/bin/env node
const path = require('path');
const { loadPlugins } = require(path.join(__dirname, '..', 'ai-agent', 'plugins.cjs'));
const fs = require('fs');

const pluginDir = path.join(__dirname, '..', 'ai-agent', 'plugins');
const capabilities = [];
const pluginsMeta = [];
const fakeApi = {
  registerCapability: (c) => { capabilities.push(c); },
  debug: () => {},
  registerPlugin: (m) => { pluginsMeta.push(m); },
  sandbox: { writeTemp: () => null }
};

const args = process.argv.slice(2);
const showMeta = args.includes('--meta');
const pretty = args.includes('--pretty');

loadPlugins(pluginDir, fakeApi);

if (showMeta) {
  if (pretty) {
    console.log('Plugins:');
    for (const p of pluginsMeta) {
      console.log('- ' + (p.name || 'unknown') + ': ' + (p.description || '')); 
    }
  } else {
    console.log(JSON.stringify({ plugins: pluginsMeta }, null, 2));
  }
} else {
  if (pretty) {
    console.log('Capabilities:');
    for (const c of capabilities) console.log('- ' + (typeof c === 'string' ? c : (c.id || JSON.stringify(c))));
  } else {
    console.log(JSON.stringify({ capabilities }, null, 2));
  }
}
