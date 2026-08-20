"use strict";

/**
 * Track 13: Multi-tenant Data Encryption Key (DEK) derivation.
 *
 * Derives a per-transaction DEK from a tenant base KEK, a transaction salt,
 * the tenant identifier, and an optional key label. The tenantId is mixed
 * into the HKDF info parameter so the same base KEK and salt never produce
 * the same DEK for two different tenants.
 *
 * @module hsm-adapter/multi-tenant-kek-derivation
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const SALT_LENGTH = 16;
const SUPPORTED_KEK_LENGTHS = [16, 24, 32];

/**
 * Generate a fresh high-entropy salt for one DEK derivation.
 * @returns {Buffer}
 */
function deriveSalt() {
  return crypto.randomBytes(SALT_LENGTH);
}

/**
 * Derive a 256-bit DEK for a specific tenant, base KEK, salt and key label.
 * @param {Buffer} baseKek - 128/192/256-bit base KEK (the tenant's KEK)
 * @param {Buffer} salt - 16-byte transaction salt
 * @param {string} tenantId
 * @param {string} [keyId='default'] - label for this DEK
 * @returns {Buffer} 32-byte DEK
 */
function deriveDek(baseKek, salt, tenantId, keyId = "default") {
  if (
    !Buffer.isBuffer(baseKek) ||
    !SUPPORTED_KEK_LENGTHS.includes(baseKek.length)
  ) {
    throw new HsmAdapterError(
      "INVALID_KEK_LENGTH",
      `baseKek must be ${SUPPORTED_KEK_LENGTHS.join("/")} bytes`,
    );
  }
  if (!Buffer.isBuffer(salt) || salt.length !== SALT_LENGTH) {
    throw new HsmAdapterError(
      "INVALID_SALT",
      `salt must be a ${SALT_LENGTH}-byte Buffer`,
    );
  }
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new HsmAdapterError(
      "UNAUTHORIZED_KEY_ACCESS",
      "tenantId must be a non-empty string",
    );
  }
  if (typeof keyId !== "string" || keyId.length === 0) {
    throw new HsmAdapterError(
      "INVALID_INPUT",
      "keyId must be a non-empty string",
    );
  }

  const info = `${tenantId}:${keyId}`;
  return Buffer.from(crypto.hkdfSync("sha256", baseKek, salt, info, 32));
}

module.exports = {
  deriveDek,
  deriveSalt,
  SALT_LENGTH,
};
