'use strict';

const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const logger = require('./app-logger.cjs');
const keyRotationStore = require('./key-rotation-store.cjs');
const hybridKem = require('./hybrid-kem-handshake.cjs');
const resumption = require('./hybrid-kem-resumption.cjs');
const { ClusterKeyringPrimitiveAuthorization } = require('./hsm-adapter/cluster-keyring-primitive-authorization.cjs');
const { CryptoPolicyEngine } = require('./hsm-adapter/crypto-policy-engine.cjs');

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

// DKG transcript gossip message types and leader-only types
const DKG_MESSAGE_TYPES = new Set(['DKG_COMMIT', 'DKG_SHARE', 'DKG_COMPLAINT', 'DKG_DISQUALIFY', 'DKG_FINALIZE']);
const DKG_LEADER_ONLY_TYPES = new Set(['DKG_DISQUALIFY', 'DKG_FINALIZE']);

const _sockets = new Map(); // peerKey -> tls/net socket
const _peerState = new Map(); // peerKey -> { lastSeen, leaderId, activeFingerprint, previousFingerprint, rotatedAt }
let _server = null;
let _heartbeatTimer = null;
let _electionTimer = null;
let _running = false;
let _primitiveAuth = null;

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
  HSM_TIMEOUT: 'hsm_timeout',
  ISOLATION_VIOLATION: 'isolation_violation',
  QUANTUM_DEGRADE: 'quantum_downgrade',
  QUANTUM_DEGRADE_REJECTED: 'quantum_downgrade_rejected',
  QUANTUM_ROLLBACK: 'quantum_hybrid_rollback',
  BACKUP_PRUNED: 'BACKUP_PRUNED',
  BACKUP_IMMUTABLE: 'BACKUP_IMMUTABLE',
  STEK_ROTATED: 'STEK_ROTATED',
  AUDIT_PERSISTENCE_FAILURE: 'AUDIT_PERSISTENCE_FAILURE',
  RESUMPTION_TICKET_ISSUED: 'RESUMPTION_TICKET_ISSUED',
  TELEMETRY_SATURATION: 'TELEMETRY_SATURATION',
  AUDIT_QUERY_THROTTLED: 'AUDIT_QUERY_THROTTLED',
  PRIMITIVE_POOL_AUTHORIZED: 'primitive_pool_authorized',
  PRIMITIVE_POOL_SYNCED: 'primitive_pool_synced',
  PRIMITIVE_AUTHORIZATION_REVOKED: 'primitive_authorization_revoked',
  // DKG transcript gossip events
  DKG_SESSION_STARTED: 'dkg_session_started',
  DKG_COMMIT_RECEIVED: 'dkg_commit_received',
  DKG_SHARE_RECEIVED: 'dkg_share_received',
  DKG_SHARE_REJECTED: 'dkg_share_rejected',
  DKG_COMPLAINT_FILED: 'dkg_complaint_filed',
  DKG_NODE_DISQUALIFIED: 'dkg_node_disqualified',
  DKG_SESSION_COMPLETED: 'dkg_session_completed',
  DKG_SESSION_TIMEOUT: 'dkg_session_timeout',
  DKG_INVALID_MESSAGE: 'dkg_invalid_message',
  // Epoch-frame verification events
  EPOCH_STALE: 'epoch_stale',
  EPOCH_DRIFT: 'epoch_drift',
  EPOCH_RECONCILED: 'epoch_reconciled',
  // SIEM alert events
  SIEM_ALERT: 'siem_alert',
};

const _events = [];
const _eventsById = new Map();
const _indexByType = {};
const _indexByNode = {};
const MAX_EVENTS = 1000;

function _generateEventId() {
  return 'evt-' + crypto.randomBytes(4).toString('hex') + '-' + crypto.randomBytes(2).toString('hex');
}

function _updateIndexes(event) {
  _eventsById.set(event.eventId, event);
  (_indexByType[event.eventType] || (_indexByType[event.eventType] = [])).push(event.eventId);
  (_indexByNode[event.node] || (_indexByNode[event.node] = [])).push(event.eventId);
}

function _removeFromIndexes(event) {
  _eventsById.delete(event.eventId);
  const typeArr = _indexByType[event.eventType];
  if (typeArr) {
    const i = typeArr.indexOf(event.eventId);
    if (i !== -1) typeArr.splice(i, 1);
  }
  const nodeArr = _indexByNode[event.node];
  if (nodeArr) {
    const i = nodeArr.indexOf(event.eventId);
    if (i !== -1) nodeArr.splice(i, 1);
  }
}

function _recordEvent(eventType, node, details) {
  // Invoke SIEM hooks for high-severity events
  if (SIEM_EVENT_TYPES && SIEM_EVENT_TYPES.has(eventType)) {
    _invokeSiemHooks(eventType, node, details);
  }
  const event = {
    eventId: _generateEventId(),
    timestamp: new Date().toISOString(),
    eventType,
    node: node || NODE_ID,
    details: details || {},
  };
  _events.push(event);
  _updateIndexes(event);
  if (_events.length > MAX_EVENTS) {
    const drop = _events.length - MAX_EVENTS;
    const dropped = _events.splice(0, drop);
    for (const e of dropped) _removeFromIndexes(e);
    if (eventType !== EVENT_TYPES.TELEMETRY_SATURATION && drop > 0) {
      _recordEvent(EVENT_TYPES.TELEMETRY_SATURATION, NODE_ID, { dropped: drop, max: MAX_EVENTS });
    }
  }
  return event;
}

