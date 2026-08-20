"use strict";

const crypto = require("crypto");
const {
  CertChainValidator,
  parseCertificate,
  getFingerprint,
  isCertValid,
  verifyCertSignature,
} = require("../cert-chain-validator.cjs");
const {
  generateChain,
  generateExpired,
} = require("./__fixtures__/attestation-certs.cjs");

describe("Certificate Chain Validator", () => {
  let chain;

  beforeEach(() => {
    chain = generateChain();
  });

  test("CERT-01: CertChainValidator can be instantiated", () => {
    const v = new CertChainValidator();
    expect(v).toBeInstanceOf(CertChainValidator);
    expect(v.rootCACount()).toBe(0);
  });

  test("CERT-02: parseCertificate parses PEM certificate", () => {
    const cert = parseCertificate(chain.leafCert);
    expect(cert).toBeInstanceOf(crypto.X509Certificate);
  });

  test("CERT-02b: parseCertificate returns null for invalid input", () => {
    expect(parseCertificate("not a certificate")).toBeNull();
    expect(parseCertificate(null)).toBeNull();
  });

  test("CERT-03: addRootCA adds a root certificate", () => {
    const v = new CertChainValidator();
    expect(v.addRootCA(chain.rootCert)).toBe(true);
    expect(v.rootCACount()).toBe(1);
  });

  test("CERT-03b: addIntermediateCA adds an intermediate certificate", () => {
    const v = new CertChainValidator();
    expect(v.addIntermediateCA(chain.interCert)).toBe(true);
    expect(v.intermediateCACount()).toBe(1);
  });

  test("CERT-04: validateChain validates a valid chain", () => {
    const v = new CertChainValidator();
    v.addRootCA(chain.rootCert);
    v.addIntermediateCA(chain.interCert);
    v.pinRoot(getFingerprint(parseCertificate(chain.rootCert)));
    const result = v.validateChain(chain.leafCert);
    expect(result.valid).toBe(true);
    expect(result.chain.length).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  test("CERT-04b: validateChain rejects when issuer is missing", () => {
    const v = new CertChainValidator();
    const result = v.validateChain(chain.leafCert);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("CERT-06: isCertValid returns true for valid certificate", () => {
    const cert = parseCertificate(chain.leafCert);
    expect(isCertValid(cert)).toBe(true);
  });

  test("CERT-07: pinRoot pins a fingerprint", () => {
    const v = new CertChainValidator();
    const fp = getFingerprint(parseCertificate(chain.rootCert));
    v.pinRoot(fp);
    expect(v.isPinned(fp)).toBe(true);
  });

  test("CERT-07b: validateChain rejects unpinned root when pins configured", () => {
    const v = new CertChainValidator();
    v.addRootCA(chain.rootCert);
    v.addIntermediateCA(chain.interCert);
    v.pinRoot("0".repeat(64));
    const result = v.validateChain(chain.leafCert, { checkPin: true });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not pinned"))).toBe(true);
  });

  test("CERT-07c: validateChain passes when pin check disabled", () => {
    const v = new CertChainValidator();
    v.addRootCA(chain.rootCert);
    v.addIntermediateCA(chain.interCert);
    v.pinRoot("0".repeat(64));
    const result = v.validateChain(chain.leafCert, { checkPin: false });
    expect(result.valid).toBe(true);
  });

  test("CERT-09: validateSevSnpChain validates ARK -> ASK -> VCEK chain", () => {
    const v = new CertChainValidator();
    const result = v.validateSevSnpChain(
      chain.leafCert,
      chain.interCert,
      chain.rootCert,
    );
    expect(result.valid).toBe(true);
    expect(result.chain.length).toBe(3);
  });

  test("CERT-10: validateSgxChain validates Root CA -> PCK CA -> PCK chain", () => {
    const v = new CertChainValidator();
    const result = v.validateSgxChain(
      chain.leafCert,
      chain.interCert,
      chain.rootCert,
    );
    expect(result.valid).toBe(true);
    expect(result.chain.length).toBe(3);
  });

  test("CERT-11: validateChain returns detailed errors", () => {
    const v = new CertChainValidator();
    const result = v.validateChain(chain.leafCert);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("CERT-12: CertChainValidator works without any CAs configured", () => {
    const v = new CertChainValidator();
    const result = v.validateChain(chain.leafCert);
    expect(result.valid).toBe(false);
  });

  test("CERT-12b: extractPublicKey extracts public key from certificate", () => {
    const v = new CertChainValidator();
    const key = v.extractPublicKey(chain.leafCert);
    expect(key).toBeInstanceOf(crypto.KeyObject);
  });

  test("CERT-12c: clear removes all CAs and pins", () => {
    const v = new CertChainValidator();
    v.addRootCA(chain.rootCert);
    v.addIntermediateCA(chain.interCert);
    v.pinRoot(getFingerprint(parseCertificate(chain.rootCert)));
    v.clear();
    expect(v.rootCACount()).toBe(0);
    expect(v.intermediateCACount()).toBe(0);
  });

  test("CERT-12d: getFingerprint returns consistent 64-char hex", () => {
    const cert = parseCertificate(chain.rootCert);
    const fp = getFingerprint(cert);
    expect(fp).toMatch(/^[0-9a-f]+$/);
    expect(fp.length).toBe(64);
  });
});
