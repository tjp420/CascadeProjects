const crypto = require('crypto');

// Prototype KEM provider using X25519 ECDH + HKDF-SHA256

function hkdfSha256(ikm, salt = Buffer.alloc(0), info = Buffer.alloc(0), length = 32) {
  return crypto.hkdfSync('sha256', salt, ikm, info, length);
}

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' });
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
  return {
    publicKeyObj: publicKey,
    privateKeyObj: privateKey,
    publicKeyDer: Buffer.from(pubDer),
    privateKeyDer: Buffer.from(privDer),
  };
}

function encapsulate(recipientPublicKeyObj) {
  if (!recipientPublicKeyObj || typeof recipientPublicKeyObj !== 'object') {
    throw new Error('recipientPublicKeyObj must be a KeyObject');
  }
  const { publicKey: ephPubObj, privateKey: ephPrivObj } = crypto.generateKeyPairSync('x25519');
  const ephPubDer = ephPubObj.export({ type: 'spki', format: 'der' });

  const shared = crypto.diffieHellman({ privateKey: ephPrivObj, publicKey: recipientPublicKeyObj });
  const sharedSecret = hkdfSha256(shared, undefined, Buffer.from('ml-kem-768'), 32);

  return { ciphertext: Buffer.from(ephPubDer), sharedSecret };
}

function decapsulate(ciphertextDer, recipientPrivateKeyObj) {
  if (!Buffer.isBuffer(ciphertextDer)) ciphertextDer = Buffer.from(ciphertextDer);
  if (!recipientPrivateKeyObj || typeof recipientPrivateKeyObj !== 'object') {
    throw new Error('recipientPrivateKeyObj must be a KeyObject');
  }
  const ephPubObj = crypto.createPublicKey({ key: ciphertextDer, format: 'der', type: 'spki' });
  const shared = crypto.diffieHellman({ privateKey: recipientPrivateKeyObj, publicKey: ephPubObj });
  const sharedSecret = hkdfSha256(shared, undefined, Buffer.from('ml-kem-768'), 32);
  return sharedSecret;
}

module.exports = { generateKeyPair, encapsulate, decapsulate };