/**
 * Public telemetry entry point for other subsystems (rollout, backup, audit).
 * Records an event into the unified chronological timeline.
 * @param {string} eventType
 * @param {string} [node]
 * @param {object} [details]
 * @returns {{ eventId: string, timestamp: string }}
 */
function recordTelemetry(eventType, node, details) {
  return _recordEvent(eventType, node, details);
}

const AUDIT_QUERY_MAX_ROWS = parseInt(process.env.AUDIT_QUERY_MAX_ROWS, 10) || 1000;

function queryEvents(filters) {
  filters = filters || {};
  let startTs = filters.startDate ? new Date(filters.startDate).getTime() : null;
  let endTs = filters.endDate ? new Date(filters.endDate).getTime() : null;

  // L3-02 / S-03: unbounded queries are automatically bounded to the last 24h
  // to prevent memory exhaustion. The caller can still request broader windows
  // by providing startDate/endDate, or narrow by eventType.
  const hasExplicitBound = startTs !== null || endTs !== null || !!filters.eventType;
  if (!hasExplicitBound) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    startTs = oneDayAgo;
    endTs = null; // up to now
  }

  // Use secondary indexes to avoid full linear scans.
  let candidateIds;
  if (filters.eventType && filters.node) {
    const typeIds = _indexByType[filters.eventType] || [];
    const nodeIds = _indexByNode[filters.node] || [];
    const nodeSet = new Set(nodeIds);
    candidateIds = typeIds.filter((id) => nodeSet.has(id));
  } else if (filters.eventType) {
    candidateIds = _indexByType[filters.eventType] || [];
  } else if (filters.node) {
    candidateIds = _indexByNode[filters.node] || [];
  } else {
    // Fallback: the events array is ordered chronologically ascending, which is
    // already sufficient for short time windows and small MAX_EVENTS values.
    candidateIds = _events.map((e) => e.eventId);
  }

  let events = candidateIds.map((id) => _eventsById.get(id)).filter(Boolean);
  if (startTs !== null) {
    events = events.filter((e) => new Date(e.timestamp).getTime() > startTs);
  }
  if (endTs !== null) {
    events = events.filter((e) => new Date(e.timestamp).getTime() < endTs);
  }
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const total = events.length;
  const limit = Math.min(filters.limit || AUDIT_QUERY_MAX_ROWS, AUDIT_QUERY_MAX_ROWS);
  const offset = Math.max(filters.offset || 0, 0);
  // Throttle only when the system cap (AUDIT_QUERY_MAX_ROWS) forced a cut, not
  // when the caller explicitly paginated with a smaller limit.
  const requestedLimit = filters.limit;
  const throttled = total > limit && (requestedLimit === undefined || requestedLimit >= AUDIT_QUERY_MAX_ROWS);
  if (throttled) {
    _recordEvent(EVENT_TYPES.AUDIT_QUERY_THROTTLED, NODE_ID, { requestedLimit: limit, matched: total, bounded: !hasExplicitBound });
  }
  return { events: events.slice(offset, offset + limit), total, limit, offset, throttled };
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
  _eventsById.clear();
  for (const k of Object.keys(_indexByType)) delete _indexByType[k];
  for (const k of Object.keys(_indexByNode)) delete _indexByNode[k];
  // Keep the idempotency watermark in sync with keyring/event resets so a
  // fresh keyring (e.g. via keyRotationStore._reset in tests or operator
  // re-keying) can accept a new commit without being rejected as "stale".
  _lastAppliedRotatedAt = 0;
}

// Track last applied rotation for idempotency / ordering (L3-03).
// A KEY_COMMIT whose rotatedAt is <= this watermark is a duplicate or
// out-of-order (stale) commit and MUST NOT be re-applied — otherwise an
// older key could regress the keyring after a newer one has been installed.
let _lastAppliedRotatedAt = 0;

function _ensurePrimitiveAuth() {
  if (_primitiveAuth) return _primitiveAuth;
  const engine = new CryptoPolicyEngine({});
  const policy = engine.getPolicy().clusterKeyringPrimitiveAuthorization || {};
  _primitiveAuth = new ClusterKeyringPrimitiveAuthorization({
    policy,
    keyringSync: { recordTelemetry },
  });
  return _primitiveAuth;
}

const _state = {
  nodeId: NODE_ID,
  leaderId: null,
  epoch: 0,
  activeFingerprint: null,
  previousFingerprint: null,
  rotatedAt: null,
};

// ── STEK / KEK maintenance (Track 11) ────────────────────────────────────────
const STEK_ROTATION_INTERVAL_MS = parseInt(process.env.STEK_ROTATION_INTERVAL_MS, 10) || 24 * 60 * 60 * 1000;
const STEK_RETIRED_WINDOW_MS = parseInt(process.env.STEK_RETIRED_WINDOW_MS, 10) || 2 * 60 * 60 * 1000;

let _stek = null;
let _stekId = null;
let _retiredSteks = new Map(); // stekIdHex -> { stek, retiredAt }
let _stekTimer = null;

// DKG Transcript Gossip Session State
const DKG_SESSION_TIMEOUT_MS = parseInt(process.env.DKG_SESSION_TIMEOUT_MS, 10) || 60000;
let _dkgSession = null;
let _dkgSessionTimer = null;

// Epoch-frame verification state
const EPOCH_RECONCILE_THRESHOLD = parseInt(process.env.EPOCH_RECONCILE_THRESHOLD, 10) || 5;
const _peerEpochs = new Map(); // peerKey -> epoch number

