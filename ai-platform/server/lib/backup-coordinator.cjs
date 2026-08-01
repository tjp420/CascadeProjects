'use strict';

/**
 * Milestone 6: Production backup and restore coordinator.
 *
 * Provides encrypted, versioned, authenticated backups of cluster keyring
 * material, audit logs, and resumption context. All archives are protected
 * by AES-256-GCM envelope encryption with a per-archive key derived from a
 * 32-byte KEK via HKDF-SHA256.
 *
 * @module backup-coordinator
 */

const crypto = require('crypto');

const BACKUP_VERSION = 0x01;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const KEK_LENGTH = 32;
const ARCHIVE_KEY_INFO = 'backup:archive:v1';
const HEADER_LENGTH = 1 + NONCE_LENGTH + 4;
const DEFAULT_RETENTION_DAYS = 30;

class BackupCoordinator {
  /**
   * @param {object} opts
   * @param {Buffer} opts.kek - 32-byte Key-Encrypting Key
   * @param {number} [opts.retentionDays=30] - retention window in days
   * @param {boolean} [opts.immutable=false] - if true, prune() is a no-op
   * @param {object} [opts.storage] - pluggable storage adapter (defaults to in-memory)
   */
  constructor(opts) {
    if (!opts || !Buffer.isBuffer(opts.kek) || opts.kek.length !== KEK_LENGTH) {
      throw new Error('INVALID_KEK: backup-coordinator: KEK must be a 32-byte Buffer');
    }
    this.kek = opts.kek;
    this.retentionDays = opts.retentionDays || DEFAULT_RETENTION_DAYS;
    this.immutable = !!opts.immutable;
    this.storage = opts.storage || createMemoryStorage();
    this.events = [];
  }

  /**
   * Derive a per-archive data-encryption key from the KEK and archiveId.
   * archiveKey = HKDF-SHA256(kek, salt="backup:archive:v1", info=archiveId, L=32)
   *
   * @param {Buffer} kek
   * @param {string} archiveId
   * @returns {Buffer}
   */
  static deriveArchiveKey(kek, archiveId) {
    if (!Buffer.isBuffer(kek) || kek.length !== KEK_LENGTH) {
      throw new Error('INVALID_KEK: backup-coordinator: KEK must be a 32-byte Buffer');
    }
    return Buffer.from(crypto.hkdfSync('sha256', kek, ARCHIVE_KEY_INFO, Buffer.from(archiveId, 'utf8'), 32));
  }

  _validateBundle(bundle) {
    if (!bundle || typeof bundle !== 'object') {
      return 'INVALID_BUNDLE';
    }
    if (!Buffer.isBuffer(bundle.keyringMaterial)) {
      return 'INVALID_BUNDLE';
    }
    if (typeof bundle.issuedAt !== 'number') {
      return 'INVALID_BUNDLE';
    }
    if (!bundle.auditLog) {
      return 'INVALID_BUNDLE';
    }
    return null;
  }

  _makeArchiveId(timestamp) {
    return `bkp-${timestamp}-${crypto.randomBytes(4).toString('hex')}`;
  }

  _serializeBundle(bundle) {
    // S-04: resumption context excludes live PSK and Bloom filter state.
    const resumptionTickets = (bundle.resumptionTickets || []).map((t) => ({
      sessionId: t.sessionId,
      nodeId: t.nodeId,
      issuedAt: t.issuedAt,
      prevRootHash: t.prevRootHash || null,
    }));

    return Buffer.from(JSON.stringify({
      keyringMaterial: bundle.keyringMaterial.toString('base64'),
      auditLog: Buffer.isBuffer(bundle.auditLog)
        ? bundle.auditLog.toString('base64')
        : Buffer.from(JSON.stringify(bundle.auditLog), 'utf8').toString('base64'),
      resumptionTickets,
      issuedAt: bundle.issuedAt,
    }), 'utf8');
  }

  /**
   * Create and store an encrypted backup archive.
   *
   * @param {object} bundle - { keyringMaterial, auditLog, resumptionTickets, issuedAt }
   * @returns {Promise<{ archiveId: string, checksum: string, tag: string, timestamp: number }>}
   */
  async backup(bundle) {
    const invalid = this._validateBundle(bundle);
    if (invalid) {
      const err = new Error('INVALID_BUNDLE: backup-coordinator: state bundle is invalid');
      err.code = invalid;
      throw err;
    }

    const timestamp = bundle.issuedAt;
    const archiveId = this._makeArchiveId(timestamp);
    const archiveKey = BackupCoordinator.deriveArchiveKey(this.kek, archiveId);

    const bundleJson = this._serializeBundle(bundle);
    const checksum = crypto.createHash('sha256').update(bundleJson).digest('hex');

    const metadata = {
      archiveId,
      timestamp,
      schemaVersion: 1,
      checksum,
      size: bundleJson.length,
    };

    const plaintext = Buffer.from(JSON.stringify({
      metadata,
      bundle: bundleJson.toString('base64'),
    }), 'utf8');

    const nonce = crypto.randomBytes(NONCE_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', archiveKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const header = Buffer.alloc(HEADER_LENGTH);
    header[0] = BACKUP_VERSION;
    nonce.copy(header, 1);
    header.writeUInt32BE(ciphertext.length, 1 + NONCE_LENGTH);

    const archiveBuffer = Buffer.concat([header, ciphertext, tag]);
    await this.storage.write(archiveId, archiveBuffer);

    return { archiveId, checksum, tag: tag.toString('hex'), timestamp };
  }

  /**
   * Verify an archive buffer without restoring it.
   *
   * @param {Buffer} archiveBuffer
   * @param {string} archiveId
   * @returns {{ valid: boolean, reason?: string, metadata?: object, bundle?: object }}
   */
  verifyArchive(archiveBuffer, archiveId) {
    if (!Buffer.isBuffer(archiveBuffer) || archiveBuffer.length < HEADER_LENGTH + TAG_LENGTH) {
      return { valid: false, reason: 'MALFORMED' };
    }

    if (archiveBuffer[0] !== BACKUP_VERSION) {
      return { valid: false, reason: 'VERSION' };
    }

    const nonce = archiveBuffer.slice(1, 1 + NONCE_LENGTH);
    const ciphertextLen = archiveBuffer.readUInt32BE(1 + NONCE_LENGTH);

    if (archiveBuffer.length !== HEADER_LENGTH + ciphertextLen + TAG_LENGTH) {
      return { valid: false, reason: 'MALFORMED' };
    }

    const archiveKey = BackupCoordinator.deriveArchiveKey(this.kek, archiveId);
    const ciphertext = archiveBuffer.slice(HEADER_LENGTH, HEADER_LENGTH + ciphertextLen);
    const tag = archiveBuffer.slice(HEADER_LENGTH + ciphertextLen);

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', archiveKey, nonce);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const { metadata, bundle: bundleB64 } = JSON.parse(plaintext.toString('utf8'));

      if (metadata.archiveId !== archiveId) {
        return { valid: false, reason: 'ARCHIVE_ID_MISMATCH' };
      }

      const bundleJson = Buffer.from(bundleB64, 'base64');
      const checksum = crypto.createHash('sha256').update(bundleJson).digest('hex');
      if (checksum !== metadata.checksum) {
        return { valid: false, reason: 'CHECKSUM' };
      }

      return { valid: true, metadata, bundle: JSON.parse(bundleJson.toString('utf8')) };
    } catch (err) {
      return { valid: false, reason: err.message || 'DECRYPT' };
    }
  }

