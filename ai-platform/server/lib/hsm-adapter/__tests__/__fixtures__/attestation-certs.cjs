"use strict";

/**
 * In-memory test X.509 certificate chain fixtures.
 *
 * Uses node-forge (already a transitive dependency of selfsigned) to build
 * a deterministic, valid RSA 2048 root -> intermediate -> leaf chain, plus
 * an expired self-signed certificate, entirely in memory.  The resulting PEM
 * strings are consumable by Node's native crypto.X509Certificate and the
 * cert-chain-validator module.
 */

const forge = require("node-forge");

function _attrs(commonName) {
  return [{ name: "commonName", value: commonName }];
}

function _certPem(
  attrs,
  issuerAttrs,
  publicKey,
  signingKey,
  notBefore,
  notAfter,
  isCa,
) {
  const cert = forge.pki.createCertificate();
  cert.serialNumber = "01";
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;
  cert.setSubject(attrs);
  cert.setIssuer(issuerAttrs);
  cert.publicKey = publicKey;
  cert.setExtensions([
    { name: "basicConstraints", cA: isCa },
    {
      name: "keyUsage",
      keyCertSign: isCa,
      digitalSignature: true,
      keyEncipherment: !isCa,
    },
  ]);
  cert.sign(signingKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

function _genKeyPair() {
  return forge.pki.rsa.generateKeyPair(2048);
}

function generateChain() {
  const rootKp = _genKeyPair();
  const interKp = _genKeyPair();
  const leafKp = _genKeyPair();

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const rootCert = _certPem(
    _attrs("Test Root CA"),
    _attrs("Test Root CA"),
    rootKp.publicKey,
    rootKp.privateKey,
    now,
    tomorrow,
    true,
  );

  const interCert = _certPem(
    _attrs("Test Intermediate CA"),
    _attrs("Test Root CA"),
    interKp.publicKey,
    rootKp.privateKey,
    now,
    tomorrow,
    true,
  );

  const leafCert = _certPem(
    _attrs("Test VCEK"),
    _attrs("Test Intermediate CA"),
    leafKp.publicKey,
    interKp.privateKey,
    now,
    tomorrow,
    false,
  );

  return {
    rootCert,
    interCert,
    leafCert,
    rootKey: forge.pki.privateKeyToPem(rootKp.privateKey),
    interKey: forge.pki.privateKeyToPem(interKp.privateKey),
    leafKey: forge.pki.privateKeyToPem(leafKp.privateKey),
  };
}

function generateSelfSigned(commonName) {
  const kp = _genKeyPair();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const cert = _certPem(
    _attrs(commonName),
    _attrs(commonName),
    kp.publicKey,
    kp.privateKey,
    now,
    tomorrow,
    true,
  );
  return { cert, private: forge.pki.privateKeyToPem(kp.privateKey) };
}

function generateExpired(commonName) {
  const kp = _genKeyPair();
  const notBefore = new Date(Date.now() - 200000);
  const notAfter = new Date(Date.now() - 100000);
  const cert = _certPem(
    _attrs(commonName),
    _attrs(commonName),
    kp.publicKey,
    kp.privateKey,
    notBefore,
    notAfter,
    true,
  );
  return { cert, private: forge.pki.privateKeyToPem(kp.privateKey) };
}

module.exports = {
  generateChain,
  generateSelfSigned,
  generateExpired,
};
