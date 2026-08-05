const crypto = require('crypto');

function hkdfSha256(ikm, salt = Buffer.alloc(0), info = Buffer.alloc(0), length = 32) {
  return Buffer.from(crypto.hkdfSync('sha256', salt, ikm, info, length));
}

// KDF_RK: derive new root and chain key from previous root and DH output
function kdfRoot(prevRoot, dhOut) {
  const infoRoot = Buffer.from('KDF_RK_root');
  const newRoot = hkdfSha256(dhOut, prevRoot, infoRoot, 32);
  const infoCK = Buffer.from('KDF_RK_ck');
  const newCK = hkdfSha256(dhOut, newRoot, infoCK, 32);
  return { root: newRoot, ck: newCK };
}

// KDF_CK: derive message key and next chain key from chain key
function kdfChain(ck) {
  const infoMk = Buffer.from('KDF_CK_mk');
  const mk = hkdfSha256(ck, undefined, infoMk, 32);
  const infoNext = Buffer.from('KDF_CK_next');
  const nextCk = hkdfSha256(ck, undefined, infoNext, 32);
  return { messageKey: mk, nextCk };
}

// Initialize ratchet root/chain from initial shared secret (e.g., KEM output)
function initializeFromShared(sharedSecret) {
  const infoRoot = Buffer.from('init_root');
  const root = hkdfSha256(sharedSecret, undefined, infoRoot, 32);
  const infoCK = Buffer.from('init_ck');
  const ck = hkdfSha256(sharedSecret, root, infoCK, 32);
  return { root, ck };
}

module.exports = { hkdfSha256, kdfRoot, kdfChain, initializeFromShared };