// SIEM alerting hooks
const _siemHooks = []; // array of callback functions
const SIEM_RATE_LIMIT_PER_MIN = parseInt(process.env.SIEM_RATE_LIMIT_PER_MIN, 10) || 100;
const _siemRateCounters = new Map(); // eventType -> { count, windowStart }

function _pruneRetiredSteks() {
  const now = Date.now();
  for (const [id, entry] of _retiredSteks.entries()) {
    if (now - entry.retiredAt >= STEK_RETIRED_WINDOW_MS) {
      _retiredSteks.delete(id);
    }
  }
}

function rotateStek() {
  _pruneRetiredSteks();
  if (_stek && _stekId) {
    _retiredSteks.set(_stekId.toString('hex'), { stek: _stek, retiredAt: Date.now() });
  }
  const generated = resumption.generateStek();
  _stek = generated.stek;
  _stekId = generated.stekId;
  _recordEvent(EVENT_TYPES.STEK_ROTATED, NODE_ID, { stekId: _stekId.toString('hex') });
  return { stek: _stek, stekId: _stekId };
}

function getStek() {
  if (!_stek) rotateStek();
  return { stek: _stek, stekId: _stekId };
}

function getStekForValidation(stekId) {
  const hex = Buffer.isBuffer(stekId) ? stekId.toString('hex') : String(stekId);
  if (_stekId && _stekId.toString('hex') === hex) return _stek;
  _pruneRetiredSteks();
  const retired = _retiredSteks.get(hex);
  return retired ? retired.stek : null;
}

function startStekRotation() {
  if (_stekTimer) return;
  if (!_stek) rotateStek();
  _stekTimer = setInterval(rotateStek, STEK_ROTATION_INTERVAL_MS);
}

function stopStekRotation() {
  if (_stekTimer) {
    clearInterval(_stekTimer);
    _stekTimer = null;
  }
}

function getStekState() {
  return {
    activeStekId: _stekId ? _stekId.toString('hex') : null,
    retiredCount: _retiredSteks.size,
    rotationIntervalMs: STEK_ROTATION_INTERVAL_MS,
    retiredWindowMs: STEK_RETIRED_WINDOW_MS,
  };
}

function _resetStek() {
  _stek = null;
  _stekId = null;
  _retiredSteks = new Map();
  stopStekRotation();
}

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

function _isKnownClusterPeer(host, port) {
  for (const { host: h, port: p2 } of CLUSTER_NODES) {
    if (h === host && p2 === port) return true;
  }
  return false;
}

function _validateStrictLowercaseHex(hex, fieldName) {
  if (!hex || typeof hex !== 'string' || hex.length !== 64 || !/^[0-9a-f]+$/.test(hex)) {
    _recordEvent(EVENT_TYPES.KEY_REJECT, NODE_ID, {
      reason: 'invalid_hex_format',
      field: fieldName,
      length: hex ? hex.length : 0,
    });
    return false;
  }
  return true;
}

// DKG BigInt Serialization Helpers
function _serializeDkgBigInt(value) {
  if (typeof value !== 'bigint') throw new Error('_serializeDkgBigInt: expected bigint, got ' + typeof value);
  return value.toString(16);
}

function _deserializeDkgBigInt(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error('_deserializeDkgBigInt: invalid hex string: ' + hex);
  }
  return BigInt('0x' + hex);
}

function _validateDkgHex(hex, fieldName) {
  if (!hex || typeof hex !== 'string' || !/^[0-9a-f]+$/.test(hex)) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, NODE_ID, {
      reason: 'invalid_hex',
      field: fieldName,
      length: hex ? hex.length : 0,
    });
    return false;
  }
  return true;
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

// Apply a KEY_COMMIT received from the leader, with idempotency + ordering
// guard (L3-03). A commit whose rotatedAt is <= the last successfully
// applied watermark is rejected as a duplicate or stale (out-of-order)
// commit; the keyring is left untouched and a key_reject event is recorded
// so the audit timeline shows the rejection. Returns true if applied,
// false if rejected.
function _applyRemoteKeyCommit(msg) {
  if (!msg || !msg.activeHex) return false;
  const rotatedAt = Number(msg.rotatedAt);
  if (!Number.isFinite(rotatedAt)) {
    _recordEvent(EVENT_TYPES.KEY_REJECT, msg.from || NODE_ID, {
      reason: 'missing_or_invalid_rotatedAt',
      activeFingerprint: msg.activeFingerprint,
    });
    _log('warn', 'Rejected KEY_COMMIT with invalid rotatedAt', { from: msg.from });
    return false;
  }
  if (rotatedAt <= _lastAppliedRotatedAt) {
    _recordEvent(EVENT_TYPES.KEY_REJECT, msg.from || NODE_ID, {
      reason: rotatedAt === _lastAppliedRotatedAt ? 'duplicate_commit' : 'stale_commit',
      rotatedAt,
      lastAppliedRotatedAt: _lastAppliedRotatedAt,
      activeFingerprint: msg.activeFingerprint,
    });
    _log('warn', 'Rejected stale/duplicate KEY_COMMIT', {
      from: msg.from,
      rotatedAt,
      lastAppliedRotatedAt: _lastAppliedRotatedAt,
    });
    return false;
  }
  try {
    keyRotationStore.applyKeyringCommit(
      msg.activeHex,
      msg.previousHex || null,
      rotatedAt,
      msg.graceMs || null,
    );
    _lastAppliedRotatedAt = rotatedAt;
    _updateLocalKeyringState();
    _recordEvent(EVENT_TYPES.KEY_COMMIT, msg.from || NODE_ID, {
      activeFingerprint: msg.activeFingerprint,
      previousFingerprint: msg.previousFingerprint,
      rotatedAt,
      graceMs: msg.graceMs || null,
    });
    _log('info', 'Applied keyring commit from leader', {
      leaderId: msg.from,
      activeFingerprint: msg.activeFingerprint,
      rotatedAt,
    });
    return true;
  } catch (err) {
    _log('error', 'Failed to apply keyring commit', { error: err.message });
    return false;
  }
}

