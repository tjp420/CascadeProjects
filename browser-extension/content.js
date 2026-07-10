/**
 * Content script for the Simplebeacon Local Agent Bridge extension.
 *
 * Injects bridge-inject.js into the page so the dashboard can call
 * window.simplebeaconAgentBridge.fetch(...), then relays those requests to
 * the extension's service worker and returns the response.
 */
(function () {
  'use strict';

  // Only run in the top frame.
  if (window !== window.top) {
    return;
  }

  // Inject the page-side bridge script.
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('bridge-inject.js');
  script.setAttribute('type', 'text/javascript');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => {
    script.remove();
  };

  // Relay page requests to the service worker.
  window.addEventListener('simplebeacon-agent-request', (event) => {
    const detail = event.detail;
    if (!detail || !detail.id) {
      return;
    }
    chrome.runtime.sendMessage(
      { type: 'AGENT_REQUEST', detail },
      (response) => {
        if (chrome.runtime.lastError) {
          window.dispatchEvent(
            new CustomEvent('simplebeacon-agent-response', {
              detail: {
                id: detail.id,
                ok: false,
                status: 0,
                body: { success: false, error: chrome.runtime.lastError.message }
              },
              bubbles: true
            })
          );
          return;
        }
        window.dispatchEvent(
          new CustomEvent('simplebeacon-agent-response', {
            detail: response,
            bubbles: true
          })
        );
      }
    );
  });
}());
