/**
 * Injected into the dashboard page by the content script.
 * Exposes window.simplebeaconAgentBridge so the dashboard can call the
 * localhost agent without being blocked by HTTPS mixed-content policy.
 */
(function () {
  'use strict';

  if (window.simplebeaconAgentBridge) {
    return;
  }

  const REQUEST_TIMEOUT_MS = 310000; // Slightly longer than the agent's 5-minute scan timeout.
  let requestId = 0;
  const pending = new Map();

  window.addEventListener('simplebeacon-agent-response', (event) => {
    const detail = event.detail;
    if (!detail || !detail.id) {
      return;
    }
    const resolver = pending.get(detail.id);
    if (!resolver) {
      return;
    }
    pending.delete(detail.id);
    clearTimeout(resolver.timer);
    resolver.resolve(detail);
  });

  function sendRequest(method, url, body) {
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Extension bridge request timed out'));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      window.dispatchEvent(
        new CustomEvent('simplebeacon-agent-request', {
          detail: { id, method, url, body },
          bubbles: true
        })
      );
    });
  }

  window.simplebeaconAgentBridge = {
    async fetch(url, options = {}) {
      const method = options.method || 'GET';
      const body = options.body || null;
      const response = await sendRequest(method, url, body);
      return {
        ok: response.ok,
        status: response.status,
        headers: {
          get: () => 'application/json'
        },
        json: async () => response.body,
        text: async () => JSON.stringify(response.body)
      };
    }
  };

  // Notify the dashboard that the bridge is ready.
  window.dispatchEvent(new CustomEvent('simplebeacon-agent-bridge-ready', { detail: { version: '1.0.0' } }));
}());