/**
 * Validate incoming epoch against local epoch.
 * - Stale epoch (< local): record EPOCH_STALE, do not adopt
 * - Higher epoch (<= threshold): adopt, record EPOCH_DRIFT + EPOCH_RECONCILED
 * - Unreconcilable jump (> threshold): hard reject, record EPOCH_DRIFT with reason
 * @param {object} msg - incoming message with epoch field
 * @param {string} peerKey - peer identifier
 * @returns {boolean} true if message should be processed, false if rejected
 */
function _validateIncomingEpoch(msg, peerKey) {
  if (typeof msg.epoch !== 'number' || msg.epoch < 0) return true; // skip if no epoch
  const localEpoch = _state.epoch;
  const peerEpoch = msg.epoch;
  _peerEpochs.set(peerKey, peerEpoch);
  if (peerEpoch < localEpoch) {
    _recordEvent(EVENT_TYPES.EPOCH_STALE, msg.from || NODE_ID, {
      peerEpoch,
      localEpoch,
      peer: peerKey,
    });
    _log('warn', 'Peer reported stale epoch', { peer: peerKey, peerEpoch, localEpoch });
    return true; // allow processing but don't adopt
  }
  if (peerEpoch > localEpoch) {
    const jump = peerEpoch - localEpoch;
    if (jump > EPOCH_RECONCILE_THRESHOLD) {
      _recordEvent(EVENT_TYPES.EPOCH_DRIFT, msg.from || NODE_ID, {
        peerEpoch,
        localEpoch,
        jump,
        peer: peerKey,
        reason: 'unreconcilable_jump',
        siemSeverity: 'high',
        siemCategory: 'epoch_manipulation',
        siemSource: 'cluster-keyring-sync',
      });
      _log('warn', 'Unreconcilable epoch jump — rejecting', { peer: peerKey, peerEpoch, localEpoch, jump });
      return false; // hard reject
    }
    // Adopt the higher epoch
    _recordEvent(EVENT_TYPES.EPOCH_DRIFT, msg.from || NODE_ID, {
      peerEpoch,
      localEpoch,
      jump,
      peer: peerKey,
      siemSeverity: 'high',
      siemCategory: 'epoch_reconciliation',
      siemSource: 'cluster-keyring-sync',
    });
    _state.epoch = peerEpoch;
    try { keyRotationStore.setEpoch(peerEpoch); } catch (e) { /* best-effort */ }
    _recordEvent(EVENT_TYPES.EPOCH_RECONCILED, NODE_ID, {
      newEpoch: peerEpoch,
      previousEpoch: localEpoch,
      peer: peerKey,
    });
    _log('info', 'Adopted higher epoch from peer', { peer: peerKey, newEpoch: peerEpoch, previousEpoch: localEpoch });
  }
  return true;
}

/**
 * Register a SIEM alert hook. The callback fires on high-severity events
 * (KEY_REJECT, ISOLATION_VIOLATION, EPOCH_DRIFT, SPLIT_BRAIN_DETECTED).
 * Rate-limited per event type (default 100/min). Excess calls are dropped silently.
 * @param {function} callback - receives (eventType, node, details)
 */
function registerSiemHook(callback) {
  if (typeof callback !== 'function') throw new Error('registerSiemHook: callback must be a function');
  _siemHooks.push(callback);
}

/**
 * Invoke SIEM hooks for a high-severity event, with rate limiting.
 * Excess calls beyond SIEM_RATE_LIMIT_PER_MIN per event type are dropped silently.
 * @param {string} eventType
 * @param {string} node
 * @param {object} details
 */
function _invokeSiemHooks(eventType, node, details) {
  const now = Date.now();
  let counter = _siemRateCounters.get(eventType);
  if (!counter || (now - counter.windowStart) > 60000) {
    counter = { count: 0, windowStart: now };
    _siemRateCounters.set(eventType, counter);
  }
  counter.count++;
  if (counter.count > SIEM_RATE_LIMIT_PER_MIN) return; // drop silently
  for (const hook of _siemHooks) {
    try {
      hook(eventType, node, details);
    } catch (err) {
      _log('warn', 'SIEM hook threw error', { error: err.message, eventType });
    }
  }
}

/**
 * Get current epoch state for diagnostics.
 * @returns {object}
 */
function getEpochState() {
  return {
    localEpoch: _state.epoch,
    reconcileThreshold: EPOCH_RECONCILE_THRESHOLD,
    peerEpochs: Object.fromEntries(_peerEpochs),
  };
}

// High-severity event types that trigger SIEM hooks
const SIEM_EVENT_TYPES = new Set([
  EVENT_TYPES.KEY_REJECT,
  EVENT_TYPES.ISOLATION_VIOLATION,
  EVENT_TYPES.EPOCH_DRIFT,
  EVENT_TYPES.SPLIT_BRAIN_DETECTED,
]);

