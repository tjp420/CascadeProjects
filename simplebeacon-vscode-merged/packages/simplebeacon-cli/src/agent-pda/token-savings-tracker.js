"use strict";

/**
 * Token Savings Tracker — persists cumulative token savings per agent session.
 *
 * Every time SimpleBeacon compresses a scan result, finding, or report,
 * the savings are recorded here. Agents can query their cumulative savings
 * to understand how much context budget SimpleBeacon has preserved.
 *
 * Storage: .simplebeacon/agent-pda/token-savings.json
 * Local-first. No upload.
 */

const fs = require("fs");
const path = require("path");
const { atomicWriteFileSync } = require("../lib/atomic-writer");

const _DEFAULT_DATA = {
  sessions: {},
  cumulative: {
    totalSaved: 0,
    totalOriginal: 0,
    totalCompressed: 0,
    byTool: {},
    byAgent: {},
    history: [],
  },
  version: 1,
};

function getDbPath(projectRoot) {
  return path.join(
    projectRoot || process.cwd(),
    ".simplebeacon",
    "agent-pda",
    "token-savings.json",
  );
}

function load(dbPath) {
  try {
    const raw = fs.readFileSync(dbPath, "utf8");
    const data = JSON.parse(raw);
    if (!data.cumulative) return JSON.parse(JSON.stringify(_DEFAULT_DATA));
    return data;
  } catch {
    return JSON.parse(JSON.stringify(_DEFAULT_DATA));
  }
}

function save(dbPath, data) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  atomicWriteFileSync(dbPath, JSON.stringify(data, null, 2));
}

/**
 * Estimate token count from character length.
 * Heuristic: ~3.5 chars per token for mixed code/JSON.
 */
function estimateTokens(text) {
  if (typeof text !== "string") {
    try {
      text = JSON.stringify(text);
    } catch {
      return 0;
    }
  }
  return Math.ceil(text.length / 3.5);
}

/**
 * Record a compression savings event.
 *
 * @param {string} projectRoot
 * @param {object} opts
 * @param {string} opts.agentId — agent identifier
 * @param {string} opts.tool — tool name (e.g. "scan_snippet", "scan_project")
 * @param {number} opts.originalTokens — estimated tokens before compression
 * @param {number} opts.compressedTokens — estimated tokens after compression
 * @param {string} [opts.sessionId] — session identifier
 * @returns {object} the recorded event + cumulative totals
 */
function recordSavings(projectRoot, opts) {
  const dbPath = getDbPath(projectRoot);
  const data = load(dbPath);

  const agentId = opts.agentId || "unknown";
  const tool = opts.tool || "unknown";
  const sessionId = opts.sessionId || _inferSessionId();
  const original = Math.max(0, Math.floor(opts.originalTokens || 0));
  const compressed = Math.max(0, Math.floor(opts.compressedTokens || 0));
  const saved = original - compressed;

  if (saved <= 0) {
    return {
      event: { saved: 0, original, compressed },
      cumulative: data.cumulative,
    };
  }

  // Update cumulative
  data.cumulative.totalSaved += saved;
  data.cumulative.totalOriginal += original;
  data.cumulative.totalCompressed += compressed;

  // Per-tool
  if (!data.cumulative.byTool[tool]) {
    data.cumulative.byTool[tool] = { saved: 0, original: 0, compressed: 0, count: 0 };
  }
  data.cumulative.byTool[tool].saved += saved;
  data.cumulative.byTool[tool].original += original;
  data.cumulative.byTool[tool].compressed += compressed;
  data.cumulative.byTool[tool].count++;

  // Per-agent
  if (!data.cumulative.byAgent[agentId]) {
    data.cumulative.byAgent[agentId] = { saved: 0, count: 0 };
  }
  data.cumulative.byAgent[agentId].saved += saved;
  data.cumulative.byAgent[agentId].count++;

  // Session tracking
  if (!data.sessions[sessionId]) {
    data.sessions[sessionId] = { agentId, saved: 0, count: 0, startedAt: new Date().toISOString() };
  }
  data.sessions[sessionId].saved += saved;
  data.sessions[sessionId].count++;

  // History (keep last 100)
  const event = {
    timestamp: new Date().toISOString(),
    agentId,
    tool,
    sessionId,
    original,
    compressed,
    saved,
  };
  data.cumulative.history.push(event);
  if (data.cumulative.history.length > 100) {
    data.cumulative.history = data.cumulative.history.slice(-100);
  }

  save(dbPath, data);

  return { event, cumulative: data.cumulative };
}

/**
 * Get cumulative savings summary.
 * @param {string} projectRoot
 * @param {object} [opts] — { agentId, sessionId } for filtered view
 * @returns {object} savings summary
 */
function getSavings(projectRoot, opts = {}) {
  const dbPath = getDbPath(projectRoot);
  const data = load(dbPath);

  const c = data.cumulative;
  const ratio = c.totalOriginal > 0
    ? Math.round((c.totalSaved / c.totalOriginal) * 100)
    : 0;

  let result = {
    totalSaved: c.totalSaved,
    totalOriginal: c.totalOriginal,
    totalCompressed: c.totalCompressed,
    compressionRatio: `${ratio}%`,
    byTool: c.byTool,
    byAgent: c.byAgent,
    recentEvents: c.history.slice(-10),
  };

  if (opts.agentId && c.byAgent[opts.agentId]) {
    result.agent = c.byAgent[opts.agentId];
  }

  if (opts.sessionId && data.sessions[opts.sessionId]) {
    result.session = data.sessions[opts.sessionId];
  }

  return result;
}

/**
 * Get a compact savings summary suitable for injecting into agent context.
 * Format: "SimpleBeacon has saved ~12,450 tokens across 34 compression events (78% avg reduction)."
 */
function getSavingsBrief(projectRoot, agentId) {
  const s = getSavings(projectRoot, { agentId });
  if (s.totalSaved === 0) return null;

  const ratio = s.compressionRatio;
  const totalEvents = Object.values(s.byTool).reduce((sum, t) => sum + t.count, 0);
  const agentSaved = s.agent ? s.agent.saved : 0;

  let brief = `SimpleBeacon has saved ~${s.totalSaved.toLocaleString()} tokens across ${totalEvents} compression events (${ratio} avg reduction)`;
  if (agentSaved > 0 && agentSaved !== s.totalSaved) {
    brief += `; ~${agentSaved.toLocaleString()} saved for this agent`;
  }
  brief += ".";

  return brief;
}

let _sessionCounter = 0;
let _lastSessionTime = 0;
function _inferSessionId() {
  const now = Date.now();
  // New session if >30min since last activity
  if (now - _lastSessionTime > 30 * 60 * 1000) {
    _sessionCounter++;
  }
  _lastSessionTime = now;
  return `sess_${_sessionCounter}`;
}

module.exports = {
  estimateTokens,
  recordSavings,
  getSavings,
  getSavingsBrief,
  getDbPath,
};
