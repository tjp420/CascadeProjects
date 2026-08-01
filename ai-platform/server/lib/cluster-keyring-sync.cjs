'use strict';

const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const logger = require('./app-logger.cjs');
const keyRotationStore = require('./key-rotation-store.cjs');

const NODE_ID = process.env.NODE_ID || require('os').hostname() || 'node';
const CLUSTER_KEYRING_PORT = parseInt(process.env.CLUSTER_KEYRING_PORT, 10) || 7000;
const CLUSTER_NODES = (process.env.CLUSTER_NODES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    const [host, port] = entry.split(':');
    return { host, port: parseInt(port, 10) || CLUSTER_KEYRING_PORT };
  });

const HEARTBEAT_MS = parseInt(process.env.CLUSTER_HEARTBEAT_MS, 10) || 5000;
const HEARTBEAT_TIMEOUT_MS = parseInt(process.env.CLUSTER_HEARTBEAT_TIMEOUT_MS, 10) || 15000;
const MAX_FRAME_BYTES = 1 << 20; // 1 MB

const _sockets = new Map(); // peerKey -> tls/net socket
const _peerState = new Map(); // peerKey -> { lastSeen, leaderId, activeFingerprint, previousFingerprint, rotatedAt }
let _server = null;
let _heartbeatTimer = null;
let _electionTimer = null;
let _running = false;

// ── Event Timeline (Sync.com-style audit trail) ─────────────────────────────
//   Each event has: eventId, timestamp, eventType, node, details
//   Filterable by type, date range, and node — like Sync.com Events Log.
const EVENT_TYPES = {
  CLUSTER_FORMED: 'cluster_formed',
  LEADER_ELECTED: 'leader_elected',
  LEADER_FAILED: 'leader_failed',
  KEY_COMMIT: 'key_commit',
  KEY_REJECT: 'key_reject',
  NODE_JOIN: 'node_join',
  NODE_LEAVE: 'node_leave',
  SPLIT_BRAIN_DETECTED: 'split_brain_detected',
  GRACE_WINDOW_SYNCED: 'grace_window_synced',
};

const _events = [];
const MAX_EVENTS = 1000;

function _generateEventId() {
  return 'evt-' + crypto.randomBytes(4).toString('hex') + '-' + crypto.randomBytes(2).toString('hex');
}

function _recordEvent(eventType, node, details) {
  const event = {
    eventId: _generateEventId(),
    timestamp: new Date().toISOString(),
    eventType,
    node: node || NODE_ID,
    details: details || {},
  };
  _events.push(event);
  if (_events.length > MAX_EVENTS) {
    _events.splice(0, _events.length - MAX_EVENTS);
  }
  return event;
}

function queryEvents(filters) {
  filters = filters || {};
  const startTs = filters.startDate ? new Date(filters.startDate).getTime() : null;
  const endTs = filters.endDate ? new Date(filters.endDate).getTime() : null;
  let events = [..._events];
  if (filters.eventType) events = events.filter((e) => e.eventType === filters.eventType);
  if (filters.node) events = events.filter((e) => e.node === filters.node);
  if (startTs !== null) {
    events = events.filter((e) => new Date(e.timestamp).getTime() > startTs);
  }
  if (endTs !== null) {
    events = events.filter((e) => new Date(e.timestamp).getTime() < endTs);
  }
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const total = events.length;
  const limit = Math.min(filters.limit || 100, 500);
  const offset = Math.max(filters.offset || 0, 0);
  return { events: events.slice(offset, offset + limit), total, limit, offset };
}

function getEventStats() {
  const byType = {};
  const byNode = {};
  for (const e of _events) {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
    byNode[e.node] = (byNode[e.node] || 0) + 1;
  }
  return { total: _events.length, byType, byNode };
}

function _resetEvents() {
  _events.length = 0;
}

// Track last applied rotation for idempotency (L3-03)
let _lastAppliedRotatedAt = 0;

const _state = {
  nodeId: NODE_ID,
  leaderId: null,
  epoch: 0,
  activeFingerprint: null,
  previousFingerprint: null,
  rotatedAt: null,
};

