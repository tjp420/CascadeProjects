'use strict';

/**
 * Track 38: Encrypted P2P Routing.
 *
 * Manages secure multi-node communication topologies with encrypted
 * peer-to-peer routing. Builds and maintains a route table with
 * multi-hop paths, encrypts messages with per-hop layers (onion-style),
 * supports relay nodes for indirect communication, and provides route
 * discovery via BFS shortest-path selection.
 *
 * Components:
 *   - RouteTable: adjacency-list graph with BFS shortest-path discovery
 *   - OnionEncryption: per-hop encryption layers
 *   - Route state machine: DISCOVERY → ESTABLISHED → ENCRYPTING →
 *     RELAYING (with REVOKED terminal)
 *   - Anti-replay: nonce + timestamp validation
 *   - Peer discovery: dynamic join/leave
 *   - Route revocation: blacklist compromised peers
 *
 * @module hsm-adapter/encrypted-p2p-routing-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

// ── Route states ─────────────────────────────────────────────────
const ROUTE_STATE = {
  DISCOVERY: 'discovery',
  ESTABLISHED: 'established',
  ENCRYPTING: 'encrypting',
  RELAYING: 'relaying',
  DELIVERED: 'delivered',
  REVOKED: 'revoked',
};

// ── Valid state transitions ──────────────────────────────────────
const VALID_TRANSITIONS = {
  [ROUTE_STATE.DISCOVERY]: [ROUTE_STATE.ESTABLISHED, ROUTE_STATE.REVOKED],
  [ROUTE_STATE.ESTABLISHED]: [ROUTE_STATE.ENCRYPTING, ROUTE_STATE.REVOKED],
  [ROUTE_STATE.ENCRYPTING]: [ROUTE_STATE.RELAYING, ROUTE_STATE.REVOKED],
  [ROUTE_STATE.RELAYING]: [ROUTE_STATE.DELIVERED, ROUTE_STATE.REVOKED],
  [ROUTE_STATE.DELIVERED]: [],
  [ROUTE_STATE.REVOKED]: [],
};

/**
 * RouteTable — adjacency-list graph of peer connections.
 *
 * Maintains the network topology and provides BFS shortest-path
 * discovery between any two nodes.
 */
class RouteTable {
  constructor() {
    this._adjacency = new Map(); // nodeId -> Set<nodeId>
    this._blacklisted = new Set(); // revoked node IDs
  }

  /**
   * Add a peer to the topology.
   * @param {string} nodeId
   */
  addPeer(nodeId) {
    if (!this._adjacency.has(nodeId)) {
      this._adjacency.set(nodeId, new Set());
    }
  }

  /**
   * Remove a peer from the topology.
   * @param {string} nodeId
   */
  removePeer(nodeId) {
    this._adjacency.delete(nodeId);
    for (const [, neighbors] of this._adjacency) {
      neighbors.delete(nodeId);
    }
  }

  /**
   * Add a bidirectional edge between two peers.
   * @param {string} nodeA
   * @param {string} nodeB
   */
  addEdge(nodeA, nodeB) {
    this.addPeer(nodeA);
    this.addPeer(nodeB);
    this._adjacency.get(nodeA).add(nodeB);
    this._adjacency.get(nodeB).add(nodeA);
  }

  /**
   * Remove an edge between two peers.
   * @param {string} nodeA
   * @param {string} nodeB
   */
  removeEdge(nodeA, nodeB) {
    if (this._adjacency.has(nodeA)) this._adjacency.get(nodeA).delete(nodeB);
    if (this._adjacency.has(nodeB)) this._adjacency.get(nodeB).delete(nodeA);
  }

  /**
   * Blacklist a peer (revoke from routing).
   * @param {string} nodeId
   */
  blacklist(nodeId) {
    this._blacklisted.add(nodeId);
    this.removePeer(nodeId);
  }

  /**
   * Check if a peer is blacklisted.
   * @param {string} nodeId
   * @returns {boolean}
   */
  isBlacklisted(nodeId) {
    return this._blacklisted.has(nodeId);
  }