function _handleMessage(msg, socket) {
  if (!msg || !msg.type) return;
  const peerKey = _peerKey(socket.remoteAddress, socket.remotePort);

  if (msg.type === 'ANNOUNCE') {
    _peerState.set(peerKey, { lastSeen: Date.now(), nodeId: msg.nodeId });
    _sendMessage(socket, { type: 'ANNOUNCE_ACK', from: NODE_ID, leaderId: _state.leaderId, epoch: _state.epoch });
    return;
  }

  if (msg.type === 'HEARTBEAT' || msg.type === 'KEY_COMMIT') {
    // Reject messages from unknown cluster peers
    const remoteHost = socket.remoteAddress;
    const remotePort = socket.remotePort;
    if (!_isKnownClusterPeer(remoteHost, remotePort) && !_isSelf(remoteHost, remotePort)) {
      _log('warn', 'Rejected message from unknown cluster peer', { peer: peerKey, type: msg.type });
      _recordEvent(EVENT_TYPES.ISOLATION_VIOLATION, NODE_ID, { peer: peerKey, reason: 'unknown_cluster_peer', msgType: msg.type, siemSeverity: 'critical', siemCategory: 'network_isolation', siemSource: 'cluster-keyring-sync' });
      socket.destroy();
      return;
    }
    // Reject KEY_COMMIT from non-leader nodes
    if (msg.type === 'KEY_COMMIT') {
      if (msg.from && _state.leaderId && msg.from !== _state.leaderId) {
        _log('warn', 'Rejected KEY_COMMIT from non-leader node', { from: msg.from, currentLeader: _state.leaderId });
        _recordEvent(EVENT_TYPES.KEY_REJECT, msg.from || NODE_ID, {
          reason: 'not_leader',
          currentLeader: _state.leaderId,
        });
        return;
      }
      // Validate hex format before applying
      if (!_validateStrictLowercaseHex(msg.activeHex, 'activeHex')) return;
      if (msg.previousHex && !_validateStrictLowercaseHex(msg.previousHex, 'previousHex')) return;
      // Reject KEY_COMMIT with stale epoch (replay attack prevention)
      if (typeof msg.epoch === 'number' && msg.epoch < _state.epoch) {
        _log('warn', 'Rejected KEY_COMMIT with stale epoch', { from: msg.from, peerEpoch: msg.epoch, localEpoch: _state.epoch });
        _recordEvent(EVENT_TYPES.KEY_REJECT, msg.from || NODE_ID, {
          reason: 'stale_epoch',
          peerEpoch: msg.epoch,
          localEpoch: _state.epoch,
          siemSeverity: 'high',
          siemCategory: 'replay_attack',
          siemSource: 'cluster-keyring-sync',
        });
        return;
      }
    }
    // Validate incoming epoch (after whitelist check, before state update)
    if (!_validateIncomingEpoch(msg, peerKey)) return;
    const peer = _peerState.get(peerKey) || {};
    peer.lastSeen = Date.now();
    peer.leaderId = msg.leaderId;
    peer.activeFingerprint = msg.activeFingerprint;
    peer.previousFingerprint = msg.previousFingerprint;
    peer.rotatedAt = msg.rotatedAt;
    _peerState.set(peerKey, peer);

    if (msg.type === 'KEY_COMMIT') {
      _applyRemoteKeyCommit(msg);
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
  const onConnect = async (socket) => {
    if (process.env.CLUSTER_QUANTUM_HYBRID === '1') {
      try {
        await hybridKem.createClientHandshaker(socket, { timeoutMs: 15000 });
      } catch (err) {
        _log('warn', 'Hybrid KEM handshake failed on client', { peer: key, error: err.message });
        _recordEvent(EVENT_TYPES.QUANTUM_DEGRADE_REJECTED, NODE_ID, { peer: key, error: err.message });
        socket.destroy();
        return;
      }
    }
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
    // rejectUnauthorized:false is intentional under the trusted-network
    // threat model (see _startServer). Do not flip to true without also
    // configuring a real CA chain and stopping raw-key-hex broadcast.
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

// ── Transport security model ────────────────────────────────────────────────
// The cluster keyring transport is OPPORTUNISTIC TLS, NOT mutual TLS (mTLS):
//   - Server: requestCert:false, rejectUnauthorized:false  (no client cert
//     requested or verified)
//   - Client: rejectUnauthorized:false                      (server cert not
//     verified)
//   - When CLUSTER_CERT/CLUSTER_KEY are unset, the transport falls back to
//     plaintext TCP.
//
// This is intentional and relies on the deployment threat model: the cluster
// port (CLUSTER_KEYRING_PORT, default 7000) MUST be reachable only on a
// trusted private network (e.g. a private VPC, isolated overlay, or
// loopback). KEY_COMMIT frames carry raw key material (activeHex/previousHex)
// over this channel; without network-level isolation any reachable peer can
// install or observe cluster keys.
//
// Do NOT enable mTLS (requestCert:true / rejectUnauthorized:true + a real
// CA chain) unless the deployment actually crosses untrusted networks — and
// if it does, also stop broadcasting raw key hex in favor of per-node
// encrypted key wrapping. Both changes are out of scope for the trusted-
// network threat model and must be designed together.
function _startServer() {
  if (_server) return;
  const isTls = !!(process.env.CLUSTER_CERT && process.env.CLUSTER_KEY);
  const onConnection = async (socket) => {
    if (process.env.CLUSTER_QUANTUM_HYBRID === '1') {
      try {
        await hybridKem.createServerHandshaker(socket, { timeoutMs: 15000 });
      } catch (err) {
        _log('warn', 'Hybrid KEM handshake failed on server', { error: err.message });
        _recordEvent(EVENT_TYPES.QUANTUM_DEGRADE_REJECTED, NODE_ID, { error: err.message });
        socket.destroy();
        return;
      }
    }
    _readFrames(socket, _handleMessage);
    socket.on('error', (err) => _log('warn', 'Server socket error', { error: err.message }));
    socket.on('close', () => _log('debug', 'Server socket closed'));
  };

  if (!isTls) {
    _log('warn', 'Cluster keyring transport is PLAINTEXT TCP (no CLUSTER_CERT/CLUSTER_KEY). '
      + 'Raw key material will be broadcast unencrypted. Only acceptable on a fully isolated/trusted network.');
  }

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
  startStekRotation();
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
  stopStekRotation();
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
    stek: getStekState(),
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

function registerPrimitiveGate(trackType, hub, validator) {
  return _ensurePrimitiveAuth().registerGate(trackType, hub, validator);
}

function authorizePrimitivePool(trackType, poolId, request) {
  return _ensurePrimitiveAuth().authorizeAccreditedPool(trackType, poolId, request);
}

function revokePrimitiveAuthorization(poolId, reason) {
  return _ensurePrimitiveAuth().revokeAuthorization(poolId, reason);
}

function isPrimitivePoolAuthorized(poolId) {
  return _ensurePrimitiveAuth().isPoolAuthorized(poolId);
}

function syncPrimitivePool(poolId, targetEnclaveId) {
  return _ensurePrimitiveAuth().syncAuthorizedPool(poolId, targetEnclaveId);
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
  // Advance the idempotency watermark so a reflected/duplicate KEY_COMMIT
  // (e.g. re-broadcast by a lagging peer) is rejected on the leader too.
  if (Number.isFinite(_state.rotatedAt)) {
    _lastAppliedRotatedAt = _state.rotatedAt;
  }

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


// ── DKG Transcript Gossip Transport ──────────────────────────────────────────

/**
 * Initialize a DKG session as the leader. Generates a contribution via the
 * provided DkgSnarkEngine, broadcasts DKG_COMMIT to all peers, and sends
 * DKG_SHARE privately to each peer.
 */
function initDkgSession(options = {}) {
  if (!options.dkgEngine) throw new Error('initDkgSession: dkgEngine required');
  if (!options.nodeId) throw new Error('initDkgSession: nodeId required');
  if (_dkgSession) throw new Error('initDkgSession: DKG session already active');

  const sessionId = 'dkg-' + crypto.randomBytes(4).toString('hex');
  const dkgEngine = options.dkgEngine;
  const contribution = dkgEngine.generateContribution(options.nodeId);

  _dkgSession = {
    phase: 'commit',
    sessionId,
    startedAt: Date.now(),
    dkgEngine,
    nodeId: options.nodeId,
    contributions: new Map(),
    sharesReceived: new Map(),
    complaints: [],
    disqualified: new Set(),
    finalized: false,
    masterPublicKey: null,
  };

  _dkgSession.contributions.set(options.nodeId, {
    commitments: contribution.commitments.map((c) => _serializeDkgBigInt(c)),
  });

  _broadcast({
    type: 'DKG_COMMIT',
    from: NODE_ID,
    sessionId,
    nodeId: options.nodeId,
    commitments: contribution.commitments.map((c) => _serializeDkgBigInt(c)),
  });

  for (const [peerNodeId, share] of contribution.shares.entries()) {
    _sendDkgShareToPeer(peerNodeId, options.nodeId, sessionId, share);
  }

  _dkgSessionTimer = setTimeout(() => {
    if (_dkgSession && !_dkgSession.finalized) {
      _recordEvent(EVENT_TYPES.DKG_SESSION_TIMEOUT, NODE_ID, {
        sessionId: _dkgSession.sessionId,
        phase: _dkgSession.phase,
        elapsed: Date.now() - _dkgSession.startedAt,
      });
      _log('warn', 'DKG session timed out', { sessionId: _dkgSession.sessionId });
      _dkgSession = null;
      _dkgSessionTimer = null;
    }
  }, DKG_SESSION_TIMEOUT_MS);

  _recordEvent(EVENT_TYPES.DKG_SESSION_STARTED, NODE_ID, {
    sessionId,
    threshold: dkgEngine._threshold,
    totalNodes: dkgEngine._totalNodes,
  });
  _log('info', 'DKG session started', { sessionId });

  return getDkgSessionStatus();
}

function _sendDkgShareToPeer(peerNodeId, fromNodeId, sessionId, share) {
  for (const [peerKey, state] of _peerState.entries()) {
    if (state.nodeId === peerNodeId) {
      const socket = _sockets.get(peerKey);
      if (socket && !socket.destroyed) {
        _sendMessage(socket, {
          type: 'DKG_SHARE',
          from: NODE_ID,
          sessionId,
          broadcasterId: fromNodeId,
          recipientId: peerNodeId,
          share: _serializeDkgBigInt(share),
        });
      }
      return;
    }
  }
  _log('warn', 'Could not find socket for DKG_SHARE delivery', { peerNodeId });
}

function getDkgSessionStatus() {
  if (!_dkgSession) return null;
  return {
    sessionId: _dkgSession.sessionId,
    phase: _dkgSession.phase,
    startedAt: _dkgSession.startedAt,
    contributionsReceived: _dkgSession.contributions.size,
    sharesReceived: _dkgSession.sharesReceived.size,
    complaints: _dkgSession.complaints.length,
    disqualified: [..._dkgSession.disqualified],
    finalized: _dkgSession.finalized,
    masterPublicKey: _dkgSession.masterPublicKey
      ? _serializeDkgBigInt(_dkgSession.masterPublicKey)
      : null,
  };
}

function _resetDkgSession() {
  if (_dkgSessionTimer) {
    clearTimeout(_dkgSessionTimer);
    _dkgSessionTimer = null;
  }
  _dkgSession = null;
}

function _resetEpoch() {
  _state.epoch = 0;
}

function _resetEpochState() {
  _peerEpochs.clear();
  _siemHooks.length = 0;
  _siemRateCounters.clear();
}

function _handleDkgMessage(msg, socket) {
  if (!msg || !DKG_MESSAGE_TYPES.has(msg.type)) return;
  const peerKey = _peerKey(socket.remoteAddress, socket.remotePort);

  const remoteHost = socket.remoteAddress;
  const remotePort = socket.remotePort;
  if (!_isKnownClusterPeer(remoteHost, remotePort) && !_isSelf(remoteHost, remotePort)) {
    _log('warn', 'Rejected DKG message from unknown cluster peer', { peer: peerKey, type: msg.type });
    _recordEvent(EVENT_TYPES.ISOLATION_VIOLATION, NODE_ID, { peer: peerKey, reason: 'unknown_cluster_peer', msgType: msg.type });
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, { reason: 'unknown_peer', msgType: msg.type });
    socket.destroy();
    return;
  }

  if (DKG_LEADER_ONLY_TYPES.has(msg.type)) {
    if (msg.from && _state.leaderId && msg.from !== _state.leaderId) {
      _log('warn', 'Rejected ' + msg.type + ' from non-leader node', { from: msg.from, currentLeader: _state.leaderId });
      _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
        reason: 'not_leader',
        msgType: msg.type,
        currentLeader: _state.leaderId,
      });
      return;
    }
  }

  if (!_dkgSession) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'no_active_session',
      msgType: msg.type,
    });
    _log('warn', 'Received ' + msg.type + ' but no DKG session active', { from: msg.from });
    return;
  }

  if (msg.sessionId && msg.sessionId !== _dkgSession.sessionId) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'session_mismatch',
      msgType: msg.type,
      expected: _dkgSession.sessionId,
      received: msg.sessionId,
    });
    _log('warn', 'DKG message with wrong session ID', { from: msg.from, expected: _dkgSession.sessionId, received: msg.sessionId });
    return;
  }

  switch (msg.type) {
    case 'DKG_COMMIT':
      _handleDkgCommit(msg);
      break;
    case 'DKG_SHARE':
      _handleDkgShare(msg, socket);
      break;
    case 'DKG_COMPLAINT':
      _handleDkgComplaint(msg);
      break;
    case 'DKG_DISQUALIFY':
      _handleDkgDisqualify(msg);
      break;
    case 'DKG_FINALIZE':
      _handleDkgFinalize(msg);
      break;
  }
}

