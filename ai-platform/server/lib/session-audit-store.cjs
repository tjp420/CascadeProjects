'use strict';

/**
 * Session Audit Store — Captures step-by-step user-model conversation
 * histories for compliance teams to visually retrace full prompt contexts
 * in an interactive chat history viewer.
 *
 * Each conversation turn records:
 *   - sessionId (groups turns in a conversation)
 *   - requestId (unique per turn)
 *   - userId / orgId
 *   - userMessage (the prompt text)
 *   - assistantResponse (the AI response)
 *   - provider, model, personality
 *   - conversationHistory (sanitized prior turns at time of request)
 *   - routingDecision (model-routing optimizer result, if any)
 *   - timing (inference duration, TTFT)
 *   - timestamp
 *   - refusalDetected, retried, fallbackModelUsed
 *
 * @module session-audit-store
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./app-logger.cjs');

const STORE_PATH =
  process.env.SESSION_AUDIT_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'session-audit.json');

const MAX_SESSIONS = 1000;
const MAX_TURNS_PER_SESSION = 200;

let _cache = null;
let _cacheDirty = true;

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      _cache = JSON.parse(raw);
      if (!_cache.sessions) _cache.sessions = {};
      if (!_cache.turnIndex) _cache.turnIndex = [];
    } else {
      _cache = { sessions: {}, turnIndex: [] };
    }
  } catch {
    _cache = { sessions: {}, turnIndex: [] };
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_cache, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  _cacheDirty = false;
}

/**
 * Generate a unique session ID.
 */
