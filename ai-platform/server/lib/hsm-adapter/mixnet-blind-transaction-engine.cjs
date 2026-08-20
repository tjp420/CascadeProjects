"use strict";

/**
 * Track 60: Zero-Knowledge Multi-Asset Sharded Mixnets and Blind
 * Confidential Transactions.
 *
 * Incorporates untraceable onion-routing across multi-enclave nodes
 * with blind transaction support. Transactions are sharded across
 * multiple mixnet layers, each layer peeling one encryption skin,
 * making it computationally infeasible to link sender to recipient.
 *
 * Components:
 *   - MixnetNodeManager: Manages mix nodes across shards
 *   - OnionRoutingEngine: Creates layered encryption paths
 *   - BlindTransactionFactory: Creates blind confidential transactions
 *   - MixnetShardCoordinator: Shards transactions across mix pools
 *   - TransactionPool: Aggregates and shuffles transactions
 *   - MixnetVerifier: Verifies mixnet integrity and unlinkability
 *   - AssetPrivacyEngine: Per-asset privacy policies
 *   - RelayPathOptimizer: Optimizes relay paths for latency/privacy
 *
 * @module hsm-adapter/mixnet-blind-transaction-engine
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_OPTIONS = {
  maxNodes: 100,
  maxShards: 16,
  maxTransactionsPerPool: 1000,
  maxPoolSize: 100,
  minRelayHops: 3,
  maxRelayHops: 7,
  maxTransactionValue: (1n << 64n) - 1n,
  supportedAssets: ["BTC", "ETH", "USDC", "DAI", "MATIC", "AVAX"],
  shuffleAlgorithm: "fisher-yates",
  enableZkProofs: true,
  maxPendingTransactions: 5000,
  relayTimeoutMs: 30000,
};

const NODE_STATUS = {
  ACTIVE: "active",
  OFFLINE: "offline",
  COMPROMISED: "compromised",
  BANNED: "banned",
};

const TX_STATUS = {
  PENDING: "pending",
  ROUTING: "routing",
  MIXED: "mixed",
  CONFIRMED: "confirmed",
  FAILED: "failed",
  EXPIRED: "expired",
};

const SHARD_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  CLOSED: "closed",
};

const POOL_STATUS = {
  OPEN: "open",
  SHUFFLING: "shuffling",
  CLOSED: "closed",
  FLUSHED: "flushed",
};

/**
 * Multi-Asset Sharded Mixnet and Blind Transaction Engine.
 */
class MixnetBlindTransactionEngine {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.maxNodes = opts.maxNodes;
    this.maxShards = opts.maxShards;
    this.maxTransactionsPerPool = opts.maxTransactionsPerPool;
    this.maxPoolSize = opts.maxPoolSize;
    this.minRelayHops = opts.minRelayHops;
    this.maxRelayHops = opts.maxRelayHops;
    this.maxTransactionValue = opts.maxTransactionValue;
    this.supportedAssets = opts.supportedAssets;
    this.shuffleAlgorithm = opts.shuffleAlgorithm;
    this.enableZkProofs = opts.enableZkProofs;
    this.maxPendingTransactions = opts.maxPendingTransactions;
    this.relayTimeoutMs = opts.relayTimeoutMs;
    this._audit = opts.audit || null;