function _log(level, message, extra = {}) {
  if (!logger || !logger[level]) return;
  logger[level](message, { sub: 'cluster-keyring', nodeId: NODE_ID, leaderId: _state.leaderId, epoch: _state.epoch, ...extra });
}

function _peerKey(host, port) {
  return `${host}:${port}`;
}

function _isSelf(host, port) {
  return port === CLUSTER_KEYRING_PORT;
}

function _frameMessage(payload) {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, 'utf8');
  if (body.length > MAX_FRAME_BYTES) {
    throw new Error('cluster message exceeds 1 MB');
  }
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, body]);
}

function _readFrames(socket, onMessage) {
  let buffer = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32BE(0);
      if (length > MAX_FRAME_BYTES) {
        _log('error', 'Oversized frame received; destroying socket', { peer: socket.remoteAddress });
        socket.destroy();
        return;
      }
      if (buffer.length < 4 + length) return;
      const body = buffer.slice(4, 4 + length);
      buffer = buffer.slice(4 + length);
      try {
        const msg = JSON.parse(body.toString('utf8'));
        onMessage(msg, socket);
      } catch (err) {
        _log('warn', 'Invalid JSON cluster frame', { error: err.message });
      }
    }
  });
}

function _sendMessage(socket, msg) {
  if (!socket || socket.destroyed) return false;
  try {
    socket.write(_frameMessage(msg));
    return true;
  } catch (err) {
    _log('warn', 'Failed to send cluster message', { error: err.message });
    return false;
  }
}

function _broadcast(msg) {
  for (const [key, socket] of _sockets.entries()) {
    if (!_sendMessage(socket, msg)) {
      _sockets.delete(key);
      _peerState.delete(key);
    }
  }
}

function _updateLocalKeyringState() {
  const status = keyRotationStore.getRotationStatus();
  _state.activeFingerprint = status.activeFingerprint;
  _state.previousFingerprint = status.previousFingerprint;
  _state.rotatedAt = status.rotatedAt;
}

function _electLeader() {
  const now = Date.now();
  const alive = [];
  for (const { host, port } of CLUSTER_NODES) {
    const key = _peerKey(host, port);
    const peer = _peerState.get(key);
    if (peer && now - peer.lastSeen < HEARTBEAT_TIMEOUT_MS) {
      alive.push(key);
    }
  }
  // Include self
  alive.push(_state.nodeId);

  const total = CLUSTER_NODES.length + 1;
  const majority = Math.floor(total / 2) + 1;
  if (alive.length < majority) {
    if (_state.leaderId !== null) {
      _log('warn', 'Lost quorum; stepping down', { alive: alive.length, majority });
      _recordEvent(EVENT_TYPES.SPLIT_BRAIN_DETECTED, _state.nodeId, {
        reachableCount: alive.length,
        required: majority,
        totalSize: total,
      });
      _state.leaderId = null;
      _state.epoch++;
    }
    return;
  }

  const all = new Set([...CLUSTER_NODES.map((n) => _peerKey(n.host, n.port)), _state.nodeId]);
  const candidates = Array.from(all)
    .filter((id) => id === _state.nodeId || _peerState.get(id) && now - _peerState.get(id).lastSeen < HEARTBEAT_TIMEOUT_MS)
    .sort();

  const newLeader = candidates[0] || null;
  if (newLeader !== _state.leaderId) {
    if (_state.leaderId) {
      _recordEvent(EVENT_TYPES.LEADER_FAILED, _state.nodeId, {
        previousLeader: _state.leaderId,
        reason: 'unreachable',
      });
    }
    _state.leaderId = newLeader;
    _state.epoch++;
    _recordEvent(EVENT_TYPES.LEADER_ELECTED, _state.nodeId, {
      leader: newLeader,
      epoch: _state.epoch,
      reachableCount: alive.length,
      majority,
    });
    _log('info', 'Leader changed', { newLeader, previousLeader: _state.leaderId, candidates });
  }
}

