"use strict";
/**
 * SimpleBeacon Cache + Escalation Manager
 *
 * 1. Response cache — LRU keyed by (file-hash, prompt-hash) to avoid
 *    repeated token spend on identical contexts.
 * 2. Escalation manager — when the local brain cannot resolve a task
 *    within N attempts, produces a focused escalation prompt for a
 *    larger remote model with only the distilled context + reasoning trace.
 */

const crypto = require("crypto");

// ─── Response Cache (LRU) ───────────────────────────────────────────────────

const MAX_CACHE_SIZE = 500;
const cache = new Map();

/**
 * Generate a cache key from file hashes + prompt content.
 * @param {string[]} filePaths
 * @param {string} prompt
 * @returns {string}
 */
function cacheKey(filePaths, prompt) {
  const pathStr = (filePaths || []).sort().join("|");
  const promptHash = crypto
    .createHash("sha256")
    .update(prompt)
    .digest("hex")
    .slice(0, 16);
  const pathHash = crypto
    .createHash("sha256")
    .update(pathStr)
    .digest("hex")
    .slice(0, 16);
  return `${pathHash}:${promptHash}`;
}

/**
 * Get a cached response.
 * @param {string} key
 * @returns {object|null}
 */
function getCached(key) {
  if (!cache.has(key)) return null;
  const value = cache.get(key);
  // LRU: move to end (most recently used)
  cache.delete(key);
  cache.set(key, value);
  return value;
}

/**
 * Store a response in the cache.
 * @param {string} key
 * @param {object} response
 */
function setCached(key, response) {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry (first in Map)
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, response);
}

/**
 * Get cache stats.
 */
function getCacheStats() {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: cacheHits / Math.max(cacheLookups, 1),
  };
}

let cacheHits = 0;
let cacheLookups = 0;

/**
 * Try to get a cached response, tracking hit/miss stats.
 */
function tryCache(filePaths, prompt) {
  cacheLookups++;
  const key = cacheKey(filePaths, prompt);
  const cached = getCached(key);
  if (cached) {
    cacheHits++;
    return { hit: true, key, response: cached };
  }
  return { hit: false, key };
}

/**
 * Store a response in cache.
 */
function storeCache(key, response) {
  setCached(key, response);
}

// ─── Escalation Manager ─────────────────────────────────────────────────────

const escalationLog = [];
const MAX_ESCALATION_LOG = 100;

/**
 * Build a focused escalation prompt for a remote model.
 * Includes only the distilled context + the local brain's reasoning trace.
 *
 * @param {object} params
 * @param {string} params.intent — original task
 * @param {string} params.summaryText — compact file summaries
 * @param {string[]} params.attemptedPatches — patches the local model tried
 * @param {string} params.lastTestOutput — last test failure output
 * @param {string} params.reasoningTrace — local brain's reasoning
 * @returns {string}
 */
function buildEscalationPrompt(params) {
  const parts = [];

  parts.push("# Escalation: Local model could not resolve this task");
  parts.push("");
  parts.push(`## Original intent`);
  parts.push(params.intent);
  parts.push("");

  parts.push("## Context (compact summaries)");
  parts.push(params.summaryText || "(no summaries provided)");
  parts.push("");

  if (params.attemptedPatches && params.attemptedPatches.length > 0) {
    parts.push(`## Previous attempts (${params.attemptedPatches.length})`);
    params.attemptedPatches.forEach((patch, i) => {
      parts.push(`### Attempt ${i + 1}`);
      parts.push("```diff");
      parts.push(patch.slice(0, 500)); // truncate to save tokens
      parts.push("```");
    });
    parts.push("");
  }

  if (params.lastTestOutput) {
    parts.push("## Last test output (truncated)");
    parts.push("```");
    parts.push(params.lastTestOutput.slice(-2000)); // last 2k chars
    parts.push("```");
    parts.push("");
  }

  if (params.reasoningTrace) {
    parts.push("## Local model reasoning trace");
    parts.push(params.reasoningTrace.slice(0, 1000));
    parts.push("");
  }

  parts.push("## Request");
  parts.push(
    "Provide a minimal patch that resolves the task. Use unified diff format.",
  );
  parts.push(
    "Include file path and line numbers. Do not modify unrelated code.",
  );

  return parts.join("\n");
}

/**
 * Log an escalation event.
 */
function logEscalation(entry) {
  const record = {
    timestamp: new Date().toISOString(),
    intent: entry.intent,
    attempts: entry.attempts || 0,
    model: entry.model || "unknown",
    tokensUsed: entry.tokensUsed || 0,
    success: entry.success || false,
  };
  escalationLog.push(record);
  if (escalationLog.length > MAX_ESCALATION_LOG) escalationLog.shift();
  return record;
}

/**
 * Get escalation summary stats.
 */
function getEscalationSummary() {
  if (escalationLog.length === 0) {
    return {
      totalEscalations: 0,
      successRate: 0,
      avgAttempts: 0,
      avgTokens: 0,
    };
  }
  const total = escalationLog.length;
  const successes = escalationLog.filter((e) => e.success).length;
  const totalAttempts = escalationLog.reduce((s, e) => s + e.attempts, 0);
  const totalTokens = escalationLog.reduce((s, e) => s + e.tokensUsed, 0);
  return {
    totalEscalations: total,
    successRate: successes / total,
    avgAttempts: Math.round((totalAttempts / total) * 10) / 10,
    avgTokens: Math.round(totalTokens / total),
    recent: escalationLog.slice(-10),
  };
}

/**
 * Determine if a task should be escalated based on attempt history.
 * @param {object} params — { attempts, maxAttempts, lastError, taskComplexity }
 * @returns {boolean}
 */
function shouldEscalate(params) {
  const attempts = params.attempts || 0;
  const maxAttempts = params.maxAttempts || 3;
  const complexity = params.taskComplexity || "medium";

  // Always escalate if we've hit max attempts
  if (attempts >= maxAttempts) return true;

  // Escalate early for complex tasks
  if (complexity === "high" && attempts >= 1) return true;

  // Escalate if the error suggests the local model is stuck
  if (
    params.lastError &&
    /syntax error|parse error|unexpected token/i.test(params.lastError)
  ) {
    return attempts >= 2;
  }

  return false;
}

module.exports = {
  // Cache
  cacheKey,
  tryCache,
  storeCache,
  getCacheStats,
  getCached,
  setCached,
  // Escalation
  buildEscalationPrompt,
  logEscalation,
  getEscalationSummary,
  shouldEscalate,
};
