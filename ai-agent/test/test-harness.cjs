// Test harness helpers for registering in-memory listeners without writing files
exports.createListenerPlugin = function(eventName, cb) {
  return {
    register: function(agentApi) {
      if (agentApi && typeof agentApi.on === 'function') {
        try { console.log('test-harness: registering listener for', eventName); agentApi.on(eventName, cb); } catch (e) { console.error(e); }
      }
      return { name: 'test-listener-' + eventName };
    }
  };
};
