/**
 * Service worker for the Simplebeacon Local Agent Bridge extension.
 *
 * Receives agent-request messages from content scripts and fetches the
 * localhost agent directly, bypassing HTTPS mixed-content restrictions.
 */
const DEFAULT_AGENT_ORIGIN = 'http://127.0.0.1:55432';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'AGENT_REQUEST' || !message.detail) {
    sendResponse({
      id: message?.detail?.id,
      ok: false,
      status: 400,
      body: { success: false, error: 'Invalid bridge request' }
    });
    return false;
  }

  const { id, method, url, body } = message.detail;
  const absoluteUrl = url.startsWith('http') ? url : `${DEFAULT_AGENT_ORIGIN}${url}`;
  const options = {
    method: method || 'GET',
    headers: { Accept: 'application/json' }
  };
  if (body && (method === 'POST' || method === 'PUT')) {
    options.headers['Content-Type'] = 'application/json';
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  fetch(absoluteUrl, options)
    .then(async (response) => {
      const bodyData = await response.json().catch(() => ({}));
      sendResponse({
        id,
        ok: response.ok,
        status: response.status,
        body: bodyData
      });
    })
    .catch((err) => {
      sendResponse({
        id,
        ok: false,
        status: 0,
        body: { success: false, error: err.message || 'Extension bridge fetch failed' }
      });
    });

  // Keep the message channel open for async sendResponse.
  return true;
});
