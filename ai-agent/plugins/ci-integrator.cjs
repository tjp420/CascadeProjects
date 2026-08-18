// CI Integrator plugin: listens for successful or failed execution and posts CI status via event
module.exports.register = function (agentApi) {
  const meta = {
    name: 'ci-integrator',
    version: '0.1.0',
    description: 'Suggests CI steps, appends CI hints, and emits CI status events.'
  };

  meta.beforePlan = async function (goal) {
    if (!goal) return null;
    if (goal.toLowerCase().includes('ci') || goal.toLowerCase().includes('pipeline')) return null;
    return { goal: goal + ' --ci-hint', note: 'CI hint appended by ci-integrator plugin' };
  };

  meta.modifyPlan = async (plan) => plan;

  meta.onExecute = async (result) => {
    try {
      console.log('ci-integrator: onExecute called');
      const status = result && result.success ? 'success' : 'failure';
      if (agentApi && typeof agentApi.registerCapability === 'function') {
        agentApi.registerCapability({ id: 'ci-hint', description: 'Append CI hints to goals' });
        agentApi.registerCapability({ id: 'ci-status', description: 'Emit CI status events' });
      }
      if (agentApi && typeof agentApi.emit === 'function') {
        console.log('ci-integrator: emitting ci:status', status);
        agentApi.emit('ci:status', { status, details: result });
      }
    } catch (e) { /* ignore */ }
  };

  if (agentApi && typeof agentApi.registerPlugin === 'function') agentApi.registerPlugin(meta);
  return meta;
};
