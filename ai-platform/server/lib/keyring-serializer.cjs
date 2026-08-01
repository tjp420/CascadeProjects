'use strict';

class KeyringValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KeyringValidationError';
  }
}

const MAX_ENVELOPE_SIZE = 65536;
const MIN_HEADER_SIZE = 24; // header(16) + wrappedCEKLen(8)
const IV_SIZE = 12;
const TAG_SIZE = 16;
const MIN_WRAPPED_CEK = 24; // RFC-3394 minimal wrapped size

function _readHeader(buffer) {
  // Header layout (16 bytes): magic(4) | schemaVersion(1) | algorithm(1) | flags(1) | reserved(1) | timestamp(8)
  if (buffer.length < 16) throw new KeyringValidationError('Buffer too small for header');
  const magic = buffer.readUInt32BE(0);
  const schemaVersion = buffer.readUInt8(4);
  const algorithm = buffer.readUInt8(5);
  const flags = buffer.readUInt8(6);
  const reserved = buffer.readUInt8(7);
  const timestamp = buffer.readBigUInt64BE(8);
  return { magic, schemaVersion, algorithm, flags, reserved, timestamp };
}

function validateKeyringStructure(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new KeyringValidationError('Input must be a raw binary Buffer');
  }

  const totalLen = buffer.length;
  if (totalLen > MAX_ENVELOPE_SIZE) {
    throw new KeyringValidationError(`Envelope exceeds maximum allowed size of ${MAX_ENVELOPE_SIZE} bytes`);
  }

  if (totalLen < MIN_HEADER_SIZE + MIN_WRAPPED_CEK + IV_SIZE + TAG_SIZE) {
    throw new KeyringValidationError('Envelope too small to contain required sections');
  }

  const header = _readHeader(buffer);
  // Validate magic 'SBKR' = 0x53 0x42 0x4B 0x52
  if (header.magic !== 0x53424B52) {
    throw new KeyringValidationError('Invalid magic value');
  }
  if (header.schemaVersion !== 0x01) {
    throw new KeyringValidationError(`Unsupported schema version: ${header.schemaVersion}`);
  }
  if (header.algorithm !== 0x01) {
    throw new KeyringValidationError(`Unsupported algorithm identifier: ${header.algorithm}`);
  }

  // wrappedCEK length is 8 bytes at offset 16
  if (totalLen < 24) throw new KeyringValidationError('Missing wrapped CEK length field');
  const wrappedCEKLenBig = buffer.readBigUInt64BE(16);
  if (wrappedCEKLenBig > BigInt(MAX_ENVELOPE_SIZE)) {
    throw new KeyringValidationError('Parsed wrapped CEK size overflows memory constraints');
  }
  const wrappedCEKLen = Number(wrappedCEKLenBig);

  if (wrappedCEKLen < MIN_WRAPPED_CEK) {
    throw new KeyringValidationError(`Wrapped CEK length too small: ${wrappedCEKLen}`);
  }

  // For this track we expect 40 bytes (256-bit CEK wrapped via AES-KW)
  if (wrappedCEKLen !== 40) {
    throw new KeyringValidationError(`Unexpected wrapped CEK length: ${wrappedCEKLen}. Expected 40 bytes.`);
  }

  const wrappedCEKOffset = 24;
  const ivOffset = wrappedCEKOffset + wrappedCEKLen;
  const tagOffset = ivOffset + IV_SIZE;
  const ciphertextOffset = tagOffset + TAG_SIZE;

  if (ciphertextOffset > totalLen) {
    throw new KeyringValidationError('Envelope payload boundary mismatch during offset construction');
  }

  const headerSlice = buffer.subarray(0, 16);
  const wrappedCEKLenSlice = buffer.subarray(16, 24);
  const wrappedCEKSlice = buffer.subarray(wrappedCEKOffset, ivOffset);
  const ivSlice = buffer.subarray(ivOffset, tagOffset);
  const tagSlice = buffer.subarray(tagOffset, ciphertextOffset);
  const ciphertextSlice = buffer.subarray(ciphertextOffset);

  if (ciphertextSlice.length === 0) {
    throw new KeyringValidationError('Invalid empty payload: Ciphertext segment is missing');
  }

  const aadBuffer = Buffer.concat([headerSlice, wrappedCEKLenSlice, wrappedCEKSlice]);

  return {
    slices: {
      header: headerSlice,
      wrappedCEKLen: wrappedCEKLenSlice,
      wrappedCEK: wrappedCEKSlice,
      iv: ivSlice,
      tag: tagSlice,
      ciphertext: ciphertextSlice,
      aad: aadBuffer,
    },
    metadata: {
      schemaVersion: header.schemaVersion,
      flags: header.flags,
      reserved: header.reserved,
      timestamp: header.timestamp,
    }
  };
}

