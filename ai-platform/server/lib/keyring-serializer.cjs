'use strict';

/**
 * keyring-serializer.cjs
 * Consolidated Single-Envelope Serialization Pipeline with Embedded AES-KWP Protection.
 */
const { wrapPad, unwrapPad } = require('./aes-kw.cjs');

const MAGIC = Buffer.from([0x54, 0x31, 0x30, 0x4B]); // "T10K" Track 10 Keyring
const SCHEMA_VERSION = 1;
const MAX_BYTE_SIZE = 10 * 1024 * 1024; // 10 MB strict ceiling

class KeyringValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KeyringValidationError';
  }
}

/**
 * Serializes a raw payload structure into a single binary envelope.
 * @param {Object} keyringData - Object structure containing key data maps.
 * @param {Buffer} kek - Validated Key Encryption Key (16, 24, or 32 bytes).
 * @returns {Buffer} Standardized Track 10 binary container.
 */
function serialize(keyringData, kek) {
  if (!keyringData || typeof keyringData !== 'object') {
    throw new KeyringValidationError('Invalid dataset payload provided for serialization.');
  }
  if (!Buffer.isBuffer(kek)) {
    throw new KeyringValidationError('KEK must be a Buffer.');
  }
  if (![16, 24, 32].includes(kek.length)) {
    throw new KeyringValidationError('Invalid KEK length. Must be 128, 192, or 256 bits.');
  }

  try {
    // 1. Convert structural maps to flat binary payload
    const bodyPlaintext = Buffer.from(JSON.stringify(keyringData), 'utf8');

    // 2. Encrypt structural map body via verified AES-KWP
    const encryptedBody = wrapPad(kek, bodyPlaintext);

    // 3. Construct the canonical 12-byte binary header
    const header = Buffer.alloc(12);
    MAGIC.copy(header, 0);
    header.writeUInt16BE(SCHEMA_VERSION, 4);
    header.writeUInt16BE(0, 6); // Flags placeholder
    header.writeUInt32BE(encryptedBody.length, 8);

    const totalPayload = Buffer.concat([header, encryptedBody]);

    if (totalPayload.length > MAX_BYTE_SIZE) {
      throw new KeyringValidationError(
        `Serialized payload exceeds strict structural safety limits (${MAX_BYTE_SIZE} bytes).`
      );
    }

    return totalPayload;
  } catch (error) {
    if (error instanceof KeyringValidationError) throw error;
    throw new Error(`Pipeline Serialization failure context: ${error.message}`);
  }
}

/**
 * De-serializes, strips headers, and decrypts structural envelope formats.
 * @param {Buffer} buffer - Standardized Track 10 raw envelope.
 * @param {Buffer} kek - Master Key Encryption Key context mapping layer.
 * @returns {Object} Reconstituted application runtime map structures.
 */
function deserialize(buffer, kek) {
  if (!Buffer.isBuffer(buffer)) {
    throw new KeyringValidationError('Target dataset for parsing must evaluate as a valid structural Buffer object.');
  }
  if (!Buffer.isBuffer(kek)) {
    throw new KeyringValidationError('KEK must be a Buffer.');
  }
  if (![16, 24, 32].includes(kek.length)) {
    throw new KeyringValidationError('Invalid KEK length. Must be 128, 192, or 256 bits.');
  }
  if (buffer.length < 12) {
    throw new KeyringValidationError('Malformed input stream: Header chunk length is under threshold limits.');
  }

  // 1. Verify Magic footprint markers
  if (!buffer.subarray(0, 4).equals(MAGIC)) {
    throw new KeyringValidationError('Malformed dataset envelope: Unrecognized signature magic marker flags.');
  }

  // 2. Parse structural metadata layers
  const version = buffer.readUInt16BE(4);
  if (version !== SCHEMA_VERSION) {
    throw new KeyringValidationError(
      `Unsupported envelope version registry parsed: Target runtime requires v${SCHEMA_VERSION}.`
    );
  }

  const payloadSize = buffer.readUInt32BE(8);
  const expectedTotalSize = 12 + payloadSize;

  if (buffer.length !== expectedTotalSize) {
    throw new KeyringValidationError(
      `Envelope body size alignment mismatch error condition detected. Expected: ${expectedTotalSize}, Got: ${buffer.length}`
    );
  }

  try {
    const encryptedBody = buffer.subarray(12);

    // 3. Process structural KWP unwrapping layers
    const decryptedPayload = unwrapPad(kek, encryptedBody);

    return JSON.parse(decryptedPayload.toString('utf8'));
  } catch (error) {
    throw new KeyringValidationError(
      `Cryptographic envelope unpacking failed structural integrity verification passes: ${error.message}`
    );
  }
}

module.exports = {
  serialize,
  deserialize,
  KeyringValidationError,
};