  /**
   * Get all peers in the topology.
   * @returns {string[]}
   */
  getPeers() {
    return Array.from(this._adjacency.keys());
  }

  /**
   * Get neighbors of a peer.
   * @param {string} nodeId
   * @returns {string[]}
   */
  getNeighbors(nodeId) {
    const neighbors = this._adjacency.get(nodeId);
    return neighbors ? Array.from(neighbors) : [];
  }

  /**
   * Find shortest path via BFS.
   * @param {string} source
   * @param {string} destination
   * @returns {string[]|null} array of node IDs from source to destination, or null
   */
  findRoute(source, destination) {
    if (!this._adjacency.has(source)) return null;
    if (!this._adjacency.has(destination)) return null;
    if (this._blacklisted.has(source) || this._blacklisted.has(destination)) return null;
    if (source === destination) return [source];

    const queue = [[source]];
    const visited = new Set([source]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      const neighbors = this._adjacency.get(current) || new Set();

      for (const neighbor of neighbors) {
        if (this._blacklisted.has(neighbor)) continue;
        if (visited.has(neighbor)) continue;

        const newPath = [...path, neighbor];
        if (neighbor === destination) {
          return newPath;
        }
        visited.add(neighbor);
        queue.push(newPath);
      }
    }
    return null;
  }

  /**
   * Get the number of peers in the topology.
   * @returns {number}
   */
  size() {
    return this._adjacency.size;
  }
}

/**
 * OnionEncryption — per-hop encryption layers.
 *
 * Wraps a message with encryption layers, one per relay node.
 * Each relay node can only decrypt its layer to find the next hop.
 */
