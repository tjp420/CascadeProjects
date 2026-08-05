"use strict";

/**
 * Track 396: Incremental Merkle Reassembler for multipart upload durability.
 *
 * Builds a Merkle tree incrementally as chunks arrive, persisting tree state
 * to disk after each append so that a crashed session can resume without
 * re-reading all chunks.
 *
 * Tree structure:
 * - Leaves are SHA-256 hashes of chunk data, ordered by offset.
 * - Internal nodes are SHA-256(left || right).
 * - If the leaf count is not a power of two, the last leaf is promoted
 *   (no padding) — this matches the binary Merkle tree construction
 *   used in PoRep verification.
 *
 * Checkpoint format (tree-state.json):
 * {
 *   leafCount: number,
 *   leaves: string[],      // hex hashes, one per chunk
 *   pendingNodes: string[], // internal nodes from the previous level
 *   root: string | null     // finalized root, null until finalize()
 * }
 *
 * @module track112/merkle-reassembler
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { writeAtomicSync } = require('../../storage/reassembler.cjs');

const DEFAULT_LEAF_SIZE = 4096;
const STATE_FILENAME = 'tree-state.json';

function sha256Buf(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

function sha256Hex(buf) {
  return sha256Buf(buf).toString('hex');
}

/**
 * Combine two child hashes into a parent hash.
 * @param {string} leftHex
 * @param {string} rightHex
 * @returns {string} hex digest
 */
function combineHashes(leftHex, rightHex) {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  return sha256Hex(Buffer.concat([left, right]));
}

class MerkleReassembler {
  /**
   * @param {object} opts
   * @param {number} [opts.leafSize=4096] — expected chunk size for alignment checks
   * @param {string} [opts.stateDir] — directory to persist tree-state.json; if omitted, no persistence
   * @param {object} [opts.metrics] — hsm-metrics instance for telemetry
   */
  constructor({ leafSize = DEFAULT_LEAF_SIZE, stateDir, metrics } = {}) {
    this.leafSize = leafSize;
    this.stateDir = stateDir || null;
    this.metrics = metrics || null;
    this._leaves = [];
    this._pendingNodes = [];
    this._root = null;
    this._finalized = false;

    if (this.stateDir) {
      fs.mkdirSync(this.stateDir, { recursive: true });
      this._loadState();
    }
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Append a chunk and update the incremental Merkle tree.
   * @param {number} offset — byte offset of the chunk (must be leaf-aligned)
   * @param {Buffer} buf — chunk data
   */
  append(offset, buf) {
    if (this._finalized) throw new Error('tree_already_finalized');
    if (offset % this.leafSize !== 0) throw new Error('offset_not_aligned');
    if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);

    const leafHash = sha256Hex(buf);
    this._leaves.push(leafHash);
    this._root = null;

    if (this.metrics) {
      this.metrics.incrementCounter('hsm_track112_merkle_leaf_hashed_total');
    }

    this._saveState();
  }

  /**
   * Finalize the Merkle root from the accumulated leaves.
   * After finalize(), no more chunks can be appended.
   * @returns {string} hex Merkle root
   */
  finalize() {
    if (this._finalized) return this._root;
    if (this._leaves.length === 0) {
      this._root = sha256Hex(Buffer.alloc(0));
    } else {
      this._root = this._computeRoot(this._leaves);
    }
    this._finalized = true;
    this._saveState();
    return this._root;
  }

  /**
   * Get the current Merkle root without finalizing.
   * Returns null if no leaves have been appended.
   * @returns {string|null}
   */
  getRoot() {
    if (this._root) return this._root;
    if (this._leaves.length === 0) return null;
    return this._computeRoot(this._leaves);
  }

  /**
   * Get the number of leaves (chunks) appended so far.
   * @returns {number}
   */
  get leafCount() {
    return this._leaves.length;
  }

  /**
   * Whether finalize() has been called.
   * @returns {boolean}
   */
  get isFinalized() {
    return this._finalized;
  }

  /**
   * Serialize current state for checkpoint persistence.
   * @returns {object}
   */
  getState() {
    return {
      leafCount: this._leaves.length,
      leaves: this._leaves,
      pendingNodes: this._pendingNodes,
      root: this._root,
      finalized: this._finalized,
    };
  }

  /**
   * Restore state from a checkpoint object.
   * @param {object} state
   */
  loadState(state) {
    this._leaves = state.leaves || [];
    this._pendingNodes = state.pendingNodes || [];
    this._root = state.root || null;
    this._finalized = state.finalized || false;

    if (this.metrics) {
      this.metrics.incrementCounter('hsm_track112_merkle_tree_rebuild_total');
    }
  }

  // ── Internal ───────────────────────────────────────────────────

  /**
   * Compute the Merkle root from a list of leaf hashes.
   * Uses the standard binary tree construction: pair adjacent nodes,
   * hash them together, and repeat until one node remains.
   * If the leaf count is odd, the last node is promoted to the next level.
   *
   * @param {string[]} leaves — array of hex leaf hashes
   * @returns {string} hex Merkle root
   */
  _computeRoot(leaves) {
    if (leaves.length === 1) return leaves[0];

    let level = [...leaves];
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 < level.length) {
          next.push(combineHashes(level[i], level[i + 1]));
        } else {
          // Odd node: promote to next level without pairing
          next.push(level[i]);
        }
      }
      level = next;
    }
    return level[0];
  }

  /**
   * Persist tree state to disk via atomic write.
   * @private
   */
  _saveState() {
    if (!this.stateDir) return;
    const statePath = path.join(this.stateDir, STATE_FILENAME);
    try {
      writeAtomicSync(statePath, Buffer.from(JSON.stringify(this.getState())));
    } catch (e) {
      // Persistence failure is non-fatal — tree state is still in memory
    }
  }

  /**
   * Load tree state from disk if a checkpoint exists.
   * @private
   */
  _loadState() {
    if (!this.stateDir) return;
    const statePath = path.join(this.stateDir, STATE_FILENAME);
    try {
      if (fs.existsSync(statePath)) {
        const raw = fs.readFileSync(statePath, 'utf8');
        const state = JSON.parse(raw);
        this.loadState(state);
      }
    } catch (e) {
      // Corrupt or unreadable state — start fresh
    }
  }
}

module.exports = MerkleReassembler;
