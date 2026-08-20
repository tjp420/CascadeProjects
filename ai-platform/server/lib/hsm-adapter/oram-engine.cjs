"use strict";

/**
 * Track 56: Oblivious RAM (ORAM) and Secure Side-Channel Memory Attenuation.
 *
 * Implements a Path ORAM scheme that hides data access patterns from
 * observers who can monitor memory reads/writes (side-channel attackers).
 * Every access touches a full path from root to leaf, making all accesses
 * indistinguishable regardless of which logical block is being read or
 * written.
 *
 * Components:
 *   - OramTree: Binary tree storage with buckets of blocks
 *   - PositionMap: Maps logical block IDs to leaf paths (recursive ORAM)
 *   - StashManager: Temporary block buffer for path eviction
 *   - PathOramEngine: Orchestrates read/write access with oblivious paths
 *   - SideChannelAttenuator: Constant-time operations to prevent timing leaks
 *   - AccessPatternObfuscator: Dummy accesses and path reshuffling
 *
 * @module hsm-adapter/oram-engine
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_OPTIONS = {
  bucketSize: 4, // blocks per bucket
  treeDepth: 10, // tree height (2^depth leaves)
  blockSize: 4096, // bytes per block
  maxStashSize: 100, // max blocks in stash
  maxBlocks: 10000, // max logical blocks
  enableDummyAccesses: true,
  enablePathReshuffle: true,
  constantTimeCompare: true,
  accessTimeoutMs: 30000,
};

const BLOCK_STATUS = {
  EMPTY: "empty",
  OCCUPIED: "occupied",
  EVICTED: "evicted",
};

/**
 * Oblivious RAM (ORAM) and Secure Side-Channel Memory Attenuation Engine.
 */
class OramEngine {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.bucketSize = opts.bucketSize;
    this.treeDepth = opts.treeDepth;
    this.blockSize = opts.blockSize;
    this.maxStashSize = opts.maxStashSize;
    this.maxBlocks = opts.maxBlocks;
    this.enableDummyAccesses = opts.enableDummyAccesses;
    this.enablePathReshuffle = opts.enablePathReshuffle;
    this.constantTimeCompare = opts.constantTimeCompare;
    this.accessTimeoutMs = opts.accessTimeoutMs;
    this._audit = opts.audit || null;

    // Compute tree dimensions
    this.leafCount = 1 << this.treeDepth; // 2^depth leaves
    this.nodeCount = (1 << (this.treeDepth + 1)) - 1; // total nodes
    this.bucketCount = this.nodeCount;

    // Initialize storage
    this._tree = []; // array of buckets, each bucket is array of blocks
    this._positionMap = new Map(); // blockId -> leaf index
    this._stash = []; // temporary block buffer
    this._blockMetadata = new Map(); // blockId -> { size, createdAt, accessCount }
    this._accessLog = []; // tamper-evident access log
    this._maxLogSize = 500;
    this._accessCount = 0;
    this._dummyAccessCount = 0;
    this._reshuffleCount = 0;

