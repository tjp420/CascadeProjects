const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Atomically write data to `finalPath` by writing to a same-dir temp file
 * and renaming into place. This is a synchronous helper to match callers
 * that expect immediate durability.
 * @param {string} finalPath
 * @param {Buffer|string} data
 * @param {{mode?: number}} [options]
 */
function writeAtomicSync(finalPath, data, options = {}) {
  if (typeof finalPath !== 'string') throw new TypeError('finalPath must be a string');
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const rnd = crypto.randomBytes(6).toString('hex');
  const tmp = path.join(dir, `.${path.basename(finalPath)}.${process.pid}.${rnd}.tmp`);
  const mode = options.mode || 0o600;

  // Write to temp file first
  if (Buffer.isBuffer(data)) {
    fs.writeFileSync(tmp, data, { mode });
  } else {
    fs.writeFileSync(tmp, String(data), { mode });
  }

  // Rename into place (atomic on POSIX; on Windows this replaces existing file)
  try {
    fs.renameSync(tmp, finalPath);
  } catch (err) {
    console.error('fs-atomic.cjs error:', err);
    // If rename fails, attempt to cleanup temp and rethrow
    try { fs.unlinkSync(tmp); } catch (e) { console.error('fs-atomic.cjs error:', e); }
    throw err;
  }
}

module.exports = { writeAtomicSync };