/**
 * Track 10: Canonical keyring serializer.
 *
 * Serializes session keyring material into a deterministic, versioned binary
 * envelope suitable for AES Key Wrap (AES-KW / AES-KWP) by an HSM adapter.
 *
 * The format is JSON with base64-encoded Buffer fields, matching the existing
 * backup-coordinator and key-rotation-store serialization conventions.
 *
 * Envelope layout:
 *   {
 *     "version": 1,
 *     "keyringId": "<uuid>",
 *     "createdAt": "<ISO 8601>",
 *     "algorithm": "<e.g. X25519+ML-KEM-768>",
 *     "keyCount": <int>,
 *     "keys": [
 *       { "id": "<key-id>", "alg": "<alg>", "data": "<base64>" }
 *     ]
 *   }
 *
 * @module keyring-serializer
 */

const crypto = require('crypto');

const SERIALIZER_VERSION = 1;
const MAX_SERIALIZED_BYTES = 1 << 20; // 1 MB — matches cluster-keyring-sync MAX_FRAME_BYTES

/**
 * Error class for serializer failures.
 */
class SerializerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SerializerError';
    this.code = code;
  }
}

/**
 * Validate a key entry object.
 * @param {object} key - { id, alg, data }
 * @param {number} index - position in keys array (for error messages)
 * @throws {SerializerError} if invalid
 */
function _validateKeyEntry(key, index) {
  if (!key || typeof key !== 'object') {
    throw new SerializerError('INVALID_KEY_ENTRY', `keys[${index}] must be an object`);
  }
  if (!key.id || typeof key.id !== 'string') {
    throw new SerializerError('INVALID_KEY_ID', `keys[${index}].id must be a non-empty string`);
  }
  if (!key.alg || typeof key.alg !== 'string') {
    throw new SerializerError('INVALID_KEY_ALG', `keys[${index}].alg must be a non-empty string`);
  }
  if (!Buffer.isBuffer(key.data)) {
    throw new SerializerError('INVALID_KEY_DATA', `keys[${index}].data must be a Buffer`);
  }
  if (key.data.length === 0) {
    throw new SerializerError('EMPTY_KEY_DATA', `keys[${index}].data must not be empty`);
  }
}

/**
 * Validate a keyring object before serialization.
 * @param {object} keyring - { algorithm, keys, keyringId?, createdAt? }
 * @throws {SerializerError} if invalid
 */
function _validateKeyring(keyring) {
  if (!keyring || typeof keyring !== 'object') {
    throw new SerializerError('INVALID_KEYRING', 'keyring must be an object');
  }
  if (!keyring.algorithm || typeof keyring.algorithm !== 'string') {
    throw new SerializerError('INVALID_ALGORITHM', 'keyring.algorithm must be a non-empty string');
  }
  if (!Array.isArray(keyring.keys) || keyring.keys.length === 0) {
    throw new SerializerError('NO_KEYS', 'keyring.keys must be a non-empty array');
  }
  for (let i = 0; i < keyring.keys.length; i++) {
    _validateKeyEntry(keyring.keys[i], i);
  }
}

/**
 * Serialize a keyring object into a canonical binary envelope.
 *
 * @param {object} keyring - { algorithm, keys: [{id, alg, data: Buffer}], keyringId?, createdAt? }
 * @returns {Buffer} serialized envelope (UTF-8 JSON)
 * @throws {SerializerError} on validation failure or size limit exceeded
 */
function serializeKeyring(keyring) {
  _validateKeyring(keyring);

  const envelope = {
    version: SERIALIZER_VERSION,
    keyringId: keyring.keyringId || crypto.randomUUID(),
    createdAt: keyring.createdAt || new Date().toISOString(),
    algorithm: keyring.algorithm,
    keyCount: keyring.keys.length,
    keys: keyring.keys.map((k) => ({
      id: k.id,
      alg: k.alg,
      data: k.data.toString('base64'),
    })),
  };

  const serialized = Buffer.from(JSON.stringify(envelope), 'utf8');

  if (serialized.length > MAX_SERIALIZED_BYTES) {
    throw new SerializerError(
      'SIZE_LIMIT_EXCEEDED',
      `Serialized keyring is ${serialized.length} bytes; maximum is ${MAX_SERIALIZED_BYTES}`
    );
  }

  return serialized;
}

