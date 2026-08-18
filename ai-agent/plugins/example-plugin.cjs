// Example SimpleBeacon AI coding agent plugin
// Exports `register(agentApi)` and uses `agentApi.registerPlugin` to declare capabilities.

module.exports.register = function (agentApi) {
  const meta = {
    name: 'example-plugin',
    version: '0.1.0',
    description: 'Sample plugin that offers a basic goal hint capability.',
    handleGoal: async function (goal) {
      if (!goal || typeof goal !== 'string') return null;
      if (goal.toLowerCase().includes('tests')) {
        return { ok: true, suggestion: 'Run `npm test --workspaces --if-present` first and collect failing suites.' };
      }
      if (goal.toLowerCase().includes('scan')) {
        return { ok: true, suggestion: 'Run `npx simplebeacon scan --gate --format json` to produce a report.' };
      }
      return { ok: true, suggestion: 'I can help analyze tests, propose small patches, and suggest scan commands.' };
    }
  };

  // Optional hook: called before planning, may return a modified goal or suggestions.
    meta.beforePlan = async (goal) => {
      if (!goal) return null;
      if (goal.toLowerCase().includes('fast')) {
        return { goal: goal + ' --quick-scan', note: 'Appended quick scan hint' };
      }
      return null;
    };

  // Optional hook: modify plan array (JSON steps) before execution.
  meta.modifyPlan = async function (plan) {
    if (!Array.isArray(plan)) return plan;
    // Add a simple verification step at the end (read package.json which exists)
    plan.push({ op: 'read_file', path: 'package.json' });
    return plan;
  };
    meta.onExecute = async (execution) => {
      try {
        // Example: when execution succeeds, write a temp marker via sandbox
        if (execution && execution.length) {
          const p = agentApi.sandbox.writeTemp('example-plugin-marker.txt', 'executed');
          agentApi.debug('example-plugin wrote marker at ' + p);
        }
      } catch (e) {}
    };

  if (agentApi && typeof agentApi.registerPlugin === 'function') {
    agentApi.registerPlugin(meta);
  }
  return meta;
};