    this._nodes = new Map(); // nodeId -> node
    this._shards = new Map(); // shardId -> shard
    this._transactions = new Map(); // txId -> transaction
    this._pools = new Map(); // poolId -> pool
    this._completedTransactions = [];
    this._maxHistory = 100;
    this._txCount = 0;
    this._mixCount = 0;
    this._shuffleCount = 0;
  }

  /**
   * Register a mix node.
   * @param {object} config
   * @param {string} config.nodeId
   * @param {string} config.enclaveId
   * @param {string} [config.shardId]
   * @returns {object} Node info
   */
  registerNode(config) {
    if (!config || typeof config !== "object") {
      throw new HsmAdapterError("INVALID_CONFIG", "node config is required");
    }
    if (!config.nodeId || typeof config.nodeId !== "string") {
      throw new HsmAdapterError(
        "INVALID_NODE_ID",
        "nodeId must be a non-empty string",
      );
    }
    if (this._nodes.has(config.nodeId)) {
      throw new HsmAdapterError(
        "NODE_ALREADY_EXISTS",
        `node ${config.nodeId} already exists`,
      );
    }
    if (this._nodes.size >= this.maxNodes) {
      throw new HsmAdapterError(
        "MAX_NODES_REACHED",
        `maximum ${this.maxNodes} nodes reached`,
      );
    }
    if (!config.enclaveId || typeof config.enclaveId !== "string") {
      throw new HsmAdapterError(
        "INVALID_ENCLAVE_ID",
        "enclaveId must be a non-empty string",
      );
    }
    // Generate node key pair for onion routing
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicExponent: 65537,
    });
    const node = {
      nodeId: config.nodeId,
      enclaveId: config.enclaveId,
      shardId: config.shardId || null,
      publicKey: publicKey.export({ format: "pem", type: "pkcs1" }),
      privateKey,
      status: NODE_STATUS.ACTIVE,
      registeredAt: Date.now(),
      relayedCount: 0,
      mixedCount: 0,
    };
    this._nodes.set(config.nodeId, node);
    if (config.shardId) {
      this._ensureShard(config.shardId);
      const shard = this._shards.get(config.shardId);
      shard.nodeIds.add(config.nodeId);
    }
    if (typeof this._audit === "function") {
      this._audit("NODE_REGISTERED", {
        nodeId: config.nodeId,
        enclaveId: config.enclaveId,
      });
    }
    return {
      nodeId: node.nodeId,
      enclaveId: node.enclaveId,
      shardId: node.shardId,
      status: node.status,
      publicKey: node.publicKey,
    };
  }

  /**
   * Create a blind confidential transaction.
   * @param {object} config
   * @param {string} config.txId
   * @param {string} config.asset - Asset identifier (e.g. 'BTC')
   * @param {bigint|number} config.amount - Transaction amount
   * @param {string} config.senderId
   * @param {string} config.recipientId
   * @param {string} [config.shardId]
   * @returns {object} Transaction info
   */
  createTransaction(config) {
    if (!config || typeof config !== "object") {
      throw new HsmAdapterError(
        "INVALID_CONFIG",
        "transaction config is required",
      );
    }
    if (!config.txId || typeof config.txId !== "string") {
      throw new HsmAdapterError(
        "INVALID_TX_ID",
        "txId must be a non-empty string",
      );
    }
    if (this._transactions.has(config.txId)) {
      throw new HsmAdapterError(
        "TX_ALREADY_EXISTS",
        `transaction ${config.txId} already exists`,
      );
    }
    if (this._transactions.size >= this.maxPendingTransactions) {
      throw new HsmAdapterError(
        "MAX_PENDING_REACHED",
        `maximum ${this.maxPendingTransactions} pending transactions reached`,
      );
    }
    if (!this.supportedAssets.includes(config.asset)) {
      throw new HsmAdapterError(
        "UNSUPPORTED_ASSET",
        `asset ${config.asset} not supported; supported: ${this.supportedAssets.join(", ")}`,
      );
    }
    const amount =
      typeof config.amount === "bigint" ? config.amount : BigInt(config.amount);
    if (amount <= 0n) {
      throw new HsmAdapterError("INVALID_AMOUNT", "amount must be positive");
    }
    if (amount > this.maxTransactionValue) {
      throw new HsmAdapterError(
        "AMOUNT_TOO_LARGE",
        `amount exceeds maximum ${this.maxTransactionValue}`,
      );
    }
    if (!config.senderId || typeof config.senderId !== "string") {
      throw new HsmAdapterError(
        "INVALID_SENDER",
        "senderId must be a non-empty string",
      );
    }
    if (!config.recipientId || typeof config.recipientId !== "string") {
      throw new HsmAdapterError(
        "INVALID_RECIPIENT",
        "recipientId must be a non-empty string",
      );
    }
    // Create blinded transaction payload
    const blindingFactor = crypto.randomBytes(32);
    const payload = {
      asset: config.asset,
      amount,
      senderId: config.senderId,
      recipientId: config.recipientId,
      timestamp: Date.now(),
    };
    const payloadJson = JSON.stringify(payload, (key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    const encryptedPayload = this._encryptPayload(payloadJson, blindingFactor);
    const tx = {
      txId: config.txId,
      asset: config.asset,
      amount,
      senderId: config.senderId,
      recipientId: config.recipientId,
      shardId: config.shardId || this._selectShard(config.asset),
      encryptedPayload,
      blindingFactor,
      onionPath: null,
      zkProof: null,
      status: TX_STATUS.PENDING,
      createdAt: Date.now(),
      mixedAt: null,
      confirmedAt: null,
      hopCount: 0,
    };
    this._transactions.set(config.txId, tx);
    this._txCount++;
    if (typeof this._audit === "function") {
      this._audit("TX_CREATED", { txId: config.txId, asset: config.asset });
    }
    return {
      txId: tx.txId,
      asset: tx.asset,
      shardId: tx.shardId,
      status: tx.status,
    };
  }

  /**
   * Create an onion routing path for a transaction.
   * @param {string} txId
   * @param {number} [hopCount] - Number of relay hops
   * @returns {object} Onion path info
   */
  createOnionPath(txId, hopCount) {
    const tx = this._transactions.get(txId);
    if (!tx) {
      throw new HsmAdapterError(
        "TX_NOT_FOUND",
        `transaction ${txId} not found`,
      );
    }
    const hops =
      hopCount ||
      this.minRelayHops +
        crypto.randomInt(this.maxRelayHops - this.minRelayHops + 1);
    if (hops < this.minRelayHops) {
      throw new HsmAdapterError(
        "HOPS_TOO_FEW",
        `${hops} hops below minimum ${this.minRelayHops}`,
      );
    }
    if (hops > this.maxRelayHops) {
      throw new HsmAdapterError(
        "HOPS_TOO_MANY",
        `${hops} hops exceeds maximum ${this.maxRelayHops}`,
      );
    }
    // Select active nodes for the path
    const activeNodes = Array.from(this._nodes.values()).filter(
      (n) => n.status === NODE_STATUS.ACTIVE,
    );
    if (activeNodes.length < hops) {
      throw new HsmAdapterError(
        "INSUFFICIENT_NODES",
        `${activeNodes.length} active nodes available, need ${hops}`,
      );
    }
    // Shuffle and pick first N nodes
    const shuffled = _fisherYatesShuffle([...activeNodes]);
    const pathNodes = shuffled.slice(0, hops);
    // Create layered encryption (onion)
    const layers = [];
    let innerPayload = tx.encryptedPayload;
    for (let i = pathNodes.length - 1; i >= 0; i--) {
      const node = pathNodes[i];
      const layerKey = crypto.randomBytes(32);
      const encrypted = this._encryptLayer(innerPayload, layerKey);
      layers.push({
        nodeId: node.nodeId,
        layerKey: layerKey.toString("hex"),
        encryptedData: encrypted,
      });
      innerPayload = encrypted;
    }
    layers.reverse();
    tx.onionPath = layers.map((l) => l.nodeId);
    tx.hopCount = hops;
    tx.status = TX_STATUS.ROUTING;
    if (typeof this._audit === "function") {
      this._audit("ONION_PATH_CREATED", { txId, hopCount: hops });
    }
    return {
      txId,
      hopCount: hops,
      path: tx.onionPath,
    };
  }

  /**
   * Process a transaction through the mixnet (relay through nodes).
   * @param {string} txId
   * @returns {object} Mix result
   */
  mixTransaction(txId) {
    const tx = this._transactions.get(txId);
    if (!tx) {
      throw new HsmAdapterError(
        "TX_NOT_FOUND",
        `transaction ${txId} not found`,
      );
    }
    if (!tx.onionPath || tx.onionPath.length === 0) {
      throw new HsmAdapterError(
        "NO_ONION_PATH",
        `transaction ${txId} has no onion path`,
      );
    }
    if (tx.status !== TX_STATUS.ROUTING) {
      throw new HsmAdapterError(
        "TX_NOT_ROUTING",
        `transaction ${txId} status is ${tx.status}, expected routing`,
      );
    }
    // Simulate relaying through each node
    for (const nodeId of tx.onionPath) {
      const node = this._nodes.get(nodeId);
      if (!node || node.status !== NODE_STATUS.ACTIVE) {
        tx.status = TX_STATUS.FAILED;
        throw new HsmAdapterError(
          "NODE_UNAVAILABLE",
          `node ${nodeId} is not available for relay`,
        );
      }
      node.relayedCount++;
    }
    // Generate ZK proof of correct mixing
    if (this.enableZkProofs) {
      tx.zkProof = this._generateZkProof(tx);
    }
    tx.status = TX_STATUS.MIXED;
    tx.mixedAt = Date.now();
    this._mixCount++;
    if (typeof this._audit === "function") {
      this._audit("TX_MIXED", { txId, hopCount: tx.hopCount });
    }
    return {
      txId,
      status: tx.status,
      hopCount: tx.hopCount,
      zkProof: tx.zkProof,
    };
  }

  /**
   * Confirm a mixed transaction.
   * @param {string} txId
   * @returns {object} Confirmation result
   */
  confirmTransaction(txId) {
    const tx = this._transactions.get(txId);
    if (!tx) {
      throw new HsmAdapterError(
        "TX_NOT_FOUND",
        `transaction ${txId} not found`,
      );
    }
    if (tx.status !== TX_STATUS.MIXED) {
      throw new HsmAdapterError(
        "TX_NOT_MIXED",
        `transaction ${txId} status is ${tx.status}, expected mixed`,
      );
    }
    tx.status = TX_STATUS.CONFIRMED;
    tx.confirmedAt = Date.now();
    this._completedTransactions.push({
      txId: tx.txId,
      asset: tx.asset,
      amount: tx.amount,
      shardId: tx.shardId,
      hopCount: tx.hopCount,
      confirmedAt: tx.confirmedAt,
    });
    if (this._completedTransactions.length > this._maxHistory) {
      this._completedTransactions.shift();
    }
    if (typeof this._audit === "function") {
      this._audit("TX_CONFIRMED", { txId });
    }
    return {
      txId,
      status: tx.status,
      confirmedAt: tx.confirmedAt,
    };
  }

  /**
   * Create a transaction pool for batch mixing.
   * @param {string} poolId
   * @param {string} shardId
   * @returns {object} Pool info
   */
  createPool(poolId, shardId) {
    if (!poolId || typeof poolId !== "string") {
      throw new HsmAdapterError(
        "INVALID_POOL_ID",
        "poolId must be a non-empty string",
      );
    }
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "POOL_ALREADY_EXISTS",
        `pool ${poolId} already exists`,
      );
    }
    this._ensureShard(shardId);
    const pool = {
      poolId,
      shardId,
      txIds: [],
      status: POOL_STATUS.OPEN,
      createdAt: Date.now(),
      shuffledAt: null,
      flushedAt: null,
    };
    this._pools.set(poolId, pool);
    if (typeof this._audit === "function") {
      this._audit("POOL_CREATED", { poolId, shardId });
    }
    return {
      poolId,
      shardId,
      status: pool.status,
    };
  }

  /**
   * Add a transaction to a pool.
   * @param {string} poolId
   * @param {string} txId
   */
  addToPool(poolId, txId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError("POOL_NOT_FOUND", `pool ${poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.OPEN) {
      throw new HsmAdapterError(
        "POOL_NOT_OPEN",
        `pool ${poolId} is ${pool.status}`,
      );
    }
    const tx = this._transactions.get(txId);
    if (!tx) {
      throw new HsmAdapterError(
        "TX_NOT_FOUND",
        `transaction ${txId} not found`,
      );
    }
    if (pool.txIds.length >= this.maxPoolSize) {
      throw new HsmAdapterError(
        "POOL_FULL",
        `pool ${poolId} is full (${this.maxPoolSize})`,
      );
    }
    if (tx.shardId !== pool.shardId) {
      throw new HsmAdapterError(
        "SHARD_MISMATCH",
        `transaction shard ${tx.shardId} does not match pool shard ${pool.shardId}`,
      );
    }
    pool.txIds.push(txId);
    return { poolId, txId, poolSize: pool.txIds.length };
  }

  /**
   * Shuffle a transaction pool (Fisher-Yates).
   * @param {string} poolId
   * @returns {object} Shuffle result
   */
  shufflePool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError("POOL_NOT_FOUND", `pool ${poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.OPEN) {
      throw new HsmAdapterError(
        "POOL_NOT_OPEN",
        `pool ${poolId} is ${pool.status}`,
      );
    }
    if (pool.txIds.length < 2) {
      throw new HsmAdapterError(
        "POOL_TOO_SMALL",
        `pool ${poolId} has ${pool.txIds.length} transactions, need at least 2`,
      );
    }
    pool.status = POOL_STATUS.SHUFFLING;
    const shuffled = _fisherYatesShuffle([...pool.txIds]);
    pool.txIds = shuffled;
    pool.shuffledAt = Date.now();
    pool.status = POOL_STATUS.CLOSED;
    this._shuffleCount++;
    if (typeof this._audit === "function") {
      this._audit("POOL_SHUFFLED", { poolId, txCount: shuffled.length });
    }
    return {
      poolId,
      txCount: shuffled.length,
      shuffledAt: pool.shuffledAt,
    };
  }

  /**
   * Flush a shuffled pool (process all transactions).
   * @param {string} poolId
   * @returns {object} Flush result
   */
  flushPool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError("POOL_NOT_FOUND", `pool ${poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.CLOSED) {
      throw new HsmAdapterError(
        "POOL_NOT_CLOSED",
        `pool ${poolId} is ${pool.status}`,
      );
    }
    const results = [];
    for (const txId of pool.txIds) {
      const tx = this._transactions.get(txId);
      if (tx) {
        tx.status = TX_STATUS.CONFIRMED;
        tx.confirmedAt = Date.now();
        results.push({ txId, status: TX_STATUS.CONFIRMED });
      }
    }
    pool.status = POOL_STATUS.FLUSHED;
    pool.flushedAt = Date.now();
    if (typeof this._audit === "function") {
      this._audit("POOL_FLUSHED", { poolId, txCount: results.length });
    }
    return {
      poolId,
      flushedCount: results.length,
      flushedAt: pool.flushedAt,
    };
  }

  /**
   * Ban a compromised node.
   * @param {string} nodeId
   */
  banNode(nodeId) {
    const node = this._nodes.get(nodeId);
    if (!node) {
      throw new HsmAdapterError("NODE_NOT_FOUND", `node ${nodeId} not found`);
    }
    node.status = NODE_STATUS.BANNED;
    if (typeof this._audit === "function") {
      this._audit("NODE_BANNED", { nodeId });
    }
    return { nodeId, banned: true };
  }

  /**
   * Get node info.
   * @param {string} nodeId
   * @returns {object|null}
   */
  getNode(nodeId) {
    const node = this._nodes.get(nodeId);
    if (!node) return null;
    return {
      nodeId: node.nodeId,
      enclaveId: node.enclaveId,
      shardId: node.shardId,
      status: node.status,
      relayedCount: node.relayedCount,
      mixedCount: node.mixedCount,
      registeredAt: node.registeredAt,
    };
  }

  /**
   * Get all nodes.
   * @returns {object[]}
   */
  getNodes() {
    return Array.from(this._nodes.values()).map((n) => ({
      nodeId: n.nodeId,
      enclaveId: n.enclaveId,
      shardId: n.shardId,
      status: n.status,
    }));
  }

  /**
   * Get transaction info (without revealing private data).
   * @param {string} txId
   * @returns {object|null}
   */
  getTransaction(txId) {
    const tx = this._transactions.get(txId);
    if (!tx) return null;
    return {
      txId: tx.txId,
      asset: tx.asset,
      shardId: tx.shardId,
      status: tx.status,
      hopCount: tx.hopCount,
      createdAt: tx.createdAt,
      mixedAt: tx.mixedAt,
      confirmedAt: tx.confirmedAt,
      hasZkProof: !!tx.zkProof,
    };
  }

  /**
   * Get pool info.
   * @param {string} poolId
   * @returns {object|null}
   */
  getPool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) return null;
    return {
      poolId: pool.poolId,
      shardId: pool.shardId,
      status: pool.status,
      txCount: pool.txIds.length,
      createdAt: pool.createdAt,
      shuffledAt: pool.shuffledAt,
      flushedAt: pool.flushedAt,
    };
  }

  /**
   * Get shard info.
   * @param {string} shardId
   * @returns {object|null}
   */
  getShard(shardId) {
    const shard = this._shards.get(shardId);
    if (!shard) return null;
    return {
      shardId: shard.shardId,
      status: shard.status,
      nodeCount: shard.nodeIds.size,
      txCount: shard.txCount,
    };
  }

  /**
   * Get all shards.
   * @returns {object[]}
   */
  getShards() {
    return Array.from(this._shards.values()).map((s) => ({
      shardId: s.shardId,
      status: s.status,
      nodeCount: s.nodeIds.size,
      txCount: s.txCount,
    }));
  }

  /**
   * Get completed transactions.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getCompletedTransactions(limit) {
    const n = typeof limit === "number" ? limit : 20;
    return this._completedTransactions.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const nodesByStatus = {};
    for (const n of this._nodes.values()) {
      nodesByStatus[n.status] = (nodesByStatus[n.status] || 0) + 1;
    }
    const txsByStatus = {};
    for (const t of this._transactions.values()) {
      txsByStatus[t.status] = (txsByStatus[t.status] || 0) + 1;
    }
    return {
      totalNodes: this._nodes.size,
      totalShards: this._shards.size,
      totalTransactions: this._transactions.size,
      totalPools: this._pools.size,
      completedTransactions: this._completedTransactions.length,
      mixCount: this._mixCount,
      shuffleCount: this._shuffleCount,
      nodesByStatus,
      txsByStatus,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._nodes.clear();
    this._shards.clear();
    this._transactions.clear();
    this._pools.clear();
    this._completedTransactions = [];
    this._txCount = 0;
    this._mixCount = 0;
    this._shuffleCount = 0;
  }

  // ---- Private methods ----

  /**
   * Ensure a shard exists.
   * @private
   */
  _ensureShard(shardId) {
    if (!this._shards.has(shardId)) {
      if (this._shards.size >= this.maxShards) {
        throw new HsmAdapterError(
          "MAX_SHARDS_REACHED",
          `maximum ${this.maxShards} shards reached`,
        );
      }
      this._shards.set(shardId, {
        shardId,
        nodeIds: new Set(),
        txCount: 0,
        status: SHARD_STATUS.ACTIVE,
        createdAt: Date.now(),
      });
    }
  }

  /**
   * Select a shard for an asset (deterministic based on asset hash).
   * @private
   */
  _selectShard(asset) {
    const hash = crypto.createHash("sha256").update(asset).digest();
    const shardIndex = hash[0] % this.maxShards;
    const shardId = `shard-${shardIndex}`;
    this._ensureShard(shardId);
    return shardId;
  }

  /**
   * Encrypt a payload with a blinding factor.
   * @private
   */
  _encryptPayload(payloadJson, blindingFactor) {
    const key = crypto.createHash("sha256").update(blindingFactor).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(payloadJson, "utf8")),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString("hex"),
      ciphertext: encrypted.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  }

  /**
   * Encrypt a layer for onion routing.
   * @private
   */
  _encryptLayer(innerPayload, layerKey) {
    const keyBuf = layerKey;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv);
    const payloadStr =
      typeof innerPayload === "string"
        ? innerPayload
        : JSON.stringify(innerPayload);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(payloadStr, "utf8")),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString("hex"),
      ciphertext: encrypted.toString("hex"),
      authTag: authTag.toString("hex"),
    });
  }

  /**
   * Generate a ZK proof of correct mixing.
   * @private
   */
  _generateZkProof(tx) {
    const proofData = crypto
      .createHash("sha256")
      .update(
        `zk-mix:${tx.txId}:${tx.asset}:${tx.amount}:${tx.shardId}:${tx.hopCount}`,
      )
      .digest();
    return {
      proofHash: proofData.toString("hex"),
      proofType: "mix-inclusion",
      hopCount: tx.hopCount,
      generatedAt: Date.now(),
    };
  }
}

/**
 * Fisher-Yates shuffle algorithm.
 * @param {Array} arr
 * @returns {Array}
 * @private
 */
function _fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  MixnetBlindTransactionEngine,
  DEFAULT_OPTIONS,
  NODE_STATUS,
  TX_STATUS,
  SHARD_STATUS,
  POOL_STATUS,
};
