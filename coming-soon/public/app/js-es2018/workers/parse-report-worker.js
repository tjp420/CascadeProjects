/* Web Worker to parse large JSON payloads off the main thread.
   Receives {type: 'parse', text: string} and responds with {type:'parsed', value}
*/
self.addEventListener('message', (ev) => {
  try {
    const msg = ev.data || {};
    if (msg && msg.type === 'parse' && typeof msg.text === 'string') {
      // Attempt streaming parse fallback by using JSON.parse in try/catch
      const value = JSON.parse(msg.text);
      self.postMessage({ type: 'parsed', value });
    }
    else if (msg && msg.type === 'ping') {
      self.postMessage({ type: 'pong' });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
  }
});
