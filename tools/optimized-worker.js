const { parentPort } = require('worker_threads');
const fs = require('fs');

parentPort.on('message', (msg) => {
  const paths = msg.paths || [];
  // Accept either a SharedArrayBuffer or an Int32Array view named sharedIntArray
  const sharedBuffer = msg.sharedBuffer || (msg.sharedIntArray && msg.sharedIntArray.buffer);
  const sharedIntArray = sharedBuffer ? new Int32Array(sharedBuffer) : null;

  let filesProcessed = 0;
  let linesCounted = 0;

  for (const targetPath of paths) {
    try {
      const stats = fs.statSync(targetPath);
      if (stats.isFile()) {
        filesProcessed++;
        const content = fs.readFileSync(targetPath, 'utf8');
        // simple line count
        linesCounted += content.split('\n').length;
      }
    } catch (err) {
      // Track unreadable files in slot 2 if shared buffer is present
      if (sharedIntArray) Atomics.add(sharedIntArray, 2, 1);
    }
    // Atomically increment Slot 3 after every individual file pass for live cursor metrics
    if (sharedIntArray) Atomics.add(sharedIntArray, 3, 1);
  }

  if (sharedIntArray) {
    // Slot 0 = files, Slot 1 = lines, Slot 2 = errors
    Atomics.add(sharedIntArray, 0, filesProcessed);
    Atomics.add(sharedIntArray, 1, linesCounted);
  }

  parentPort.postMessage({ status: 'done' });
});
