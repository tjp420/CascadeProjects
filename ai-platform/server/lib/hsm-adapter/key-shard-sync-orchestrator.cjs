'use strict';

/**
 * Track 32: Key shard sync orchestrator.
 *
 * BFT-style coordinator that gathers signed sync proposals from cluster
 * nodes and commits updates only once a quorum of valid responses agree.
 *
 * @module hsm-adapter/key-shard-sync-orchestrator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

function _canonicalPacketString(packet, nodeId) {
  return `${packet.packetId}|${packet.shardId}|${packet.sequence}|${packet.payloadHash}|${packet.timestamp}|${packet.originNode}|${nodeId}`;
}

class KeyShardSyncOrchestrator {
  /**
   * @param {object} options
   * @param {string[]} options.clusterNodes
   * @param {number} options.minClusterQuorum
   * @param {number} options.maxAllowedDriftMs
   * @param {number} options.maxInFlightProposals
   * @param {string[]} options.allowedConsensusModes
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.clusterNodes = new Set(options.clusterNodes || []);
    this.minClusterQuorum = options.minClusterQuorum || 3;
    this.maxAllowedDriftMs = options.maxAllowedDriftMs || 300000;
    this.maxInFlightProposals = options.maxInFlightProposals || 100;
    this.allowedConsensusModes = new Set(options.allowedConsensusModes || ['pbft', 'hotstuff']);
    this._proposals = new Map();
    this._audit = options.audit || null;
  }

  /**
   * Initiate a sync proposal.
   * @param {object} packet
   * @param {string} packet.packetId
   * @param {string} packet.shardId
   * @param {number} packet.sequence
   * @param {string} packet.payloadHash
   * @param {number} packet.timestamp
   * @param {string} packet.originNode
   * @param {string} packet.consensusMode
   * @returns {object}
   */
  initiate(packet) {
    if (!packet || typeof packet !== 'object') {
      throw new HsmAdapterError('INVALID_INPUT', 'packet object is required');
    }
    const { packetId, shardId, sequence, payloadHash, timestamp, originNode, consensusMode } = packet;
    if (!packetId || !shardId || typeof sequence !== 'number' || !payloadHash || typeof timestamp !== 'number' || !originNode || !consensusMode) {
      throw new HsmAdapterError('INVALID_INPUT', 'packetId, shardId, sequence, payloadHash, timestamp, originNode, and consensusMode are required');
    }
    if (!this.allowedConsensusModes.has(consensusMode)) {
      throw new HsmAdapterError('SYNC_MODE_REJECTED', `consensus mode ${consensusMode} is not allowed`);
    }
    if (Date.now() - timestamp > this.maxAllowedDriftMs) {
      throw new HsmAdapterError('SYNC_PACKET_EXPIRED', 'packet timestamp is too old');
    }
    if (!this.clusterNodes.has(originNode)) {
      throw new HsmAdapterError('SYNC_ORIGIN_REJECTED', `origin node ${originNode} is not in the cluster`);
    }
    if (this._proposals.size >= this.maxInFlightProposals) {
      throw new HsmAdapterError('SYNC_TOO_MANY_IN_FLIGHT', `max in-flight proposals ${this.maxInFlightProposals} reached`);
    }

    const entry = {
      packetId,
      shardId,
      sequence,
      payloadHash,
      timestamp,
      originNode,
      consensusMode,
      responses: [],
      committed: false,
    };
    this._proposals.set(packetId, entry);

    this._emitAudit('SHARD_SYNC_INITIATED', {
      packetId,
      shardId,
      sequence,
      originNode,
      consensusMode,
    });

    return entry;
  }

  /**
   * Add a node response to a proposal.
   * @param {string} packetId
   * @param {string} nodeId
   * @param {string} signature
   * @returns {object}
   */
  respond(packetId, nodeId, signature) {
    const proposal = this._proposals.get(packetId);
    if (!proposal) {
      throw new HsmAdapterError('SYNC_PROPOSAL_NOT_FOUND', `no proposal ${packetId}`);
    }
    if (proposal.committed) {
      throw new HsmAdapterError('SYNC_ALREADY_COMMITTED', `proposal ${packetId} already committed`);
    }
    if (!this.clusterNodes.has(nodeId)) {
      throw new HsmAdapterError('SYNC_NODE_REJECTED', `node ${nodeId} is not in the cluster`);
    }
    if (proposal.responses.some((r) => r.nodeId === nodeId)) {
      throw new HsmAdapterError('SYNC_DUPLICATE_RESPONSE', `node ${nodeId} already responded`);
    }
    if (Date.now() - proposal.timestamp > this.maxAllowedDriftMs) {
      throw new HsmAdapterError('SYNC_PROPOSAL_EXPIRED', `proposal ${packetId} expired`);
    }

    const expected = _hash(_canonicalPacketString(proposal, nodeId));
    if (signature !== expected) {
      throw new HsmAdapterError('SYNC_SIGNATURE_INVALID', `signature from ${nodeId} does not verify`);
    }

    proposal.responses.push({ nodeId, signature });
    return proposal;
  }

  /**
   * Commit a proposal once quorum is reached.
   * @param {string} packetId
   * @returns {object}
   */
  commit(packetId) {
    const proposal = this._proposals.get(packetId);
    if (!proposal) {
      throw new HsmAdapterError('SYNC_PROPOSAL_NOT_FOUND', `no proposal ${packetId}`);
    }
    if (proposal.committed) {
      throw new HsmAdapterError('SYNC_ALREADY_COMMITTED', `proposal ${packetId} already committed`);
    }
    if (Date.now() - proposal.timestamp > this.maxAllowedDriftMs) {
      throw new HsmAdapterError('SYNC_PROPOSAL_EXPIRED', `proposal ${packetId} expired before commit`);
    }
    if (proposal.responses.length < this.minClusterQuorum) {
      throw new HsmAdapterError('SYNC_QUORUM_NOT_MET', `responses ${proposal.responses.length} below quorum ${this.minClusterQuorum}`);
    }

    proposal.committed = true;

    this._emitAudit('NODE_CONSENSUS_COMMITTED', {
      packetId,
      shardId: proposal.shardId,
      sequence: proposal.sequence,
      nodes: proposal.responses.map((r) => r.nodeId),
      responseCount: proposal.responses.length,
    });

    return proposal;
  }

  /**
   * Get the state of a proposal.
   * @param {string} packetId
   * @returns {object}
   */
  getProposal(packetId) {
    const proposal = this._proposals.get(packetId);
    if (!proposal) {
      throw new HsmAdapterError('SYNC_PROPOSAL_NOT_FOUND', `no proposal ${packetId}`);
    }
    return proposal;
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

function _hash(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = { KeyShardSyncOrchestrator, _canonicalPacketString };
