'use strict';

/**
 * Track 47: Enclave root rotator
 *
 * Registers rotation proposals, enforces admin quorum and attestation
 * requirements, and returns a canonical serialized payload for signing
 * and commitment into the consensus ledger.
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

function _canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_canonicalize);
  const keys = Object.keys(obj).sort();
  const out = {};
  for (const k of keys) out[k] = _canonicalize(obj[k]);
  return out;
}

class EnclaveRootRotator {
  constructor(options = {}) {
    this._policyEngine = options.policyEngine || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || (() => {});
  }

  _minAdminQuorum() {
    try {
      const p = this._policyEngine ? this._policyEngine.getPolicy('default') : null;
      return (p && p.governance && typeof p.governance.minAdminQuorum === 'number') ? p.governance.minAdminQuorum : 2;
    } catch (_) { return 2; }
  }

  _proposalExpiryMs() {
    try {
      const p = this._policyEngine ? this._policyEngine.getPolicy('default') : null;
      return (p && p.governance && typeof p.governance.proposalExpiryMs === 'number') ? p.governance.proposalExpiryMs : 86400000;
    } catch (_) { return 86400000; }
  }

  /**
   * Propose a rotation. `proposal` must include { admins: [], signatures: [], payload: {}, timestamp }
   * Returns canonical serialized string suitable for ledger commitment.
   */
  proposeRotation(proposal = {}) {
    if (!proposal || typeof proposal !== 'object') throw new HsmAdapterError('INVALID_PROPOSAL', 'proposal required');
    const admins = Array.isArray(proposal.admins) ? proposal.admins : [];
    const sigs = Array.isArray(proposal.signatures) ? proposal.signatures : [];
    const ts = typeof proposal.timestamp === 'number' ? proposal.timestamp : Date.now();

    const quorum = this._minAdminQuorum();
    if (sigs.length < quorum) throw new HsmAdapterError('QUORUM_NOT_REACHED', `require ${quorum} admin signatures`);

    // Attestation enforcement (Track 41): ensure each admin has passed remote attestation
    if (this._attestationClient && this._attestationClient.isVerified) {
      for (const a of admins) {
        if (!this._attestationClient.isVerified(a)) {
          this._audit('ENCLAVE_ROOT_ROTATION_BLOCKED_UNATTESTED_ADMIN', { admin: a });
          throw new HsmAdapterError('ADMIN_NOT_ATTESTED', `admin ${a} not attested`);
        }
      }
    }

    // expiry check
    const expiry = this._proposalExpiryMs();
    if (Date.now() - ts > expiry) {
      this._audit('ENCLAVE_ROOT_ROTATION_BLOCKED_EXPIRED', { ageMs: Date.now() - ts });
      throw new HsmAdapterError('PROPOSAL_EXPIRED', 'proposal has expired');
    }

    const canonical = _canonicalize(proposal.payload || {});
    const serialized = JSON.stringify(canonical);

    // Emit audit hook for initiations
    try { this._audit('ENCLAVE_ROOT_ROTATION_INITIATED', { admins: admins.slice(0, 10), timestamp: ts }); } catch (e) {}

    return serialized;
  }
}

module.exports = { EnclaveRootRotator };