class OnionEncryption {
  /**
   * Encrypt a message with per-hop layers.
   * @param {string} message
   * @param {string[]} route — array of node IDs from source to destination
   * @param {Map<string, string>} peerKeys — nodeId -> shared encryption key (hex)
   * @returns {object} onion bundle
   */
  static encrypt(message, route, peerKeys) {
    if (!Array.isArray(route) || route.length < 2) {
      throw new HsmAdapterError('INVALID_INPUT', 'route must have at least 2 nodes');
    }

    // Start with the innermost payload (the actual message)
    let payload = Buffer.from(message, 'utf8');
    const layers = []; // encrypted layers from innermost to outermost

    // Encrypt from destination back to source
    for (let i = route.length - 1; i >= 1; i--) {
      const hopId = route[i];
      const key = peerKeys.get(hopId);
      if (!key) {
        throw new HsmAdapterError('PEER_KEY_MISSING', `no encryption key for peer ${hopId}`);
      }

      // Create the hop payload: next hop + encrypted payload
      const nextHop = i < route.length - 1 ? route[i + 1] : null;
      const hopData = {
        nextHop,
        payload: payload.toString('hex'),
      };
      const hopDataStr = JSON.stringify(hopData);

      // Encrypt with AES-256-GCM
      const keyBuf = Buffer.from(key, 'hex');
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
      const encrypted = Buffer.concat([cipher.update(hopDataStr, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const layer = {
        iv: iv.toString('hex'),
        encrypted: encrypted.toString('hex'),
        authTag: authTag.toString('hex'),
      };
      layers.unshift(layer);
      payload = Buffer.from(JSON.stringify(layer), 'utf8');
    }

    return {
      route: [...route],
      layers,
      source: route[0],
      destination: route[route.length - 1],
      messageHash: crypto.createHash('sha256').update(message).digest('hex'),
    };
  }

  /**
   * Decrypt one layer of the onion at a relay node.
   * @param {object} onionBundle
   * @param {string} nodeId — the relay node doing the decryption
   * @param {string} key — shared encryption key (hex)
   * @returns {object} { nextHop, remainingPayload, isFinal }
   */
  static decryptLayer(onionBundle, nodeId, key) {
    if (!onionBundle || !Array.isArray(onionBundle.layers) || onionBundle.layers.length === 0) {
      throw new HsmAdapterError('INVALID_ONION', 'onion bundle has no layers');
    }

    const layer = onionBundle.layers[0];
    const keyBuf = Buffer.from(key, 'hex');
    const iv = Buffer.from(layer.iv, 'hex');
    const encrypted = Buffer.from(layer.encrypted, 'hex');
    const authTag = Buffer.from(layer.authTag, 'hex');

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      const hopData = JSON.parse(decrypted.toString('utf8'));

      return {
        nextHop: hopData.nextHop,
        remainingPayload: hopData.payload,
        isFinal: hopData.nextHop === null,
      };
    } catch (err) {
      throw new HsmAdapterError('ONION_DECRYPT_FAILED', `decryption failed at node ${nodeId}: ${err.message}`);
    }
  }
}

/**
 * EncryptedP2PRoutingEngine.
 *
 * Manages the full lifecycle of encrypted P2P routing with
 * route discovery, onion encryption, anti-replay, and revocation.
 */
class EncryptedP2PRoutingEngine {
  /**
   * @param {object} options
   * @param {string} options.localNodeId
   * @param {number} [options.maxHopCount] — max hops per route
   * @param {number} [options.replayWindowMs] — max age of messages
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    if (!options.localNodeId) {
      throw new HsmAdapterError('INVALID_INPUT', 'localNodeId is required');
    }
    this.localNodeId = options.localNodeId;
    this.maxHopCount = options.maxHopCount || 16;
    this.replayWindowMs = options.replayWindowMs || 30000;
    this._audit = options.audit || null;

    this._routeTable = new RouteTable();
    this._peerKeys = new Map(); // nodeId -> shared key (hex)
    this._seenNonces = new Map(); // nonce -> timestamp
    this._routeStates = new Map(); // routeId -> state
    this._routeInfoCache = new Map(); // routeId -> { route }
    this._nextRouteId = 1;
  }

  /**
   * Add a peer to the topology.
   * @param {string} nodeId
   * @param {string} [sharedKey] — hex-encoded AES-256 key
   */
  addPeer(nodeId, sharedKey) {
    this._routeTable.addPeer(nodeId);
    if (sharedKey) {
      this._peerKeys.set(nodeId, sharedKey);
    }
    this._emitAudit('PEER_ADDED', { nodeId });
  }

  /**
   * Add a bidirectional edge between two peers.
   * @param {string} nodeA
   * @param {string} nodeB
   */
  addEdge(nodeA, nodeB) {
    this._routeTable.addEdge(nodeA, nodeB);
    this._emitAudit('EDGE_ADDED', { nodeA, nodeB });
  }

  /**
   * Remove a peer from the topology.
   * @param {string} nodeId
   */
  removePeer(nodeId) {
    this._routeTable.removePeer(nodeId);
    this._peerKeys.delete(nodeId);
    this._emitAudit('PEER_REMOVED', { nodeId });
  }

  /**
   * Blacklist a peer (revoke from routing).
   * @param {string} nodeId
   * @param {string} [reason]
   */
  blacklistPeer(nodeId, reason = 'manual') {
    this._routeTable.blacklist(nodeId);
    this._peerKeys.delete(nodeId);
    this._emitAudit('PEER_BLACKLISTED', { nodeId, reason });
  }

  /**
   * Discover a route to a destination via BFS.
   * @param {string} destination
   * @returns {object} route discovery result
   */
  discoverRoute(destination) {
    const route = this._routeTable.findRoute(this.localNodeId, destination);
    if (!route) {
      throw new HsmAdapterError('ROUTE_NOT_FOUND', `no route from ${this.localNodeId} to ${destination}`);
    }
    if (route.length > this.maxHopCount) {
      throw new HsmAdapterError('ROUTE_TOO_LONG', `route has ${route.length} hops, max is ${this.maxHopCount}`);
    }

    const routeId = `route-${this._nextRouteId}`;
    this._nextRouteId++;
    this._routeStates.set(routeId, ROUTE_STATE.DISCOVERY);
    this._routeInfoCache.set(routeId, { route });

    this._emitAudit('ROUTE_DISCOVERED', { routeId, route, hopCount: route.length });
    return { routeId, route, hopCount: route.length, state: ROUTE_STATE.DISCOVERY };
  }

  /**
   * Establish a route (transition from DISCOVERY to ESTABLISHED).
   * @param {string} routeId
   */
  establishRoute(routeId) {
    const route = this._getRoute(routeId);
    this._transition(routeId, ROUTE_STATE.ESTABLISHED);
    this._emitAudit('ROUTE_ESTABLISHED', { routeId });
    return { routeId, state: ROUTE_STATE.ESTABLISHED };
  }

  /**
   * Encrypt a message for the route (transition to ENCRYPTING).
   * @param {string} routeId
   * @param {string} message
   * @returns {object} onion bundle
   */
  encryptMessage(routeId, message) {
    const routeState = this._routeStates.get(routeId);
    if (routeState !== ROUTE_STATE.ESTABLISHED) {
      throw new HsmAdapterError('ROUTE_NOT_ESTABLISHED', `route ${routeId} must be established, got ${routeState}`);
    }

    // Get the route path from the discovery
    const routeInfo = this._getRouteInfo(routeId);
    const onionBundle = OnionEncryption.encrypt(message, routeInfo.route, this._peerKeys);

    // Add anti-replay nonce
    onionBundle.nonce = crypto.randomBytes(16).toString('hex');
    onionBundle.timestamp = Date.now();
    onionBundle.routeId = routeId;

    this._transition(routeId, ROUTE_STATE.ENCRYPTING);
    this._emitAudit('MESSAGE_ENCRYPTED', { routeId, messageHash: onionBundle.messageHash });
    return onionBundle;
  }

  /**
   * Relay an encrypted message along the route (transition to RELAYING).
   * @param {object} onionBundle
   * @returns {object} relay result
   */
  relayMessage(onionBundle) {
    const routeId = onionBundle.routeId;
    const routeState = this._routeStates.get(routeId);
    if (routeState !== ROUTE_STATE.ENCRYPTING) {
      throw new HsmAdapterError('ROUTE_NOT_ENCRYPTED', `route ${routeId} must be in encrypting state, got ${routeState}`);
    }

    // Anti-replay check
    this._validateReplay(onionBundle);

    this._transition(routeId, ROUTE_STATE.RELAYING);
    this._emitAudit('MESSAGE_RELAYING', { routeId, nonce: onionBundle.nonce });
    return { routeId, state: ROUTE_STATE.RELAYING, hopCount: onionBundle.route.length - 1 };
  }

  /**
   * Decrypt a layer at a relay node.
   * @param {object} onionBundle
   * @param {string} nodeId
   * @returns {object} decryption result
   */
  decryptAtRelay(onionBundle, nodeId) {
    const key = this._peerKeys.get(nodeId);
    if (!key) {
      throw new HsmAdapterError('PEER_KEY_MISSING', `no key for relay node ${nodeId}`);
    }

    const result = OnionEncryption.decryptLayer(onionBundle, nodeId, key);
    this._emitAudit('LAYER_DECRYPTED', { nodeId, nextHop: result.nextHop, isFinal: result.isFinal });
    return result;
  }

  /**
   * Mark a message as delivered (transition to DELIVERED).
   * @param {string} routeId
   */
  markDelivered(routeId) {
    const routeState = this._routeStates.get(routeId);
    if (routeState !== ROUTE_STATE.RELAYING) {
      throw new HsmAdapterError('ROUTE_NOT_RELAYING', `route ${routeId} must be relaying, got ${routeState}`);
    }
    this._transition(routeId, ROUTE_STATE.DELIVERED);
    this._emitAudit('MESSAGE_DELIVERED', { routeId });
    return { routeId, state: ROUTE_STATE.DELIVERED };
  }

  /**
   * Revoke a route.
   * @param {string} routeId
   * @param {string} [reason]
   */
  revokeRoute(routeId, reason = 'manual') {
    const routeState = this._routeStates.get(routeId);
    if (!routeState) {
      throw new HsmAdapterError('ROUTE_NOT_FOUND', `route ${routeId} not found`);
    }
    if (routeState === ROUTE_STATE.DELIVERED) {
      throw new HsmAdapterError('ROUTE_ALREADY_DELIVERED', `route ${routeId} already delivered`);
    }
    if (routeState === ROUTE_STATE.REVOKED) {
      throw new HsmAdapterError('ROUTE_ALREADY_REVOKED', `route ${routeId} already revoked`);
    }
    this._transition(routeId, ROUTE_STATE.REVOKED);
    this._emitAudit('ROUTE_REVOKED', { routeId, reason });
    return { routeId, state: ROUTE_STATE.REVOKED, reason };
  }

  /**
   * Get the state of a route.
   * @param {string} routeId
   * @returns {object}
   */
  getRouteState(routeId) {
    const state = this._routeStates.get(routeId);
    if (!state) {
      throw new HsmAdapterError('ROUTE_NOT_FOUND', `route ${routeId} not found`);
    }
    return { routeId, state };
  }

  /**
   * Get the route table.
   * @returns {RouteTable}
   */
  getRouteTable() {
    return this._routeTable;
  }

  /**
   * Get engine telemetry.
   * @returns {object}
   */
  getEngineState() {
    return {
      localNodeId: this.localNodeId,
      peerCount: this._routeTable.size(),
      activeRoutes: Array.from(this._routeStates.values()).filter(
        (s) => s !== ROUTE_STATE.DELIVERED && s !== ROUTE_STATE.REVOKED,
      ).length,
      blacklistedCount: this._routeTable._blacklisted.size,
    };
  }

  /**
   * Get a route ID or throw.
   * @param {string} routeId
   * @returns {string}
   */
  _getRoute(routeId) {
    if (!this._routeStates.has(routeId)) {
      throw new HsmAdapterError('ROUTE_NOT_FOUND', `route ${routeId} not found`);
    }
    return routeId;
  }

  /**
   * Get route info (the path) for a route ID.
   * @param {string} routeId
   * @returns {object}
   */
  _getRouteInfo(routeId) {
    const info = this._routeInfoCache.get(routeId);
    if (!info) {
      throw new HsmAdapterError('ROUTE_NOT_FOUND', `route info for ${routeId} not found`);
    }
    return info;
  }

  /**
   * Validate anti-replay (nonce + timestamp).
   * @param {object} onionBundle
   */
  _validateReplay(onionBundle) {
    if (!onionBundle.nonce) {
      throw new HsmAdapterError('REPLAY_MISSING_NONCE', 'message has no nonce');
    }
    if (this._seenNonces.has(onionBundle.nonce)) {
      throw new HsmAdapterError('REPLAY_DETECTED', `nonce ${onionBundle.nonce} already seen`);
    }
    if (onionBundle.timestamp) {
      const age = Date.now() - onionBundle.timestamp;
      if (age > this.replayWindowMs) {
        throw new HsmAdapterError('REPLAY_TIMESTAMP_EXPIRED', `message age ${age}ms exceeds window ${this.replayWindowMs}ms`);
      }
    }
    this._seenNonces.set(onionBundle.nonce, Date.now());
  }

  /**
   * Transition a route to a new state.
   * @param {string} routeId
   * @param {string} newState
   */
  _transition(routeId, newState) {
    const currentState = this._routeStates.get(routeId);
    const allowed = VALID_TRANSITIONS[currentState] || [];
    if (!allowed.includes(newState)) {
      throw new HsmAdapterError(
        'ROUTE_INVALID_TRANSITION',
        `cannot transition route ${routeId} from ${currentState} to ${newState}`,
      );
    }
    this._routeStates.set(routeId, newState);
  }

  _emitAudit(event, data) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...data });
  }
}

module.exports = {
  EncryptedP2PRoutingEngine,
  RouteTable,
  OnionEncryption,
  ROUTE_STATE,
  VALID_TRANSITIONS,
};
