const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function isSafeId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9-_]+$/.test(id);
}

function safeJoinBase(base, ...parts) {
  for (const p of parts) {
    if (!isSafeId(p)) throw new Error('Invalid identifier');
  }
  const target = path.join(base, ...parts);
  const resolvedBase = path.resolve(base) + path.sep;
  const resolvedTarget = path.resolve(target) + path.sep;
  if (!resolvedTarget.startsWith(resolvedBase)) throw new Error('Path traversal attempt');
  return target;
}

function jcsCanonicalize(obj) {
  // Minimal JCS-like canonicalization for the reassembler tests: deterministic key ordering.
  function canonicalize(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(canonicalize);
    const keys = Object.keys(value).sort();
    const out = {};
    for (const k of keys) out[k] = canonicalize(value[k]);
    return out;
  }
  return JSON.stringify(canonicalize(obj));
}

function sha256Bytes(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function writeAtomicSync(destPath, buf) {
  const dir = path.dirname(destPath);
  const tmp = path.join(dir, `.${path.basename(destPath)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, destPath);
}

async function validateManifest(stagingDir, manifest) {
  // manifest.expectedLeafHashes: { filename: hash }
  if (!manifest || typeof manifest !== 'object') throw new Error('invalid manifest');
  const expected = manifest.expectedLeafHashes || {};
  for (const filename of Object.keys(expected)) {
    const p = path.join(stagingDir, filename);
    if (!fs.existsSync(p)) throw new Error(`missing chunk ${filename}`);
    const data = fs.readFileSync(p);
    const canonical = jcsCanonicalize(JSON.parse(data.toString()));
    const hash = sha256Bytes(Buffer.from(canonical));
    if (hash !== expected[filename]) throw new Error(`hash mismatch ${filename}`);
  }
  return true;
}

async function stageChunks(stagingDir, chunks) {
  fs.mkdirSync(stagingDir, { recursive: true });
  for (const c of chunks) {
    const dest = path.join(stagingDir, c.filename);
    writeAtomicSync(dest, Buffer.from(c.payload));
  }
}

async function finalizeRehydration(stagingDir, liveDir, manifest, metrics) {
  try {
    await validateManifest(stagingDir, manifest);

    // write manifest
    const manifestPath = path.join(stagingDir, 'manifest.json');
    writeAtomicSync(manifestPath, Buffer.from(JSON.stringify(manifest)));

    // ensure live parent exists
    fs.mkdirSync(path.dirname(liveDir), { recursive: true });

    // increment metric for blocks reconstructed
    const files = fs.readdirSync(stagingDir).filter(f => f !== 'manifest.json');
    if (metrics && typeof metrics.inc === 'function') {
      metrics.inc('hsm_shard_reconstructed_blocks_total', files.length, manifest.labels || {});
      metrics.inc('hsm_shard_reassembly_attempts_total', 1, Object.assign({}, manifest.labels || {}, { outcome: 'succeeded' }));
    }

    // perform atomic swap: rename stagingDir -> liveDir (move into live parent with temporary name then rename)
    if (fs.existsSync(liveDir)) {
      const backup = `${liveDir}.bak.${crypto.randomBytes(4).toString('hex')}`;
      fs.renameSync(liveDir, backup);
      try {
        fs.renameSync(stagingDir, liveDir);
        // cleanup backup
        fs.rmSync(backup, { recursive: true, force: true });
      } catch (err) {
        // attempt rollback
        if (!fs.existsSync(liveDir) && fs.existsSync(backup)) fs.renameSync(backup, liveDir);
        throw err;
      }
    } else {
      fs.renameSync(stagingDir, liveDir);
    }

    return { success: true };
  } catch (err) {
    // cleanup staging on failure where safe
    try {
      if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch (e) {}
    if (metrics && typeof metrics.inc === 'function') {
      metrics.inc('hsm_shard_reassembly_attempts_total', 1, Object.assign({}, manifest && manifest.labels ? manifest.labels : {}, { outcome: 'failed' }));
    }
    throw err;
  }
}

module.exports = {
  jcsCanonicalize,
  sha256Bytes,
  safeJoinBase,
  writeAtomicSync,
  validateManifest,
  stageChunks,
  finalizeRehydration
};
