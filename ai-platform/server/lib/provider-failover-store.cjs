'use strict';

/**
 * Provider Failover Store — High-availability state machine that
 * senses provider latencies or outages and dynamically re-routes
 * active prompt workloads to alternate provider availability zones.
 *
 * Features:
 *   - Per-provider circuit breaker state machine (closed, open, half-open)
 *   - Configurable failure thresholds, recovery timeouts, latency thresholds
 *   - Failover priority chains (e.g. openai → anthropic → ollama)
 *   - Health check pings with latency tracking
 *   - Automatic failover event recording with timestamps and context
 *   - Provider health scores based on success rate, avg latency, and
 *     circuit breaker state
 *   - Configurable per-provider cooldown and probe intervals
 *
 * @module provider-failover-store
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const SIMPLEBEACON_DIR = path.join(process.cwd(), '.simplebeacon');
const STORE_PATH = path.join(SIMPLEBEACON_DIR, 'provider-failover.json');

const PROVIDERS = ['openai', 'anthropic', 'ollama'];

const DEFAULT_CONFIG = {
  enabled: true,
  failoverChain: ['openai', 'anthropic', 'ollama'],
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeoutMs: 60000,
    halfOpenMaxProbes: 1,
  },
  latencyThresholdMs: 10000,
  healthCheckIntervalMs: 5 * 60 * 1000,
  healthCheckEnabled: false,
  cooldownMs: 30000,
};

// ── Provider State ──────────────────────────────────────────────────────────

const providerState = {};
for (const p of PROVIDERS) {
  providerState[p] = {
    circuitState: 'closed', // closed | open | half-open
    failures: 0,
    successes: 0,
    lastFailure: 0,
    lastSuccess: 0,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    avgLatencyMs: 0,
    latencyCount: 0,
    latencySum: 0,
    lastLatency: 0,
    totalRequests: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    totalFailovers: 0,
    openedAt: 0,
    probeInFlight: false,
  };
}

const failoverEvents = [];
const MAX_EVENTS = 200;

let _config = null;
let _cacheDirty = true;
let _healthTimer = null;

function readConfig() {
  if (!_cacheDirty) return _config;
  try {
    if (fs.existsSync(STORE_PATH)) {
      _config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) };
      _config.circuitBreaker = { ...DEFAULT_CONFIG.circuitBreaker, ...(_config.circuitBreaker || {}) };
    } else {
      _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  } catch {
    _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  _cacheDirty = false;
  return _config;
}

function writeConfig() {
  if (!fs.existsSync(SIMPLEBEACON_DIR)) fs.mkdirSync(SIMPLEBEACON_DIR, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_config, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  _cacheDirty = false;
}

// ── Circuit Breaker Logic ───────────────────────────────────────────────────

function getCircuitState(providerId) {
  const state = providerState[providerId];
  if (!state) return 'closed';
  const config = readConfig();

  if (state.circuitState === 'open') {
    const elapsed = Date.now() - state.lastFailure;
    if (elapsed >= config.circuitBreaker.recoveryTimeoutMs) {
      state.circuitState = 'half-open';
      state.probeInFlight = false;
      logger.info(`[ProviderFailover] ${providerId} circuit transitioning open → half-open`);
    }
  }

  return state.circuitState;
}

function isProviderAvailable(providerId) {
  const config = readConfig();
  if (!config.enabled) return true;

  const circuitState = getCircuitState(providerId);
  if (circuitState === 'open') return false;
  if (circuitState === 'half-open') {
    const state = providerState[providerId];
    if (state.probeInFlight) return false;
    state.probeInFlight = true;
  }
  return true;
}

function recordSuccess(providerId, latencyMs) {
  const state = providerState[providerId];
  if (!state) return;
  const config = readConfig();

  state.totalRequests++;
  state.totalSuccesses++;
  state.consecutiveSuccesses++;
  state.consecutiveFailures = 0;
  state.lastSuccess = Date.now();
  state.lastLatency = latencyMs || 0;
  state.latencySum += latencyMs || 0;
  state.latencyCount++;
  state.avgLatencyMs = Math.round(state.latencySum / state.latencyCount);

  if (state.circuitState === 'half-open') {
    state.circuitState = 'closed';
    state.failures = 0;
    state.probeInFlight = false;
    logger.info(`[ProviderFailover] ${providerId} circuit half-open → closed (probe succeeded)`);
  } else if (state.circuitState === 'closed') {
    state.failures = 0;
  }
}

function recordFailure(providerId, errorType) {
  const state = providerState[providerId];
  if (!state) return;
  const config = readConfig();

  state.totalRequests++;
  state.totalFailures++;
  state.consecutiveFailures++;
  state.consecutiveSuccesses = 0;
  state.lastFailure = Date.now();
  state.failures++;
  state.probeInFlight = false;

  if (state.failures >= config.circuitBreaker.failureThreshold) {
    if (state.circuitState !== 'open') {
      state.circuitState = 'open';
      state.openedAt = Date.now();
      logger.warn(`[ProviderFailover] ${providerId} circuit opened after ${state.failures} failures`);
    }
  }
}

function resetCircuit(providerId) {
  const state = providerState[providerId];
  if (!state) return;
  state.circuitState = 'closed';
  state.failures = 0;
  state.consecutiveFailures = 0;
  state.probeInFlight = false;
  logger.info(`[ProviderFailover] ${providerId} circuit manually reset`);
}

function resetAllCircuits() {
  for (const p of PROVIDERS) resetCircuit(p);
}

// ── Failover Selection ──────────────────────────────────────────────────────

function selectProvider(requestedProvider, options = {}) {
  const config = readConfig();
  if (!config.enabled) return { provider: requestedProvider, failover: false };

  // Build priority list: requested provider first, then failover chain
  const chain = [requestedProvider, ...config.failoverChain.filter((p) => p !== requestedProvider)];

  for (const providerId of chain) {
    if (!PROVIDERS.includes(providerId)) continue;
    if (isProviderAvailable(providerId)) {
      const state = providerState[providerId];
      const wasFailover = providerId !== requestedProvider;

      if (wasFailover) {
        state.totalFailovers++;
        recordFailoverEvent(requestedProvider, providerId, 'circuit_open');
      }

      return { provider: providerId, failover: wasFailover };
    }
  }

  // All providers unavailable — return requested as last resort
  return { provider: requestedProvider, failover: false, allUnavailable: true };
}

function recordFailoverEvent(fromProvider, toProvider, reason) {
  const event = {
    id: `fo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    fromProvider,
    toProvider,
    reason,
    fromCircuitState: providerState[fromProvider]?.circuitState || 'unknown',
    toCircuitState: providerState[toProvider]?.circuitState || 'unknown',
  };
  failoverEvents.push(event);
  if (failoverEvents.length > MAX_EVENTS) failoverEvents.shift();
  logger.info(`[ProviderFailover] Failover: ${fromProvider} → ${toProvider} (${reason})`);
}

// ── Health Check ────────────────────────────────────────────────────────────

async function pingProvider(providerId) {
  const start = Date.now();
  try {
    // Lightweight health check — just measure connection latency
    // Actual provider-specific health endpoints would go here
    const config = readConfig();
    let url;
    switch (providerId) {
      case 'openai':
        url = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        break;
      case 'anthropic':
        url = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
        break;
      case 'ollama':
        url = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
        break;
      default:
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    recordSuccess(providerId, latency);
    return { providerId, healthy: true, latencyMs: latency };
  } catch (err) {
    recordFailure(providerId, 'health_check');
    return { providerId, healthy: false, error: err.message };
  }
}

async function runHealthChecks() {
  const config = readConfig();
  if (!config.healthCheckEnabled) return;
  const results = await Promise.all(PROVIDERS.map((p) => pingProvider(p)));
  logger.info('[ProviderFailover] Health checks complete', results.map((r) => `${r.providerId}:${r.healthy ? 'ok' : 'fail'}`));
  return results;
}

function startHealthChecks() {
  const config = readConfig();
  if (!config.healthCheckEnabled) return;
  if (_healthTimer) clearInterval(_healthTimer);
  _healthTimer = setInterval(runHealthChecks, config.healthCheckIntervalMs);
  logger.info(`[ProviderFailover] Health check scheduler started (${config.healthCheckIntervalMs}ms)`);
}

function stopHealthChecks() {
  if (_healthTimer) {
    clearInterval(_healthTimer);
    _healthTimer = null;
    logger.info('[ProviderFailover] Health check scheduler stopped');
  }
}

function restartHealthChecks() {
  stopHealthChecks();
  startHealthChecks();
}

// ── Query Functions ─────────────────────────────────────────────────────────

function getProviderStatus(providerId) {
  const state = providerState[providerId];
  if (!state) return null;
  const config = readConfig();
  const circuitState = getCircuitState(providerId);
  const successRate = state.totalRequests > 0
    ? Math.round((state.totalSuccesses / state.totalRequests) * 10000) / 100
    : 100;

  let healthScore = 100;
  if (circuitState === 'open') healthScore = 0;
  else if (circuitState === 'half-open') healthScore = 50;
  else {
    healthScore = Math.max(0, successRate);
    if (state.avgLatencyMs > config.latencyThresholdMs) {
      healthScore = Math.max(0, healthScore - 30);
    }
    if (state.consecutiveFailures > 0) {
      healthScore = Math.max(0, healthScore - state.consecutiveFailures * 10);
    }
  }

  return {
    providerId,
    circuitState,
    healthScore,
    failures: state.failures,
    consecutiveFailures: state.consecutiveFailures,
    consecutiveSuccesses: state.consecutiveSuccesses,
    avgLatencyMs: state.avgLatencyMs,
    lastLatency: state.lastLatency,
    totalRequests: state.totalRequests,
    totalFailures: state.totalFailures,
    totalSuccesses: state.totalSuccesses,
    totalFailovers: state.totalFailovers,
    successRate,
    lastSuccess: state.lastSuccess ? new Date(state.lastSuccess).toISOString() : null,
    lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null,
    openedAt: state.openedAt ? new Date(state.openedAt).toISOString() : null,
  };
}

function getAllProviderStatuses() {
  return PROVIDERS.map((p) => getProviderStatus(p));
}

function getFailoverEvents(limit = 50) {
  return [...failoverEvents].reverse().slice(0, limit);
}

function getStats() {
  const statuses = getAllProviderStatuses();
  const config = readConfig();
  const totalFailovers = statuses.reduce((sum, s) => sum + s.totalFailovers, 0);
  const totalRequests = statuses.reduce((sum, s) => sum + s.totalRequests, 0);
  const openCircuits = statuses.filter((s) => s.circuitState === 'open').length;
  const halfOpenCircuits = statuses.filter((s) => s.circuitState === 'half-open').length;
  const healthyProviders = statuses.filter((s) => s.circuitState === 'closed').length;

  return {
    totalProviders: PROVIDERS.length,
    healthyProviders,
    openCircuits,
    halfOpenCircuits,
    totalFailovers,
    totalRequests,
    totalEvents: failoverEvents.length,
    failoverChain: config.failoverChain,
    enabled: config.enabled,
    healthCheckActive: !!_healthTimer,
  };
}

function getConfig() {
  return readConfig();
}

function updateConfig(updates) {
  const config = readConfig();
  if (updates.enabled !== undefined) config.enabled = updates.enabled;
  if (updates.failoverChain !== undefined) config.failoverChain = updates.failoverChain;
  if (updates.latencyThresholdMs !== undefined) config.latencyThresholdMs = updates.latencyThresholdMs;
  if (updates.healthCheckIntervalMs !== undefined) config.healthCheckIntervalMs = updates.healthCheckIntervalMs;
  if (updates.healthCheckEnabled !== undefined) config.healthCheckEnabled = updates.healthCheckEnabled;
  if (updates.cooldownMs !== undefined) config.cooldownMs = updates.cooldownMs;
  if (updates.circuitBreaker) {
    config.circuitBreaker = { ...config.circuitBreaker, ...updates.circuitBreaker };
  }
  writeConfig();
  if (updates.healthCheckEnabled !== undefined || updates.healthCheckIntervalMs !== undefined) {
    restartHealthChecks();
  }
  return { success: true, config };
}

function resetConfig() {
  _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  writeConfig();
  restartHealthChecks();
  return { success: true, config: _config };
}

function clearEvents() {
  failoverEvents.length = 0;
  return { success: true };
}

function resetStats() {
  for (const p of PROVIDERS) {
    providerState[p] = {
      circuitState: 'closed',
      failures: 0,
      successes: 0,
      lastFailure: 0,
      lastSuccess: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      avgLatencyMs: 0,
      latencyCount: 0,
      latencySum: 0,
      lastLatency: 0,
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalFailovers: 0,
      openedAt: 0,
      probeInFlight: false,
    };
  }
  failoverEvents.length = 0;
  return { success: true };
}

module.exports = {
  PROVIDERS,
  selectProvider,
  isProviderAvailable,
  recordSuccess,
  recordFailure,
  resetCircuit,
  resetAllCircuits,
  getCircuitState,
  getProviderStatus,
  getAllProviderStatuses,
  getFailoverEvents,
  getStats,
  getConfig,
  updateConfig,
  resetConfig,
  clearEvents,
  resetStats,
  runHealthChecks,
  startHealthChecks,
  stopHealthChecks,
  restartHealthChecks,
};
