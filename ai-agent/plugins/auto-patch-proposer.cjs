// Auto-patch proposer: listens for auto-fix proposals and attempts a safePatch
module.exports.register = function (agentApi) {
  const meta = { name: 'auto-patch-proposer', description: 'Attempts safe inline patches when proposals appear' };

  async function handleProposal(payload) {
    try {
      agentApi.debug('auto-patch-proposer: proposal received');
      // simple demo: if package.json exists, replace a placeholder name
      const pkg = 'package.json';
      const content = agentApi.readFile(pkg);
      if (!content) return;
      if (content.includes('patched_by_auto')) return; // idempotent
      const search = '"name":';
      const replace = '"name": "patched_by_auto",';
      const res = agentApi.safePatch(pkg, search, replace);
      agentApi.emit('auto-fix:applied', { file: pkg, ok: !!res });
    } catch (e) { agentApi.debug('auto-patch-proposer error ' + e.message); }
  }

  meta.beforePlan = async () => null;
  meta.modifyPlan = async (plan) => plan;
  meta.onExecute = async () => null;

  // register listener via agentApi when plugin is initialized
  if (agentApi && typeof agentApi.on === 'function') {
    agentApi.on('auto-fix:proposal', handleProposal);
  }

  if (agentApi && typeof agentApi.registerPlugin === 'function') agentApi.registerPlugin(meta);
  return meta;
};