  /**
   * Restore a backup archive.
   *
   * @param {string} archiveId
   * @param {object} [opts]
   * @param {boolean} [opts.dryRun=false]
   * @param {number} [opts.asOf]
   * @returns {Promise<{ bundle: object, metadata: object, dryRun?: boolean }>}
   */
  async restore(archiveId, { dryRun = false, asOf } = {}) {
    let targetId = archiveId;

    if (asOf !== undefined) {
      const archives = await this.storage.list();
      const candidate = archives
        .filter((a) => a.timestamp <= asOf)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      if (!candidate) {
        const err = new Error('BACKUP_NOT_FOUND: backup-coordinator: no archive at or before asOf');
        err.code = 'BACKUP_NOT_FOUND';
        throw err;
      }
      targetId = candidate.archiveId;
    }

    const archiveBuffer = await this.storage.read(targetId);
    if (!archiveBuffer) {
      const err = new Error('BACKUP_NOT_FOUND: backup-coordinator: archive not found');
      err.code = 'BACKUP_NOT_FOUND';
      throw err;
    }

    const verified = this.verifyArchive(archiveBuffer, targetId);
    if (!verified.valid) {
      const err = new Error(`RESTORE_FAILED: backup-coordinator: ${verified.reason}`);
      err.code = 'RESTORE_FAILED';
      throw err;
    }

    const bundle = {
      keyringMaterial: Buffer.from(verified.bundle.keyringMaterial, 'base64'),
      auditLog: Buffer.isBuffer(Buffer.from(verified.bundle.auditLog, 'base64'))
        ? JSON.parse(Buffer.from(verified.bundle.auditLog, 'base64').toString('utf8'))
        : [],
      resumptionTickets: verified.bundle.resumptionTickets || [],
      issuedAt: verified.bundle.issuedAt,
    };

    const result = { bundle, metadata: verified.metadata };
    if (dryRun) result.dryRun = true;
    return result;
  }

  /**
   * List stored archive metadata.
   * @returns {Promise<Array<{ archiveId: string, timestamp: number, size: number, checksum: string }>>}
   */
  async listArchives() {
    return this.storage.list();
  }

  /**
   * Prune archives older than the given timestamp, unless immutable.
   *
   * @param {number} beforeTimestamp
   * @returns {Promise<string[]>}
   */
  async prune(beforeTimestamp) {
    if (this.immutable) {
      this.events.push({ type: 'BACKUP_IMMUTABLE', at: Date.now() });
      return [];
    }

    const archives = await this.storage.list();
    const removed = [];

    for (const archive of archives) {
      if (archive.timestamp < beforeTimestamp) {
        await this.storage.delete(archive.archiveId);
        removed.push(archive.archiveId);
        this.events.push({ type: 'BACKUP_PRUNED', archiveId: archive.archiveId, at: Date.now() });
      }
    }

    return removed;
  }
}

/**
 * In-memory storage adapter for tests and single-node deployments.
 * @returns {{ write: (string, Buffer) => Promise<void>, read: (string) => Promise<Buffer|null>, delete: (string) => Promise<void>, list: () => Promise<Array> }}
 */
function createMemoryStorage() {
  const store = new Map();
  return {
    write: async (archiveId, buffer) => {
      const [, timestamp] = archiveId.split('-');
      store.set(archiveId, { buffer, timestamp: parseInt(timestamp, 10) });
    },
    read: async (archiveId) => {
      const entry = store.get(archiveId);
      return entry ? entry.buffer : null;
    },
    delete: async (archiveId) => { store.delete(archiveId); },
    list: async () => Array.from(store.entries()).map(([archiveId, entry]) => ({
      archiveId,
      timestamp: entry.timestamp,
      size: entry.buffer.length,
      checksum: '',
    })).sort((a, b) => a.timestamp - b.timestamp),
  };
}

module.exports = {
  BackupCoordinator,
  createMemoryStorage,
  BACKUP_VERSION,
};