function _handleMessage(msg, socket) {
  if (!msg || !msg.type) return;
  const peerKey = _peerKey(socket.remoteAddress, socket.remotePort);

  if (msg.type === 'ANNOUNCE') {
    _peerState.set(peerKey, { lastSeen: Date.now(), nodeId: msg.nodeId });
    _sendMessage(socket, { type: 'ANNOUNCE_ACK', from: NODE_ID, leaderId: _state.leaderId, epoch: _state.epoch });
    return;
  }

  if (msg.type === 'HEARTBEAT' || msg.type === 'KEY_COMMIT') {
    const peer = _peerState.get(peerKey) || {};
    peer.lastSeen = Date.now();
    peer.leaderId = msg.leaderId;
    peer.activeFingerprint = msg.activeFingerprint;
    peer.previousFingerprint = msg.previousFingerprint;
    peer.rotatedAt = msg.rotatedAt;
    _peerState.set(peerKey, peer);

    if (msg.type === 'KEY_COMMIT') {
      try {
        if (msg.activeHex) {
          keyRotationStore.applyKeyringCommit(
            msg.activeHex,
            msg.previousHex || null,
            msg.rotatedAt,
            msg.graceMs || null,
          );
          _updateLocalKeyringState();
          _log('info', 'Applied keyring commit from leader', { leaderId: msg.from, activeFingerprint: msg.activeFingerprint });
        }
      } catch (err) {
        _log('error', 'Failed to apply keyring commit', { error: err.message });
      }
      _sendMessage(socket, { type: 'KEY_COMMIT_ACK', from: NODE_ID, epoch: _state.epoch });
    }
    return;
  }

  if (msg.type === 'PING') {
    _sendMessage(socket, { type: 'PONG', from: NODE_ID, epoch: _state.epoch });
  }
}

function _connectToPeer(host, port) {
  const key = _peerKey(host, port);
  if (_sockets.has(key)) return;

  const isTls = !!(process.env.CLUSTER_CERT && process.env.CLUSTER_KEY);
  const onConnect = (socket) => {
    _sockets.set(key, socket);
    _sendMessage(socket, { type: 'ANNOUNCE', nodeId: NODE_ID, epoch: _state.epoch });
    _updateLocalKeyringState();
    _sendMessage(socket, {
      type: 'HEARTBEAT',
      from: NODE_ID,
      leaderId: _state.leaderId,
      epoch: _state.epoch,
      activeFingerprint: _state.activeFingerprint,
      previousFingerprint: _state.previousFingerprint,
      rotatedAt: _state.rotatedAt,
    });
    _readFrames(socket, _handleMessage);
    socket.on('close', () => { _sockets.delete(key); _peerState.delete(key); });
    socket.on('error', (err) => { _log('warn', 'Peer socket error', { peer: key, error: err.message }); });
  };

  if (isTls) {
    const socket = tls.connect(port, host, {
      cert: fs.readFileSync(process.env.CLUSTER_CERT),
      key: fs.readFileSync(process.env.CLUSTER_KEY),
      ca: process.env.CLUSTER_CA_CERT ? fs.readFileSync(process.env.CLUSTER_CA_CERT) : undefined,
      rejectUnauthorized: false,
    }, () => onConnect(socket));
    socket.on('error', (err) => _log('warn', 'TLS peer connect error', { peer: key, error: err.message }));
  } else {
    const socket = net.createConnection({ host, port }, () => onConnect(socket));
    socket.on('error', (err) => _log('warn', 'TCP peer connect error', { peer: key, error: err.message }));
  }
}

function _startServer() {
  if (_server) return;
  const isTls = !!(process.env.CLUSTER_CERT && process.env.CLUSTER_KEY);
  const onConnection = (socket) => {
    _readFrames(socket, _handleMessage);
    socket.on('error', (err) => _log('warn', 'Server socket error', { error: err.message }));
    socket.on('close', () => _log('debug', 'Server socket closed'));
  };

  if (isTls) {
    _server = tls.createServer({
      cert: fs.readFileSync(process.env.CLUSTER_CERT),
      key: fs.readFileSync(process.env.CLUSTER_KEY),
      ca: process.env.CLUSTER_CA_CERT ? fs.readFileSync(process.env.CLUSTER_CA_CERT) : undefined,
      requestCert: false,
      rejectUnauthorized: false,
    }, onConnection);
  } else {
    _server = net.createServer(onConnection);
  }

  _server.listen(CLUSTER_KEYRING_PORT, () => {
    _log('info', 'Cluster keyring server listening', { port: CLUSTER_KEYRING_PORT, tls: isTls });
  });
  _server.on('error', (err) => _log('error', 'Cluster server error', { error: err.message }));
}

