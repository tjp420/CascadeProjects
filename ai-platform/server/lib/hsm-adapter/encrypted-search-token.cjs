'use strict';

/**
 * Track 19: Encrypted search token generator.
 *
 * Produces deterministic search hashes tied to a rolling salt so that
 * queries can be matched against stored indices without exposing the
 * underlying plaintext.
 *
 * @module hsm-adapter/encrypted-search-token
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_TOKEN_LENGTH = 32;
const DEFAULT_GRACE_WINDOW_MS = 300000;

function _canonical(input) {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  throw new HsmAdapterError('INVALID_INPUT', 'query must be a string or Buffer');
}

function _secureZeroize(buf) {
  if (Buffer.isBuffer(buf)) buf.fill(0);
}

class EncryptedSearchToken {
  /**
   * @param {object} [options]
   * @param {number} [options.tokenExpiryMs=300000]
   * @param {number} [options.graceWindowMs=300000]
   * @param {number} [options.tokenLength=32]
   * @param {Buffer} [options.initialSalt]
   * @param {object} [options.logger]
   */
  constructor(options = {}) {
    this._tokenExpiryMs = options.tokenExpiryMs || 300000;
    this._graceWindowMs = typeof options.graceWindowMs === 'number' ? options.graceWindowMs : DEFAULT_GRACE_WINDOW_MS;
    this._tokenLength = options.tokenLength || DEFAULT_TOKEN_LENGTH;
    this._logger = options.logger || null;

    this._salt = this._newSalt(options.initialSalt);
    this._saltCreatedAt = Date.now();
    this._previousSalt = null;
    this._previousSaltExpiredAt = null;
    this._counter = 0;
  }

  _audit(event, extra = {}) {
    if (!this._logger || !this._logger.info) return;
    this._logger.info(event, { sub: 'hsm-adapter', provider: 'search-token', ...extra });
  }

  _newSalt(provided) {
    if (Buffer.isBuffer(provided) && provided.length >= 16) {
      return Buffer.from(provided);
    }
    return crypto.randomBytes(32);
  }

  _rotateSalt() {
    if (this._previousSalt) {
      _secureZeroize(this._previousSalt);
    }
    this._previousSalt = this._salt;
    this._previousSaltExpiredAt = Date.now() + this._tokenExpiryMs + this._graceWindowMs;
    this._salt = crypto.randomBytes(32);
    this._saltCreatedAt = Date.now();
    this._counter++;
  }

  _prune() {
    if (this._previousSalt && this._previousSaltExpiredAt && Date.now() > this._previousSaltExpiredAt) {
      _secureZeroize(this._previousSalt);
      this._previousSalt = null;
      this._previousSaltExpiredAt = null;
    }
  }

  /**
   * Rotate the active salt; old tokens remain valid during the grace window.
   */
  rotate() {
    this._prune();
    this._rotateSalt();
    this._audit('TOKEN_ROTATED', { counter: this._counter });
  }

  /**
   * Generate a search token for a query.
   * @param {string|Buffer} query
   * @param {Buffer} [salt]
   * @returns {Buffer}
   */
  generate(query, salt) {
    this._prune();
    const s = salt || this._salt;
    const canonical = _canonical(query);
    const hmac = crypto.createHmac('sha256', s);
    hmac.update(canonical);
    const full = hmac.digest();
    const token = Buffer.from(full.subarray(0, this._tokenLength));
    _secureZeroize(full);
    this._audit('STATE_MATCHED', { tokenPrefix: token.toString('hex').slice(0, 16) });
    return token;
  }

  /**
   * Check whether a stored token matches the query using current or
   * previous salt.
   * @param {Buffer} storedToken
   * @param {string|Buffer} query
   * @returns {boolean}
   */
  verify(storedToken, query) {
    if (!Buffer.isBuffer(storedToken) || storedToken.length !== this._tokenLength) {
      throw new HsmAdapterError('INVALID_INPUT', `storedToken must be a ${this._tokenLength}-byte Buffer`);
    }
    this._prune();
    if (Date.now() - this._saltCreatedAt > this._tokenExpiryMs) {
      throw new HsmAdapterError('TOKEN_EXPIRED', 'active salt has expired');
    }
    const current = this.generate(query, this._salt);
    if (current.equals(storedToken)) return true;

    if (this._previousSalt && Date.now() < this._previousSaltExpiredAt) {
      const previous = this.generate(query, this._previousSalt);
      return previous.equals(storedToken);
    }

    return false;
  }
}

module.exports = {
  EncryptedSearchToken,
  DEFAULT_TOKEN_LENGTH,
  DEFAULT_GRACE_WINDOW_MS,
};