/**
 * Deserialize a binary envelope back into a keyring object with Buffer keys.
 *
 * @param {Buffer} serialized - output from serializeKeyring
 * @returns {{ version, keyringId, createdAt, algorithm, keyCount, keys: Array<{id, alg, data: Buffer}> }}
 * @throws {SerializerError} on malformed input, version mismatch, or size limit exceeded
 */
function deserializeKeyring(serialized) {
  if (!Buffer.isBuffer(serialized)) {
    throw new SerializerError('INVALID_INPUT', 'deserializeKeyring requires a Buffer');
  }
  if (serialized.length === 0) {
    throw new SerializerError('EMPTY_INPUT', 'Input buffer is empty');
  }
  if (serialized.length > MAX_SERIALIZED_BYTES) {
    throw new SerializerError(
      'SIZE_LIMIT_EXCEEDED',
      `Input buffer is ${serialized.length} bytes; maximum is ${MAX_SERIALIZED_BYTES}`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(serialized.toString('utf8'));
  } catch (err) {
    throw new SerializerError('MALFORMED_JSON', `Failed to parse JSON: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new SerializerError('INVALID_ENVELOPE', 'Parsed JSON is not an object');
  }
  if (parsed.version !== SERIALIZER_VERSION) {
    throw new SerializerError(
      'VERSION_MISMATCH',
      `Expected version ${SERIALIZER_VERSION}, got ${parsed.version}`
    );
  }
  if (!parsed.keyringId || typeof parsed.keyringId !== 'string') {
    throw new SerializerError('INVALID_KEYRING_ID', 'keyringId must be a non-empty string');
  }
  if (!parsed.createdAt || typeof parsed.createdAt !== 'string') {
    throw new SerializerError('INVALID_CREATED_AT', 'createdAt must be a string');
  }
  if (!parsed.algorithm || typeof parsed.algorithm !== 'string') {
    throw new SerializerError('INVALID_ALGORITHM', 'algorithm must be a non-empty string');
  }
  if (!Array.isArray(parsed.keys) || parsed.keys.length === 0) {
    throw new SerializerError('NO_KEYS', 'keys must be a non-empty array');
  }

  const keys = parsed.keys.map((k, i) => {
    if (!k || typeof k !== 'object') {
      throw new SerializerError('INVALID_KEY_ENTRY', `keys[${i}] must be an object`);
    }
    if (!k.id || typeof k.id !== 'string') {
      throw new SerializerError('INVALID_KEY_ID', `keys[${i}].id must be a non-empty string`);
    }
    if (!k.alg || typeof k.alg !== 'string') {
      throw new SerializerError('INVALID_KEY_ALG', `keys[${i}].alg must be a non-empty string`);
    }
    if (!k.data || typeof k.data !== 'string') {
      throw new SerializerError('INVALID_KEY_DATA', `keys[${i}].data must be a base64 string`);
    }
    let data;
    try {
      data = Buffer.from(k.data, 'base64');
    } catch (err) {
      throw new SerializerError('INVALID_KEY_DATA', `keys[${i}].data is not valid base64: ${err.message}`);
    }
    if (data.length === 0) {
      throw new SerializerError('EMPTY_KEY_DATA', `keys[${i}].data must not be empty`);
    }
    // Verify round-trip: base64-encode the decoded buffer and compare to input.
    // This catches silently-corrupt base64 (e.g., '!!!not-base64!!!' decodes to empty).
    if (data.toString('base64') !== k.data) {
      throw new SerializerError('INVALID_KEY_DATA', `keys[${i}].data is not valid base64 (round-trip mismatch)`);
    }
    return { id: k.id, alg: k.alg, data };
  });

  return {
    version: parsed.version,
    keyringId: parsed.keyringId,
    createdAt: parsed.createdAt,
    algorithm: parsed.algorithm,
    keyCount: keys.length,
    keys,
  };
}

/**
 * Compute a SHA-256 checksum of the serialized envelope.
 * Used by the HSM adapter to verify wrap/unwrap integrity.
 *
 * @param {Buffer} serialized
 * @returns {string} hex checksum
 */
function checksumSerialized(serialized) {
  if (!Buffer.isBuffer(serialized)) {
    throw new SerializerError('INVALID_INPUT', 'checksumSerialized requires a Buffer');
  }
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

module.exports = {
  // Validation API
  validateKeyringStructure,
  KeyringValidationError,

  // Serializer API
  serializeKeyring,
  deserializeKeyring,
  checksumSerialized,
  SerializerError,
  SERIALIZER_VERSION,
  MAX_SERIALIZED_BYTES,
};
