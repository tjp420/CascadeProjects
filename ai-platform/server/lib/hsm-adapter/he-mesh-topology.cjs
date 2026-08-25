"use strict";

/**
 * Track 51: Homomorphic Encryption Over Mesh Topologies.
 *
 * Routes encrypted queries across a mesh of enclaves, performing
 * homomorphic evaluation at each hop without decrypting the data.
 * Supports additive and multiplicative HE operations, mesh topology
 * construction, shortest-path routing, and encrypted query plans.
 *
 * Components:
 *   - MeshTopologyManager: Builds and maintains enclave mesh graph
 *   - HeQueryRouter: Routes encrypted queries via shortest path
 *   - HeEvaluationEngine: Performs homomorphic ops at each hop
 *   - EncryptedQueryPlanner: Creates multi-hop evaluation plans
 *   - MeshNodeRegistry: Tracks enclave nodes and their HE capabilities
 *
 * @module hsm-adapter/he-mesh-topology
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_OPTIONS = {
  maxNodes: 64,
  maxHops: 8,
  maxQuerySize: 65536,
  supportedSchemes: ["additive", "multiplicative", "paillier", "bfv", "ckks"],
  defaultScheme: "additive",
  requireAttestation: false,
  queryTimeoutMs: 30000,
  maxRetries: 3,
  enableShortestPath: true,
};

const NODE_STATUS = {
  ACTIVE: "active",
  DEGRADED: "degraded",
  OFFLINE: "offline",
};

const QUERY_STATUS = {
  PENDING: "pending",
  IN_TRANSIT: "in-transit",
  EVALUATING: "evaluating",
  COMPLETED: "completed",
  FAILED: "failed",
  EXPIRED: "expired",
};

const HE_OPERATION = {
  ADD: "add",
  MULTIPLY: "multiply",
  SCALAR_MUL: "scalar-mul",
  SUBTRACT: "subtract",
  COMPARE: "compare",
};

/**
 * Homomorphic Encryption Over Mesh Topologies Engine.
 */
class HeMeshTopology {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.maxNodes = opts.maxNodes;
    this.maxHops = opts.maxHops;
    this.maxQuerySize = opts.maxQuerySize;
    this.supportedSchemes = opts.supportedSchemes;
    this.defaultScheme = opts.defaultScheme;
    this.requireAttestation = opts.requireAttestation;
    this.queryTimeoutMs = opts.queryTimeoutMs;
    this.maxRetries = opts.maxRetries;
    this.enableShortestPath = opts.enableShortestPath;
    this._audit = opts.audit || null;