function _startHeartbeat() {
  if (_heartbeatTimer) return;
  _heartbeatTimer = setInterval(() => {
    if (!_running) return;
    _electLeader();
    _updateLocalKeyringState();
    _broadcast({
      type: 'HEARTBEAT',
      from: NODE_ID,
      leaderId: _state.leaderId,
      epoch: _state.epoch,
      activeFingerprint: _state.activeFingerprint,
      previousFingerprint: _state.previousFingerprint,
      rotatedAt: _state.rotatedAt,
    });
  }, HEARTBEAT_MS);
}

function _startElectionWatch() {
  if (_electionTimer) return;
  _electionTimer = setInterval(() => {
    if (!_running) return;
    _electLeader();
    for (const { host, port } of CLUSTER_NODES) {
      if (!_sockets.has(_peerKey(host, port))) {
        _connectToPeer(host, port);
      }
    }
  }, HEARTBEAT_MS);
}

function init() {
  if (_running) return;
  if (CLUSTER_NODES.length === 0) {
    _log('info', 'Cluster keyring sync disabled; no CLUSTER_NODES set');
    return;
  }
  _running = true;
  _startServer();
  for (const { host, port } of CLUSTER_NODES) {
    _connectToPeer(host, port);
  }
  _startElectionWatch();
  _startHeartbeat();
  _log('info', 'Cluster keyring sync initialized', { nodes: CLUSTER_NODES });
}

function shutdown() {
  _running = false;
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_electionTimer) { clearInterval(_electionTimer); _electionTimer = null; }
  for (const [key, socket] of _sockets.entries()) {
    socket.destroy();
    _sockets.delete(key);
  }
  if (_server) { _server.close(); _server = null; }
  _log('info', 'Cluster keyring sync shutdown');
}

function isLeader() {
  _electLeader();
  return _state.leaderId === _state.nodeId;
}

function getStatus() {
  _electLeader();
  _updateLocalKeyringState();
  return {
    nodeId: _state.nodeId,
    leaderId: _state.leaderId,
    isLeader: _state.leaderId === _state.nodeId,
    epoch: _state.epoch,
    activeFingerprint: _state.activeFingerprint,
    previousFingerprint: _state.previousFingerprint,
    rotatedAt: _state.rotatedAt,
    members: CLUSTER_NODES.map((n) => {
      const key = _peerKey(n.host, n.port);
      const peer = _peerState.get(key);
      return {
        peer: key,
        lastSeen: peer ? peer.lastSeen : null,
        reachable: peer ? (Date.now() - peer.lastSeen < HEARTBEAT_TIMEOUT_MS) : false,
      };
    }),
  };
}

function proposeRotate(newKeyRaw, graceMs) {
  if (!isLeader()) {
    const err = new Error('not_leader');
    err.statusCode = 423;
    throw err;
  }

  const result = keyRotationStore.rotateKey(newKeyRaw, graceMs);
  _updateLocalKeyringState();
  _state.epoch++;

  _broadcast({
    type: 'KEY_COMMIT',
    from: NODE_ID,
    leaderId: _state.nodeId,
    epoch: _state.epoch,
    activeHex: result.activeHex,
    previousHex: result.previousHex,
    activeFingerprint: _state.activeFingerprint,
    previousFingerprint: _state.previousFingerprint,
    rotatedAt: _state.rotatedAt,
    graceMs: graceMs || null,
  });

  _recordEvent(EVENT_TYPES.KEY_COMMIT, _state.nodeId, {
    activeFingerprint: _state.activeFingerprint,
    previousFingerprint: _state.previousFingerprint,
    rotatedAt: _state.rotatedAt,
    graceMs: graceMs || null,
    epoch: _state.epoch,
  });
  _log('info', 'Proposed cluster key rotation', { activeFingerprint: _state.activeFingerprint });
  return getStatus();
}

module.exports = {
  init,
  shutdown,
  isLeader,
  getStatus,
  proposeRotate,
  queryEvents,
  getEventStats,
  EVENT_TYPES,
  // Test helpers
  _resetEvents,
  _recordEvent,
};