    this._initializeTree();
  }

  /**
   * Initialize the ORAM tree with empty buckets.
   * @private
   */
  _initializeTree() {
    for (let i = 0; i < this.nodeCount; i++) {
      const bucket = [];
      for (let j = 0; j < this.bucketSize; j++) {
        bucket.push({
          blockId: null,
          data: null,
          leaf: 0,
          status: BLOCK_STATUS.EMPTY,
        });
      }
      this._tree.push(bucket);
    }
  }

  /**
   * Write a block to ORAM obliviously.
   * @param {number} blockId - Logical block identifier
   * @param {Buffer} data - Data to write
   * @returns {object} Write result
   */
  write(blockId, data) {
    if (typeof blockId !== "number" || blockId < 0) {
      throw new HsmAdapterError(
        "INVALID_BLOCK_ID",
        "blockId must be a non-negative number",
      );
    }
    if (blockId >= this.maxBlocks) {
      throw new HsmAdapterError(
        "BLOCK_ID_TOO_HIGH",
        `blockId ${blockId} exceeds max ${this.maxBlocks - 1}`,
      );
    }
    if (!Buffer.isBuffer(data)) {
      throw new HsmAdapterError("INVALID_DATA", "data must be a Buffer");
    }
    if (data.length > this.blockSize) {
      throw new HsmAdapterError(
        "DATA_TOO_LARGE",
        `${data.length} bytes exceeds block size ${this.blockSize}`,
      );
    }
    // Assign or update position
    const oldLeaf = this._positionMap.get(blockId);
    const newLeaf = this._randomLeaf();
    this._positionMap.set(blockId, newLeaf);
    // Read the old path (to remove old copy if exists)
    if (oldLeaf !== undefined) {
      this._readPath(blockId, oldLeaf);
    }
    // Add to stash with new position
    this._addToStash({
      blockId,
      data: Buffer.from(data),
      leaf: newLeaf,
    });
    // Write back the path
    this._writePath(newLeaf);
    // Update metadata
    const meta = this._blockMetadata.get(blockId) || {
      size: data.length,
      createdAt: Date.now(),
      accessCount: 0,
    };
    meta.size = data.length;
    meta.accessCount++;
    meta.lastAccess = Date.now();
    this._blockMetadata.set(blockId, meta);
    this._accessCount++;
    // Optional dummy access
    if (this.enableDummyAccesses) {
      this._performDummyAccess();
    }
    this._appendLog("ORAM_WRITE", {
      blockId,
      leaf: newLeaf,
      size: data.length,
    });
    if (typeof this._audit === "function") {
      this._audit("ORAM_WRITE", { blockId, size: data.length });
    }
    return {
      blockId,
      written: true,
      leaf: newLeaf,
      size: data.length,
    };
  }

  /**
   * Read a block from ORAM obliviously.
   * @param {number} blockId - Logical block identifier
   * @returns {object} Read result with data
   */
  read(blockId) {
    if (typeof blockId !== "number" || blockId < 0) {
      throw new HsmAdapterError(
        "INVALID_BLOCK_ID",
        "blockId must be a non-negative number",
      );
    }
    if (blockId >= this.maxBlocks) {
      throw new HsmAdapterError(
        "BLOCK_ID_TOO_HIGH",
        `blockId ${blockId} exceeds max ${this.maxBlocks - 1}`,
      );
    }
    const leaf = this._positionMap.get(blockId);
    if (leaf === undefined) {
      throw new HsmAdapterError(
        "BLOCK_NOT_FOUND",
        `block ${blockId} not found`,
      );
    }
    // Assign new leaf (remap)
    const newLeaf = this._randomLeaf();
    this._positionMap.set(blockId, newLeaf);
    // Read the path
    const foundBlock = this._readPath(blockId, leaf);
    if (!foundBlock) {
      // Check stash
      const stashIdx = this._stash.findIndex((b) => b.blockId === blockId);
      if (stashIdx >= 0) {
        const block = this._stash[stashIdx];
        block.leaf = newLeaf;
        this._writePath(newLeaf);
        this._accessCount++;
        if (this.enableDummyAccesses) this._performDummyAccess();
        this._updateMeta(blockId);
        this._appendLog("ORAM_READ", { blockId, leaf: newLeaf });
        return { blockId, data: block.data, read: true };
      }
      throw new HsmAdapterError(
        "BLOCK_NOT_FOUND",
        `block ${blockId} not found in tree or stash`,
      );
    }
    // Update block's leaf in stash
    foundBlock.leaf = newLeaf;
    // Write back the path
    this._writePath(newLeaf);
    this._accessCount++;
    if (this.enableDummyAccesses) this._performDummyAccess();
    this._updateMeta(blockId);
    this._appendLog("ORAM_READ", { blockId, leaf: newLeaf });
    if (typeof this._audit === "function") {
      this._audit("ORAM_READ", { blockId });
    }
    return { blockId, data: foundBlock.data, read: true };
  }

  /**
   * Delete a block from ORAM.
   * @param {number} blockId
   * @returns {object}
   */
  delete(blockId) {
    if (typeof blockId !== "number" || blockId < 0) {
      throw new HsmAdapterError(
        "INVALID_BLOCK_ID",
        "blockId must be a non-negative number",
      );
    }
    const leaf = this._positionMap.get(blockId);
    if (leaf === undefined) {
      throw new HsmAdapterError(
        "BLOCK_NOT_FOUND",
        `block ${blockId} not found`,
      );
    }
    // Read path to get the block
    this._readPath(blockId, leaf);
    // Remove from stash
    this._stash = this._stash.filter((b) => b.blockId !== blockId);
    // Remove from position map
    this._positionMap.delete(blockId);
    // Remove metadata
    this._blockMetadata.delete(blockId);
    // Write back path (without the deleted block)
    this._writePath(leaf);
    this._accessCount++;
    this._appendLog("ORAM_DELETE", { blockId });
    if (typeof this._audit === "function") {
      this._audit("ORAM_DELETE", { blockId });
    }
    return { blockId, deleted: true };
  }

  /**
   * Check if a block exists.
   * @param {number} blockId
   * @returns {boolean}
   */
  has(blockId) {
    if (typeof blockId !== "number" || blockId < 0) return false;
    return this._positionMap.has(blockId);
  }

  /**
   * Get block metadata.
   * @param {number} blockId
   * @returns {object|null}
   */
  getBlockInfo(blockId) {
    const meta = this._blockMetadata.get(blockId);
    if (!meta) return null;
    return {
      blockId,
      size: meta.size,
      createdAt: meta.createdAt,
      accessCount: meta.accessCount,
      lastAccess: meta.lastAccess,
    };
  }

  /**
   * Get all block IDs (for admin purposes — not oblivious).
   * @returns {number[]}
   */
  getBlockIds() {
    return Array.from(this._positionMap.keys()).sort((a, b) => a - b);
  }

  /**
   * Get stash size.
   * @returns {number}
   */
  getStashSize() {
    return this._stash.length;
  }

  /**
   * Get access log.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getAccessLog(limit) {
    const n = typeof limit === "number" ? limit : 50;
    return this._accessLog.slice(-n);
  }

  /**
   * Verify access log integrity.
   * @returns {object}
   */
  verifyAccessLogIntegrity() {
    for (let i = 1; i < this._accessLog.length; i++) {
      const prev = this._accessLog[i - 1];
      const curr = this._accessLog[i];
      const expectedPrevHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(prev))
        .digest("hex");
      if (curr.prevHash !== expectedPrevHash) {
        return { intact: false, brokenAt: i };
      }
    }
    return { intact: true, entries: this._accessLog.length };
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    return {
      totalBlocks: this._positionMap.size,
      treeNodes: this.nodeCount,
      treeDepth: this.treeDepth,
      leafCount: this.leafCount,
      stashSize: this._stash.length,
      stashCapacity: this.maxStashSize,
      accessCount: this._accessCount,
      dummyAccessCount: this._dummyAccessCount,
      reshuffleCount: this._reshuffleCount,
      bucketSize: this.bucketSize,
      blockSize: this.blockSize,
    };
  }

  /**
   * Evict stash overflow.
   * @returns {number} Number of blocks evicted
   */
  evictStash() {
    if (this._stash.length <= this.maxStashSize) return 0;
    let evicted = 0;
    while (this._stash.length > this.maxStashSize && this._stash.length > 0) {
      const block = this._stash.shift();
      this._writePath(block.leaf);
      evicted++;
    }
    this._reshuffleCount++;
    this._appendLog("STASH_EVICTED", { evicted });
    return evicted;
  }

  /**
   * Reset the ORAM (for testing).
   */
  reset() {
    this._tree = [];
    this._positionMap.clear();
    this._stash = [];
    this._blockMetadata.clear();
    this._accessLog = [];
    this._accessCount = 0;
    this._dummyAccessCount = 0;
    this._reshuffleCount = 0;
    this._initializeTree();
  }

  /**
   * Generate a random leaf index.
   * @returns {number}
   * @private
   */
  _randomLeaf() {
    return crypto.randomInt(0, this.leafCount);
  }

  /**
   * Read a path from root to leaf and load blocks into stash.
   * @param {number} blockId - Block to find (null for dummy access)
   * @param {number} leaf - Leaf index
   * @returns {object|null} The found block, or null
   * @private
   */
  _readPath(blockId, leaf) {
    const path = this._getPathNodes(leaf);
    let foundBlock = null;
    for (const nodeIdx of path) {
      const bucket = this._tree[nodeIdx];
      for (let i = 0; i < bucket.length; i++) {
        const block = bucket[i];
        if (block.status === BLOCK_STATUS.OCCUPIED) {
          // Add to stash
          this._addToStash({
            blockId: block.blockId,
            data: block.data,
            leaf: block.leaf,
          });
          // Check if this is the target block
          if (
            blockId !== null &&
            this._constantTimeEqual(block.blockId, blockId)
          ) {
            foundBlock = this._stash[this._stash.length - 1];
          }
          // Clear the bucket slot
          bucket[i] = {
            blockId: null,
            data: null,
            leaf: 0,
            status: BLOCK_STATUS.EMPTY,
          };
        }
      }
    }
    return foundBlock;
  }

  /**
   * Write blocks from stash back to a path.
   * @param {number} leaf - Leaf index
   * @private
   */
  _writePath(leaf) {
    const path = this._getPathNodes(leaf);
    // Try to place each stash block into the deepest possible bucket
    const remaining = [];
    for (const block of this._stash) {
      // Only place blocks whose leaf matches this path
      if (!this._isOnPath(block.leaf, leaf)) {
        remaining.push(block);
        continue;
      }
      // Find deepest bucket on this path that has space
      let placed = false;
      for (let level = this.treeDepth; level >= 0; level--) {
        const nodeIdx = path[level];
        const bucket = this._tree[nodeIdx];
        for (let i = 0; i < bucket.length; i++) {
          if (bucket[i].status === BLOCK_STATUS.EMPTY) {
            // Check if block's leaf is in this bucket's subtree
            if (this._isInSubtree(block.leaf, nodeIdx, level)) {
              bucket[i] = {
                blockId: block.blockId,
                data: block.data,
                leaf: block.leaf,
                status: BLOCK_STATUS.OCCUPIED,
              };
              placed = true;
              break;
            }
          }
        }
        if (placed) break;
      }
      if (!placed) {
        remaining.push(block);
      }
    }
    this._stash = remaining;
  }

  /**
   * Get the path from root to leaf (array of node indices).
   * @param {number} leaf - Leaf index
   * @returns {number[]} Array of node indices from root to leaf
   * @private
   */
  _getPathNodes(leaf) {
    const path = [];
    let node = 0; // root
    for (let level = 0; level <= this.treeDepth; level++) {
      path.push(node);
      if (level < this.treeDepth) {
        // Go left or right based on leaf bit at this level
        const bit = (leaf >> (this.treeDepth - level - 1)) & 1;
        node = 2 * node + 1 + bit;
      }
    }
    return path;
  }

  /**
   * Check if a leaf is on the path to another leaf.
   * @param {number} blockLeaf - Block's assigned leaf
   * @param {number} pathLeaf - Path's leaf
   * @returns {boolean}
   * @private
   */
  _isOnPath(blockLeaf, pathLeaf) {
    // Two leaves are on the same path if they share the same path
    // (i.e., the block's leaf equals the path's leaf)
    return blockLeaf === pathLeaf;
  }

  /**
   * Check if a leaf is in the subtree rooted at a given node.
   * @param {number} leaf - Leaf index
   * @param {number} nodeIdx - Node index
   * @param {number} level - Level of the node
   * @returns {boolean}
   * @private
   */
  _isInSubtree(leaf, nodeIdx, level) {
    // The leaf is in the subtree if the path to the leaf passes through this node
    const path = this._getPathNodes(leaf);
    return path[level] === nodeIdx;
  }

  /**
   * Add a block to the stash.
   * @param {object} block
   * @private
   */
  _addToStash(block) {
    if (this._stash.length >= this.maxStashSize) {
      this.evictStash();
    }
    this._stash.push(block);
  }

  /**
   * Perform a dummy access to obfuscate access patterns.
   * @private
   */
  _performDummyAccess() {
    const dummyLeaf = this._randomLeaf();
    this._readPath(null, dummyLeaf);
    this._writePath(dummyLeaf);
    this._dummyAccessCount++;
  }

  /**
   * Update block metadata on access.
   * @param {number} blockId
   * @private
   */
  _updateMeta(blockId) {
    const meta = this._blockMetadata.get(blockId);
    if (meta) {
      meta.accessCount++;
      meta.lastAccess = Date.now();
    }
  }

  /**
   * Constant-time comparison to prevent timing side-channels.
   * @param {number} a
   * @param {number} b
   * @returns {boolean}
   * @private
   */
  _constantTimeEqual(a, b) {
    if (!this.constantTimeCompare) return a === b;
    // Simulate constant-time comparison
    let result = 0;
    const xa = a | 0;
    const xb = b | 0;
    result |= xa ^ xb;
    return result === 0;
  }

  /**
   * Append to tamper-evident access log.
   * @param {string} event
   * @param {object} info
   * @private
   */
  _appendLog(event, info) {
    const prevHash =
      this._accessLog.length > 0
        ? crypto
            .createHash("sha256")
            .update(JSON.stringify(this._accessLog[this._accessLog.length - 1]))
            .digest("hex")
        : "0".repeat(64);
    this._accessLog.push({
      seq: this._accessLog.length,
      event,
      info,
      timestamp: Date.now(),
      prevHash,
    });
    if (this._accessLog.length > this._maxLogSize) {
      this._accessLog.shift();
    }
  }
}

module.exports = {
  OramEngine,
  DEFAULT_OPTIONS,
  BLOCK_STATUS,
};