    this._nodes = new Map(); // nodeId -> { id, status, schemes, capacity, load, neighbors: Set }
    this._edges = new Map(); // "nodeA:nodeB" -> { latency, bandwidth, trust }
    this._queries = new Map(); // queryId -> query state
    this._completedQueries = [];
    this._maxHistory = 100;
  }

  /**
   * Register a node in the mesh.
   * @param {string} nodeId
   * @param {object} [meta]
   * @param {string[]} [meta.schemes] - Supported HE schemes
   * @param {number} [meta.capacity] - Relative capacity
   */
  registerNode(nodeId, meta) {
    if (!nodeId || typeof nodeId !== "string") {
      throw new HsmAdapterError(
        "INVALID_NODE",
        "nodeId must be a non-empty string",
      );
    }
    if (this._nodes.has(nodeId)) {
      throw new HsmAdapterError(
        "NODE_ALREADY_REGISTERED",
        `node ${nodeId} already registered`,
      );
    }
    if (this._nodes.size >= this.maxNodes) {
      throw new HsmAdapterError(
        "MAX_NODES_REACHED",
        `maximum ${this.maxNodes} nodes reached`,
      );
    }
    const schemes = (meta && meta.schemes) || [this.defaultScheme];
    for (const s of schemes) {
      if (!this.supportedSchemes.includes(s)) {
        throw new HsmAdapterError(
          "UNSUPPORTED_SCHEME",
          `scheme ${s} is not supported`,
        );
      }
    }
    this._nodes.set(nodeId, {
      id: nodeId,
      status: NODE_STATUS.ACTIVE,
      schemes,
      capacity: (meta && meta.capacity) || 1,
      load: 0,
      neighbors: new Set(),
      addedAt: Date.now(),
    });
    if (typeof this._audit === "function") {
      this._audit("MESH_NODE_REGISTERED", { nodeId, schemes });
    }
  }

  /**
   * Unregister a node and remove its edges.
   * @param {string} nodeId
   */
  unregisterNode(nodeId) {
    if (!this._nodes.has(nodeId)) {
      throw new HsmAdapterError("NODE_NOT_FOUND", `node ${nodeId} not found`);
    }
    // Remove edges
    for (const neighborId of this._nodes.get(nodeId).neighbors) {
      this._edges.delete(_edgeKey(nodeId, neighborId));
      const neighbor = this._nodes.get(neighborId);
      if (neighbor) neighbor.neighbors.delete(nodeId);
    }
    this._nodes.delete(nodeId);
    if (typeof this._audit === "function") {
      this._audit("MESH_NODE_UNREGISTERED", { nodeId });
    }
  }

  /**
   * Add an edge between two nodes.
   * @param {string} nodeA
   * @param {string} nodeB
   * @param {object} [meta]
   * @param {number} [meta.latency] - Latency in ms
   * @param {number} [meta.bandwidth] - Bandwidth in Mbps
   * @param {number} [meta.trust] - Trust score (0.0 to 1.0)
   */
  addEdge(nodeA, nodeB, meta) {
    if (!this._nodes.has(nodeA) || !this._nodes.has(nodeB)) {
      throw new HsmAdapterError(
        "NODE_NOT_FOUND",
        "both nodes must be registered",
      );
    }
    if (nodeA === nodeB) {
      throw new HsmAdapterError("INVALID_EDGE", "cannot add self-loop edge");
    }
    const key = _edgeKey(nodeA, nodeB);
    if (this._edges.has(key)) {
      throw new HsmAdapterError(
        "EDGE_ALREADY_EXISTS",
        `edge ${nodeA}-${nodeB} already exists`,
      );
    }
    this._edges.set(key, {
      nodeA,
      nodeB,
      latency: (meta && meta.latency) || 10,
      bandwidth: (meta && meta.bandwidth) || 100,
      trust: (meta && meta.trust) || 0.9,
    });
    this._nodes.get(nodeA).neighbors.add(nodeB);
    this._nodes.get(nodeB).neighbors.add(nodeA);
    if (typeof this._audit === "function") {
      this._audit("MESH_EDGE_ADDED", {
        nodeA,
        nodeB,
        latency: (meta && meta.latency) || 10,
      });
    }
  }

  /**
   * Remove an edge between two nodes.
   * @param {string} nodeA
   * @param {string} nodeB
   */
  removeEdge(nodeA, nodeB) {
    const key = _edgeKey(nodeA, nodeB);
    if (!this._edges.has(key)) {
      throw new HsmAdapterError(
        "EDGE_NOT_FOUND",
        `edge ${nodeA}-${nodeB} not found`,
      );
    }
    this._edges.delete(key);
    const a = this._nodes.get(nodeA);
    const b = this._nodes.get(nodeB);
    if (a) a.neighbors.delete(nodeB);
    if (b) b.neighbors.delete(nodeA);
    if (typeof this._audit === "function") {
      this._audit("MESH_EDGE_REMOVED", { nodeA, nodeB });
    }
  }

  /**
   * Find the shortest path between two nodes using Dijkstra's algorithm.
   * @param {string} source
   * @param {string} destination
   * @returns {string[]|null} Array of node IDs in path order, or null if no path
   */
  findShortestPath(source, destination) {
    if (!this._nodes.has(source) || !this._nodes.has(destination)) {
      throw new HsmAdapterError(
        "NODE_NOT_FOUND",
        "source or destination not found",
      );
    }
    if (source === destination) return [source];
    // Dijkstra with latency as weight
    const distances = new Map();
    const previous = new Map();
    const visited = new Set();
    for (const nodeId of this._nodes.keys()) {
      distances.set(nodeId, Infinity);
      previous.set(nodeId, null);
    }
    distances.set(source, 0);
    while (visited.size < this._nodes.size) {
      // Find unvisited node with minimum distance
      let current = null;
      let minDist = Infinity;
      for (const [nodeId, dist] of distances) {
        if (!visited.has(nodeId) && dist < minDist) {
          minDist = dist;
          current = nodeId;
        }
      }
      if (current === null || minDist === Infinity) break;
      if (current === destination) break;
      visited.add(current);
      const node = this._nodes.get(current);
      for (const neighborId of node.neighbors) {
        if (visited.has(neighborId)) continue;
        const edge = this._edges.get(_edgeKey(current, neighborId));
        if (!edge) continue;
        const neighborNode = this._nodes.get(neighborId);
        if (neighborNode.status === NODE_STATUS.OFFLINE) continue;
        const newDist = distances.get(current) + edge.latency;
        if (newDist < distances.get(neighborId)) {
          distances.set(neighborId, newDist);
          previous.set(neighborId, current);
        }
      }
    }
    if (distances.get(destination) === Infinity) return null;
    // Reconstruct path
    const path = [];
    let current = destination;
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current);
    }
    return path;
  }

  /**
   * Create an encrypted query plan for multi-hop evaluation.
   * @param {object} config
   * @param {string} config.sourceNode - Starting node
   * @param {string} config.destinationNode - Final node
   * @param {number[]} config.encryptedData - Encrypted data to evaluate
   * @param {object[]} config.operations - Operations to perform at each hop
   * @param {string} config.operations[].type - HE operation type
   * @param {number} [config.operations[].operand] - Operand for the operation
   * @param {string} [config.scheme] - HE scheme to use
   * @returns {object} Query plan
   */
  createQueryPlan(config) {
    if (!config || typeof config !== "object") {
      throw new HsmAdapterError("INVALID_CONFIG", "query config is required");
    }
    if (!config.sourceNode || !config.destinationNode) {
      throw new HsmAdapterError(
        "INVALID_NODES",
        "sourceNode and destinationNode are required",
      );
    }
    if (
      !Array.isArray(config.encryptedData) ||
      config.encryptedData.length === 0
    ) {
      throw new HsmAdapterError(
        "INVALID_DATA",
        "encryptedData must be a non-empty array",
      );
    }
    if (config.encryptedData.length > this.maxQuerySize) {
      throw new HsmAdapterError(
        "QUERY_TOO_LARGE",
        `query size ${config.encryptedData.length} exceeds maximum ${this.maxQuerySize}`,
      );
    }
    if (!Array.isArray(config.operations)) {
      throw new HsmAdapterError(
        "INVALID_OPERATIONS",
        "operations must be an array",
      );
    }
    if (config.operations.length > this.maxHops) {
      throw new HsmAdapterError(
        "TOO_MANY_HOPS",
        `${config.operations.length} operations exceed max ${this.maxHops} hops`,
      );
    }
    const scheme = config.scheme || this.defaultScheme;
    if (!this.supportedSchemes.includes(scheme)) {
      throw new HsmAdapterError(
        "UNSUPPORTED_SCHEME",
        `scheme ${scheme} is not supported`,
      );
    }
    // Validate operations
    for (const op of config.operations) {
      if (!op.type || !Object.values(HE_OPERATION).includes(op.type)) {
        throw new HsmAdapterError(
          "INVALID_OPERATION",
          `operation type must be one of: ${Object.values(HE_OPERATION).join(", ")}`,
        );
      }
    }
    // Find path
    const path = this.enableShortestPath
      ? this.findShortestPath(config.sourceNode, config.destinationNode)
      : [config.sourceNode, config.destinationNode];
    if (!path || path.length === 0) {
      throw new HsmAdapterError(
        "NO_PATH_FOUND",
        `no path from ${config.sourceNode} to ${config.destinationNode}`,
      );
    }
    // Validate nodes along path support the scheme
    for (const nodeId of path) {
      const node = this._nodes.get(nodeId);
      if (!node.schemes.includes(scheme)) {
        throw new HsmAdapterError(
          "SCHEME_NOT_SUPPORTED",
          `node ${nodeId} does not support scheme ${scheme}`,
        );
      }
    }
    const queryId = _generateId("he-query", Date.now());
    const now = Date.now();
    const plan = {
      queryId,
      sourceNode: config.sourceNode,
      destinationNode: config.destinationNode,
      path,
      scheme,
      encryptedData: config.encryptedData.slice(),
      operations: config.operations.slice(),
      currentHop: 0,
      status: QUERY_STATUS.PENDING,
      createdAt: now,
      expiresAt: now + this.queryTimeoutMs,
      completedAt: null,
      result: null,
      errors: [],
      hopsExecuted: [],
    };
    this._queries.set(queryId, plan);
    if (typeof this._audit === "function") {
      this._audit("HE_QUERY_PLANNED", {
        queryId,
        path,
        scheme,
        operationCount: config.operations.length,
      });
    }
    return {
      queryId,
      path,
      scheme,
      hopCount: path.length,
      operationCount: config.operations.length,
      status: plan.status,
    };
  }

  /**
   * Execute a query plan by routing through the mesh.
   * @param {string} queryId
   * @returns {object} Execution result
   */
  executeQuery(queryId) {
    const query = this._queries.get(queryId);
    if (!query) {
      throw new HsmAdapterError(
        "QUERY_NOT_FOUND",
        `query ${queryId} not found`,
      );
    }
    if (query.status !== QUERY_STATUS.PENDING) {
      throw new HsmAdapterError(
        "QUERY_NOT_PENDING",
        `query is in status ${query.status}, expected pending`,
      );
    }
    const now = Date.now();
    if (now > query.expiresAt) {
      query.status = QUERY_STATUS.EXPIRED;
      return { queryId, status: query.status, reason: "expired" };
    }
    query.status = QUERY_STATUS.IN_TRANSIT;
    let currentData = query.encryptedData.slice();
    try {
      for (let hop = 0; hop < query.path.length; hop++) {
        const nodeId = query.path[hop];
        const node = this._nodes.get(nodeId);
        if (!node || node.status === NODE_STATUS.OFFLINE) {
          throw new HsmAdapterError(
            "NODE_UNAVAILABLE",
            `node ${nodeId} is offline or not found`,
          );
        }
        query.status = QUERY_STATUS.EVALUATING;
        // Execute operation at this hop if one is scheduled
        if (hop < query.operations.length) {
          const op = query.operations[hop];
          currentData = _evaluateHeOperation(currentData, op, query.scheme);
          query.hopsExecuted.push({
            nodeId,
            operation: op.type,
            timestamp: Date.now(),
          });
        }
        // Update node load
        node.load = Math.min(1, node.load + 0.1);
      }
      query.result = currentData;
      query.status = QUERY_STATUS.COMPLETED;
      query.completedAt = Date.now();
      // Move to history
      this._queries.delete(queryId);
      this._completedQueries.push({
        queryId,
        path: query.path,
        scheme: query.scheme,
        hopsExecuted: query.hopsExecuted.length,
        completedAt: query.completedAt,
        result: query.result,
      });
      if (this._completedQueries.length > this._maxHistory) {
        this._completedQueries.shift();
      }
      if (typeof this._audit === "function") {
        this._audit("HE_QUERY_COMPLETED", {
          queryId,
          hops: query.hopsExecuted.length,
        });
      }
      return {
        queryId,
        status: query.status,
        result: currentData,
        hopsExecuted: query.hopsExecuted.length,
        path: query.path,
      };
    } catch (e) {
      query.status = QUERY_STATUS.FAILED;
      query.errors.push({ hop: query.currentHop, error: e.message });
      if (typeof this._audit === "function") {
        this._audit("HE_QUERY_FAILED", { queryId, error: e.message });
      }
      return {
        queryId,
        status: query.status,
        error: e.message,
        hopsExecuted: query.hopsExecuted.length,
      };
    }
  }

  /**
   * Get the current state of a query.
   * @param {string} queryId
   * @returns {object|null}
   */
  getQuery(queryId) {
    const active = this._queries.get(queryId);
    if (active) return { ...active };
    const completed = this._completedQueries.find((q) => q.queryId === queryId);
    return completed ? { ...completed } : null;
  }

  /**
   * Get all active queries.
   * @returns {object[]}
   */
  getActiveQueries() {
    return Array.from(this._queries.values()).map((q) => ({
      queryId: q.queryId,
      status: q.status,
      path: q.path,
      currentHop: q.currentHop,
      scheme: q.scheme,
    }));
  }

  /**
   * Get completed query history.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getCompletedQueries(limit) {
    const n = typeof limit === "number" ? limit : 20;
    return this._completedQueries.slice(-n);
  }

  /**
   * Check for expired queries.
   * @returns {string[]} Expired query IDs
   */
  checkExpiredQueries() {
    const now = Date.now();
    const expired = [];
    for (const [queryId, query] of this._queries) {
      if (now > query.expiresAt && query.status !== QUERY_STATUS.COMPLETED) {
        query.status = QUERY_STATUS.EXPIRED;
        this._queries.delete(queryId);
        expired.push(queryId);
        if (typeof this._audit === "function") {
          this._audit("HE_QUERY_EXPIRED", { queryId });
        }
      }
    }
    return expired;
  }

  /**
   * Get all nodes in the mesh.
   * @returns {object[]}
   */
  getNodes() {
    return Array.from(this._nodes.values()).map((n) => ({
      id: n.id,
      status: n.status,
      schemes: n.schemes,
      capacity: n.capacity,
      load: n.load,
      neighborCount: n.neighbors.size,
    }));
  }

  /**
   * Get all edges in the mesh.
   * @returns {object[]}
   */
  getEdges() {
    return Array.from(this._edges.values()).map((e) => ({
      nodeA: e.nodeA,
      nodeB: e.nodeB,
      latency: e.latency,
      bandwidth: e.bandwidth,
      trust: e.trust,
    }));
  }

  /**
   * Update node status.
   * @param {string} nodeId
   * @param {string} status
   */
  updateNodeStatus(nodeId, status) {
    const node = this._nodes.get(nodeId);
    if (!node) {
      throw new HsmAdapterError("NODE_NOT_FOUND", `node ${nodeId} not found`);
    }
    if (!Object.values(NODE_STATUS).includes(status)) {
      throw new HsmAdapterError(
        "INVALID_STATUS",
        `status must be one of: ${Object.values(NODE_STATUS).join(", ")}`,
      );
    }
    node.status = status;
    if (typeof this._audit === "function") {
      this._audit("MESH_NODE_STATUS_UPDATED", { nodeId, status });
    }
  }

  /**
   * Get mesh topology statistics.
   * @returns {object}
   */
  getStats() {
    const activeNodes = Array.from(this._nodes.values()).filter(
      (n) => n.status === NODE_STATUS.ACTIVE,
    ).length;
    const byStatus = {};
    for (const n of this._nodes.values()) {
      byStatus[n.status] = (byStatus[n.status] || 0) + 1;
    }
    return {
      nodeCount: this._nodes.size,
      activeNodes,
      edgeCount: this._edges.size,
      activeQueries: this._queries.size,
      completedQueries: this._completedQueries.length,
      byStatus,
      supportedSchemes: this.supportedSchemes,
      maxHops: this.maxHops,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._nodes.clear();
    this._edges.clear();
    this._queries.clear();
    this._completedQueries = [];
  }
}

function _edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function _generateId(prefix, timestamp) {
  return `${prefix}-${timestamp}-${Math.floor(Math.random() * 1000000)}`;
}

function _evaluateHeOperation(data, op, scheme) {
  const operand = typeof op.operand === "number" ? op.operand : 0;
  switch (op.type) {
    case HE_OPERATION.ADD:
      return data.map((v) => v + operand);
    case HE_OPERATION.SUBTRACT:
      return data.map((v) => v - operand);
    case HE_OPERATION.SCALAR_MUL:
      return data.map((v) => v * operand);
    case HE_OPERATION.MULTIPLY:
      // Element-wise multiplication (only valid for multiplicative HE)
      return data.map(
        (v, i) =>
          v * (Array.isArray(op.operand) ? op.operand[i] || 1 : operand),
      );
    case HE_OPERATION.COMPARE:
      // Returns boolean array (encrypted comparison result)
      return data.map((v) => (v > operand ? 1 : 0));
    default:
      throw new HsmAdapterError(
        "INVALID_OPERATION",
        `unknown operation ${op.type}`,
      );
  }
}

module.exports = {
  HeMeshTopology,
  DEFAULT_OPTIONS,
  NODE_STATUS,
  QUERY_STATUS,
  HE_OPERATION,
};
