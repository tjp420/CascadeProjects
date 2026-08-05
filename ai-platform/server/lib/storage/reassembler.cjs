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

function validateChunkEnvelopes(chunks) {
  for (const c of chunks) {
    if (c.encrypted) {
      if (!c.cipher || !c.iv || !c.authTag) {
        throw new Error('TRACK123_CHUNK_MISSING_ENVELOPE');
      }
      const iv = Buffer.from(c.iv, 'base64');
      const authTag = Buffer.from(c.authTag, 'base64');
      if (iv.length !== 12) throw new Error('TRACK123_CHUNK_INVALID_IV');
      if (authTag.length !== 16) throw new Error('TRACK123_CHUNK_INVALID_AUTH_TAG');
    }
  }
}

function validateChunkSeq(chunks, startSeq) {
  const sorted = [...chunks].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  for (let i = 0; i < sorted.length; i += 1) {
    const expected = startSeq + i;
    const actual = Number(sorted[i].seq);
    if (Number.isNaN(actual) || actual !== expected) {
      throw new Error(`TRACK123_CHUNK_NON_MONOTONIC: expected ${expected}, got ${actual}`);
    }
  }
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

async function stageChunks(stagingDir, chunks, opts = {}) {
  validateChunkEnvelopes(chunks);
  const startSeq = Number(opts.startSeq);
  if (!Number.isNaN(startSeq)) {
    validateChunkSeq(chunks, startSeq);
  }
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
  validateChunkEnvelopes,
  validateChunkSeq,
  validateManifest,
  stageChunks,
  finalizeRehydration
};