function _handleDkgCommit(msg) {
  const fromNodeId = msg.nodeId || msg.from;
  if (!fromNodeId) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, NODE_ID, { reason: 'missing_nodeId', msgType: 'DKG_COMMIT' });
    return;
  }
  if (!Array.isArray(msg.commitments)) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, fromNodeId, { reason: 'missing_commitments', msgType: 'DKG_COMMIT' });
    return;
  }
  for (let i = 0; i < msg.commitments.length; i++) {
    if (!_validateDkgHex(msg.commitments[i], 'commitments[' + i + ']')) {
      _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, fromNodeId, {
        reason: 'invalid_hex',
        msgType: 'DKG_COMMIT',
        field: 'commitments[' + i + ']',
      });
      return;
    }
  }
  if (_dkgSession.contributions.has(fromNodeId)) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, fromNodeId, {
      reason: 'duplicate_commit',
      msgType: 'DKG_COMMIT',
    });
    _log('warn', 'Duplicate DKG_COMMIT from node', { fromNodeId });
    return;
  }

  _dkgSession.contributions.set(fromNodeId, {
    commitments: msg.commitments,
  });

  _recordEvent(EVENT_TYPES.DKG_COMMIT_RECEIVED, NODE_ID, {
    fromNodeId,
    commitmentCount: msg.commitments.length,
  });
  _log('info', 'DKG_COMMIT received', { fromNodeId, commitments: msg.commitments.length });
}