function generateSessionId() {
  return `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Record a conversation turn.
 * @param {object} turn — Turn data
 * @param {string} turn.sessionId — Session ID (groups turns)
 * @param {string} turn.requestId — Unique request ID
 * @param {string} turn.userId — User email or ID
 * @param {string} turn.orgId — Organization ID
 * @param {string} turn.userMessage — The user's prompt
 * @param {string} turn.assistantResponse — The AI's response
 * @param {string} turn.provider — AI provider used
 * @param {string} turn.model — Model used
 * @param {string} turn.personality — Personality preset
 * @param {Array} turn.conversationHistory — Sanitized history at request time
 * @param {object} turn.routingDecision — Model routing decision
 * @param {object} turn.timing — Timing data
 * @param {boolean} turn.refusalDetected — Whether refusal was detected
 * @param {boolean} turn.retried — Whether retry was attempted
 * @param {string} turn.fallbackModelUsed — Fallback model if used
 * @returns {object} — { success, turn }
 */
function recordTurn(turn) {
  try {
    const store = readStore();
    const sessionId = turn.sessionId || generateSessionId();

    if (!store.sessions[sessionId]) {
      store.sessions[sessionId] = {
        sessionId,
        userId: turn.userId || 'anonymous',
        orgId: turn.orgId || 'default',
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        turnCount: 0,
        turns: [],
      };
    }

    const session = store.sessions[sessionId];
    session.lastActivityAt = new Date().toISOString();
    session.turnCount++;

    const turnRecord = {
      turnId: crypto.randomBytes(6).toString('hex'),
      requestId: turn.requestId || `req-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userMessage: (turn.userMessage || '').substring(0, 32000),
      assistantResponse: (turn.assistantResponse || '').substring(0, 32000),
      provider: turn.provider || 'unknown',
      model: turn.model || '',
      personality: turn.personality || 'helpful',
      conversationHistoryLength: Array.isArray(turn.conversationHistory)
        ? turn.conversationHistory.length
        : 0,
      conversationHistory: Array.isArray(turn.conversationHistory)
        ? turn.conversationHistory.slice(-20).map((m) => ({
            role: m.role,
            contentLength: (m.content || '').length,
            contentPreview: (m.content || '').substring(0, 500),
          }))
        : [],
      routingDecision: turn.routingDecision
        ? {
            routed: turn.routingDecision.routed,
            provider: turn.routingDecision.provider,
            model: turn.routingDecision.model,
            complexityScore: turn.routingDecision.complexityScore,
            tokenEstimate: turn.routingDecision.tokenEstimate,
            override: turn.routingDecision.override,
            reason: turn.routingDecision.reason,
          }
        : null,
      timing: turn.timing || null,
      inferenceDurationMs: turn.inferenceDurationMs || null,
      refusalDetected: turn.refusalDetected || false,
      retried: turn.retried || false,
      fallbackModelUsed: turn.fallbackModelUsed || null,
    };

    session.turns.push(turnRecord);

    // Prune turns if session exceeds max
    if (session.turns.length > MAX_TURNS_PER_SESSION) {
      session.turns = session.turns.slice(-MAX_TURNS_PER_SESSION);
    }

    // Add to turn index for fast querying
    store.turnIndex.push({
      sessionId,
      turnId: turnRecord.turnId,
      timestamp: turnRecord.timestamp,
      userId: session.userId,
      orgId: session.orgId,
      provider: turnRecord.provider,
    });

    // Prune sessions if exceeding max
    const sessionIds = Object.keys(store.sessions);
    if (sessionIds.length > MAX_SESSIONS) {
      // Sort by lastActivityAt and remove oldest
      const sorted = sessionIds.sort((a, b) => {
        const sa = store.sessions[a].lastActivityAt || '';
        const sb = store.sessions[b].lastActivityAt || '';
        return sa.localeCompare(sb);
      });
      const toRemove = sorted.slice(0, sessionIds.length - MAX_SESSIONS);
      for (const id of toRemove) {
        delete store.sessions[id];
      }
      // Clean up turn index
      store.turnIndex = store.turnIndex.filter(
        (t) => !toRemove.includes(t.sessionId)
      );
    }

    writeStore();
    return { success: true, sessionId, turnId: turnRecord.turnId };
  } catch (err) {
    logger.warn('[SessionAudit] recordTurn failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get a session by ID with all turns.
 */
function getSession(sessionId) {
  const store = readStore();
  return store.sessions[sessionId] || null;
}

/**
 * List sessions with optional filtering and pagination.
 */
function listSessions(options = {}) {
  const store = readStore();
  let sessions = Object.values(store.sessions);

  if (options.userId) {
    sessions = sessions.filter((s) => s.userId === options.userId);
  }
  if (options.orgId) {
    sessions = sessions.filter((s) => s.orgId === options.orgId);
  }
  if (options.provider) {
    sessions = sessions.filter((s) =>
      s.turns.some((t) => t.provider === options.provider)
    );
  }
  if (options.startDate) {
    sessions = sessions.filter((s) => s.lastActivityAt >= options.startDate);
  }
  if (options.endDate) {
    sessions = sessions.filter((s) => s.lastActivityAt <= options.endDate);
  }

  // Sort by last activity descending
  sessions.sort((a, b) => {
    const ba = b.lastActivityAt || '';
    const aa = a.lastActivityAt || '';
    return ba.localeCompare(aa);
  });

  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const total = sessions.length;
  const paginated = sessions.slice(offset, offset + limit);

  return {
    sessions: paginated.map((s) => ({
      sessionId: s.sessionId,
      userId: s.userId,
      orgId: s.orgId,
      startedAt: s.startedAt,
      lastActivityAt: s.lastActivityAt,
      turnCount: s.turnCount,
      providers: [...new Set(s.turns.map((t) => t.provider))],
    })),
    total,
    offset,
    limit,
  };
}

/**
 * Get a specific turn from a session.
 */
function getTurn(sessionId, turnId) {
  const session = getSession(sessionId);
  if (!session) return null;
  return session.turns.find((t) => t.turnId === turnId) || null;
}

/**
 * Get session statistics.
 */
function getStats() {
  const store = readStore();
  const sessions = Object.values(store.sessions);
  const allTurns = sessions.flatMap((s) => s.turns);

  const providerDistribution = {};
  for (const turn of allTurns) {
    providerDistribution[turn.provider] = (providerDistribution[turn.provider] || 0) + 1;
  }

  const avgTurnsPerSession = sessions.length > 0
    ? Math.round((allTurns.length / sessions.length) * 10) / 10
    : 0;

  const refusalsDetected = allTurns.filter((t) => t.refusalDetected).length;
  const fallbacksUsed = allTurns.filter((t) => t.fallbackModelUsed).length;
  const routingOverrides = allTurns.filter((t) => t.routingDecision?.override).length;

  return {
    totalSessions: sessions.length,
    totalTurns: allTurns.length,
    avgTurnsPerSession,
    providerDistribution,
    refusalsDetected,
    fallbacksUsed,
    routingOverrides,
    avgInferenceDurationMs: allTurns.length > 0 && allTurns[0].inferenceDurationMs
      ? Math.round(
          allTurns
            .filter((t) => t.inferenceDurationMs)
            .reduce((sum, t) => sum + t.inferenceDurationMs, 0) /
            Math.max(allTurns.filter((t) => t.inferenceDurationMs).length, 1)
        )
      : null,
  };
}

/**
 * Delete a session.
 */
function deleteSession(sessionId) {
  const store = readStore();
  if (!store.sessions[sessionId]) return { success: false, error: 'Session not found' };
  delete store.sessions[sessionId];
  store.turnIndex = store.turnIndex.filter((t) => t.sessionId !== sessionId);
  writeStore();
  return { success: true };
}

module.exports = {
  generateSessionId,
  recordTurn,
  getSession,
  listSessions,
  getTurn,
  getStats,
  deleteSession,
};
