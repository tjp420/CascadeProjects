const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');

function safeReadFileSync(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (err) {
    // Return null on read errors (permission, EMFILE, etc.)
    return null;
  }
}

parentPort.on('message', async ({ paths }) => {
  let filesProcessed = 0;
  let linesCounted = 0;

  for (const targetPath of paths || []) {
    try {
      const stats = fs.statSync(targetPath);
      if (stats.isFile()) {
        filesProcessed++;
        const content = safeReadFileSync(targetPath);
        if (content !== null) {
          linesCounted += content.split('\n').length;
        } else {
          parentPort.postMessage({ type: 'warn', path: targetPath, reason: 'read_failed' });
        }
      }
    } catch (err) {
      parentPort.postMessage({ type: 'error', path: targetPath, error: err && err.code ? err.code : String(err) });
    }
  }

  parentPort.postMessage({ type: 'result', filesProcessed, linesCounted });
});