function _handleDkgShare(msg, socket) {
  const broadcasterId = msg.broadcasterId;
  const recipientId = msg.recipientId;
  const shareHex = msg.share;

  if (!broadcasterId || !recipientId || !shareHex) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'missing_field',
      msgType: 'DKG_SHARE',
      fields: { broadcasterId: !!broadcasterId, recipientId: !!recipientId, share: !!shareHex },
    });
    return;
  }

  if (recipientId !== NODE_ID) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'share_must_unicast',
      msgType: 'DKG_SHARE',
      recipientId,
    });
    _log('warn', 'Received DKG_SHARE intended for another node', { recipientId, broadcasterId });
    return;
  }

  if (!_validateDkgHex(shareHex, 'share')) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'invalid_hex',
      msgType: 'DKG_SHARE',
      field: 'share',
    });
    return;
  }

  let share;
  try {
    share = _deserializeDkgBigInt(shareHex);
  } catch (err) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'share_deserialize_failed',
      msgType: 'DKG_SHARE',
      error: err.message,
    });
    return;
  }

  const contrib = _dkgSession.contributions.get(broadcasterId);
  if (!contrib) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'no_commitment_for_broadcaster',
      msgType: 'DKG_SHARE',
      broadcasterId,
    });
    _log('warn', 'DKG_SHARE received before DKG_COMMIT', { broadcasterId });
    return;
  }

  let verified = false;
  try {
    verified = _dkgSession.dkgEngine.verifyShare(broadcasterId, recipientId, share);
  } catch (err) {
    _log('warn', 'verifyShare threw during DKG_SHARE handling', { broadcasterId, error: err.message });
  }

  if (!verified) {
    _recordEvent(EVENT_TYPES.DKG_SHARE_REJECTED, NODE_ID, {
      broadcasterId,
      reason: 'verification_failed',
    });
    _dkgSession.complaints.push({
      from: NODE_ID,
      against: broadcasterId,
      reason: 'share_verification_failed',
      timestamp: Date.now(),
    });
    _dkgSession.dkgEngine.fileComplaint(NODE_ID, broadcasterId, 'share_verification_failed');
    _recordEvent(EVENT_TYPES.DKG_COMPLAINT_FILED, NODE_ID, {
      against: broadcasterId,
      reason: 'share_verification_failed',
    });
    _broadcast({
      type: 'DKG_COMPLAINT',
      from: NODE_ID,
      sessionId: _dkgSession.sessionId,
      against: broadcasterId,
      reason: 'share_verification_failed',
    });
    return;
  }

  _dkgSession.sharesReceived.set(broadcasterId, share);
  _recordEvent(EVENT_TYPES.DKG_SHARE_RECEIVED, NODE_ID, {
    broadcasterId,
  });
  _log('info', 'DKG_SHARE verified and stored', { broadcasterId });
}

