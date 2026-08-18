const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports.register = function (agentApi) {
  const meta = {
    name: 'auto-fix-proposer',
    version: '0.1.0',
    description: 'Proposes simple fixes after plan execution and writes a marker to tmp.'
  };

  meta.onExecute = async function (executionLog) {
    // write a small marker file so tests can assert this hook ran
    try {
      const marker = 'ai-agent-auto-fix-marker.txt';
      const content = `executed:${new Date().toISOString()}\nlog:${JSON.stringify(executionLog).slice(0,200)}`;
      const p = agentApi && agentApi.sandbox && agentApi.sandbox.writeTemp ? agentApi.sandbox.writeTemp(marker, content) : path.join(os.tmpdir(), marker);
      return { ok: true, markerPath: p };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  if (agentApi && typeof agentApi.registerCapability === 'function') {
    agentApi.registerCapability({ id: 'auto-fix', description: 'Suggest small inline patches.' });
  }

  if (agentApi && typeof agentApi.registerPlugin === 'function') agentApi.registerPlugin(meta);
  return meta;
};
