const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const secretConfig = require('../secret-config.cjs');
const hsmMetrics = require('../hsm-adapter/hsm-metrics.cjs');

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

function signManifest(manifest, secretKey, algo = 'sha256') {
  if (!secretKey) throw new Error('secretKey required');
  const copy = Object.assign({}, manifest);
  delete copy.hmac;
  const canonical = jcsCanonicalize(copy);
  return crypto.createHmac(algo, secretKey).update(canonical).digest('hex');
}

function verifyManifestSignature(manifest, secretKey, algo = 'sha256') {
  if (!manifest || !manifest.hmac) throw new Error('manifest missing hmac');
  const expected = signManifest(manifest, secretKey, algo);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(manifest.hmac));
}

function writeAtomicSync(destPath, buf) {
  const dir = path.dirname(destPath);
  const tmp = path.join(dir, `.${path.basename(destPath)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, destPath);
}

async function validateManifest(stagingDir, manifest) {
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

// finalizeRehydration: validate, auto-fetch missing chunks, write manifest, atomic swap
async function finalizeRehydration(stagingDir, liveDir, manifest, metrics, peers = [], fetchOptions = {}, backoffOpts = {}, secretKey = null) {
  const startMs = Date.now();
  const metricsClient = (metrics && typeof metrics.inc === 'function') ?
    { inc: (n, v) => metrics.inc(n, v, manifest && manifest.labels ? manifest.labels : {}), observe: (n, d) => { if (typeof metrics.observe === 'function') metrics.observe(n, d); } } :
    { inc: (n, v) => hsmMetrics.incrementCounter(n, v), observe: (n, d) => hsmMetrics.observeHistogram(n, d) };

  try {
    fs.mkdirSync(stagingDir, { recursive: true });

    if (!secretKey) {
      try {
        secretKey = secretConfig.resolveSecret('SHARD_MANIFEST_HMAC_SECRET');
      } catch (e) {
        secretKey = null;
      }
    }

    if (secretKey) {
      if (!verifyManifestSignature(manifest, secretKey)) throw new Error('manifest signature invalid');
    }

    const expected = (manifest && manifest.expectedLeafHashes) ? manifest.expectedLeafHashes : {};
    for (const filename of Object.keys(expected)) {
      const p = path.join(stagingDir, filename);
      if (!fs.existsSync(p)) {
        if (!peers || peers.length === 0) throw new Error(`missing chunk ${filename} and no peers configured`);
        const peersUrls = peers.map(u => `${u.replace(/\/\/$/, '')}/${encodeURIComponent(filename)}`);
        const buf = await module.exports.fetchChunkFromPeers(peersUrls, fetchOptions, backoffOpts);
        writeAtomicSync(p, buf);
      }
    }

    await validateManifest(stagingDir, manifest);

    const manifestPath = path.join(stagingDir, 'manifest.json');
    writeAtomicSync(manifestPath, Buffer.from(JSON.stringify(manifest)));

    fs.mkdirSync(path.dirname(liveDir), { recursive: true });

    const files = fs.readdirSync(stagingDir).filter(f => f !== 'manifest.json');
    metricsClient.inc('hsm_shard_reconstructed_blocks_total', files.length);
    metricsClient.inc('hsm_shard_reassembly_attempts_total', 1);
    metricsClient.observe('hsm_shard_reassembly_duration_ms', Date.now() - startMs);

    if (fs.existsSync(liveDir)) {
      const backup = `${liveDir}.bak.${crypto.randomBytes(4).toString('hex')}`;
      fs.renameSync(liveDir, backup);
      try {
        fs.renameSync(stagingDir, liveDir);
        fs.rmSync(backup, { recursive: true, force: true });
      } catch (err) {
        if (!fs.existsSync(liveDir) && fs.existsSync(backup)) fs.renameSync(backup, liveDir);
        throw err;
      }
    } else {
      fs.renameSync(stagingDir, liveDir);
    }

    return { success: true };
  } catch (err) {
    try { if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (e) {}
    metricsClient.inc('hsm_shard_reassembly_attempts_total', 1);
    metricsClient.observe('hsm_shard_reassembly_duration_ms', Date.now() - startMs);
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
  finalizeRehydration,
  signManifest,
  verifyManifestSignature,
};
