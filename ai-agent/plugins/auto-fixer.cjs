// Auto-fixer plugin: listens for 'plan:failed' events and proposes a patch
module.exports.register = function (agentApi) {
  const meta = {
    name: 'auto-fixer',
    description: 'Proposes inline patches when plan execution fails',
    beforePlan: async (goal) => { return null; },
    modifyPlan: async (plan) => { return plan; },
    onExecute: async (result) => {
      try {
        // Emit a proposal event for any execution to assist testing and demos
        agentApi.debug('auto-fixer: observed execution, proposing patch (demo)');
        agentApi.registerCapability('auto-fix');
        agentApi.emit('auto-fix:proposal', { execution: result });
      } catch (e) { /* ignore */ }
    }
  };
  return meta;
};
