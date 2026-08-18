// Webhook CI Poster: posts CI status to a webhook (demo: emits 'ci:posted')
module.exports.register = function (agentApi) {
  const meta = { name: 'webhook-ci-poster', description: 'Posts CI status to a webhook URL (demo)' };

  async function handleStatus(payload) {
    try {
      const webhook = process.env.CI_WEBHOOK_URL || null;
      agentApi.debug('webhook-ci-poster: received ci status');
      // In test/demo mode, do not perform external network calls; emit an internal event
      agentApi.emit('ci:posted', { webhook: webhook || 'none', payload });
    } catch (e) { agentApi.debug('webhook-ci-poster error ' + e.message); }
  }

  if (agentApi && typeof agentApi.on === 'function') agentApi.on('ci:status', handleStatus);
  if (agentApi && typeof agentApi.registerPlugin === 'function') agentApi.registerPlugin(meta);
  return meta;
};