function _handleDkgComplaint(msg) {
  const fromNodeId = msg.from;
  const againstNodeId = msg.against;
  const reason = msg.reason || 'unspecified';

  if (!fromNodeId || !againstNodeId) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, fromNodeId || NODE_ID, {
      reason: 'missing_field',
      msgType: 'DKG_COMPLAINT',
    });
    return;
  }

  _dkgSession.complaints.push({
    from: fromNodeId,
    against: againstNodeId,
    reason,
    timestamp: Date.now(),
  });
  _dkgSession.dkgEngine.fileComplaint(fromNodeId, againstNodeId, reason);
  _recordEvent(EVENT_TYPES.DKG_COMPLAINT_FILED, fromNodeId, {
    against: againstNodeId,
    reason,
  });
  _log('info', 'DKG_COMPLAINT received', { fromNodeId, againstNodeId, reason });
}

function _handleDkgDisqualify(msg) {
  if (!Array.isArray(msg.disqualified)) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'missing_disqualified_list',
      msgType: 'DKG_DISQUALIFY',
    });
    return;
  }

  for (const nodeId of msg.disqualified) {
    _dkgSession.disqualified.add(nodeId);
    _recordEvent(EVENT_TYPES.DKG_NODE_DISQUALIFIED, nodeId, {
      sessionId: _dkgSession.sessionId,
    });
  }
  _log('info', 'DKG_DISQUALIFY received', { count: msg.disqualified.length });
}

function _handleDkgFinalize(msg) {
  if (!msg.masterPublicKey) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'missing_masterPublicKey',
      msgType: 'DKG_FINALIZE',
    });
    return;
  }
  if (!_validateDkgHex(msg.masterPublicKey, 'masterPublicKey')) {
    _recordEvent(EVENT_TYPES.DKG_INVALID_MESSAGE, msg.from || NODE_ID, {
      reason: 'invalid_hex',
      msgType: 'DKG_FINALIZE',
      field: 'masterPublicKey',
    });
    return;
  }

  _dkgSession.finalized = true;
  _dkgSession.masterPublicKey = _deserializeDkgBigInt(msg.masterPublicKey);

  if (_dkgSessionTimer) {
    clearTimeout(_dkgSessionTimer);
    _dkgSessionTimer = null;
  }

  _recordEvent(EVENT_TYPES.DKG_SESSION_COMPLETED, NODE_ID, {
    sessionId: _dkgSession.sessionId,
    masterPublicKey: msg.masterPublicKey,
  });
  _log('info', 'DKG session finalized', { sessionId: _dkgSession.sessionId });
}

module.exports = {
  init,
  shutdown,
  isLeader,
  getStatus,
  proposeRotate,
  queryEvents,
  getEventStats,
  recordTelemetry,
  EVENT_TYPES,
  rotateStek,
  getStek,
  getStekForValidation,
  startStekRotation,
  stopStekRotation,
  getStekState,
  _resetStek,
  registerPrimitiveGate,
  authorizePrimitivePool,
  revokePrimitiveAuthorization,
  isPrimitivePoolAuthorized,
  syncPrimitivePool,
  // Test helpers
  _resetEvents,
  _recordEvent,
  _applyRemoteKeyCommit,
  // DKG transcript gossip
  initDkgSession,
  getDkgSessionStatus,
  _resetDkgSession,
  _handleDkgMessage,
  _serializeDkgBigInt,
  _deserializeDkgBigInt,
  _validateDkgHex,
  // Epoch-frame verification
  getEpochState,
  _validateIncomingEpoch,
  _resetEpochState,
  _handleMessage,
  _resetEpoch,
  // SIEM alerting hooks
  registerSiemHook,
  _invokeSiemHooks,
  _siemHooks,
};

