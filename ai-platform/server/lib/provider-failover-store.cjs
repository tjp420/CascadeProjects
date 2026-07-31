'use strict';

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

const providerState = {};
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

function getCircuitState(providerId) {
  const state = providerState[providerId];
  if (!state) return 'closed';
  const config = readConfig();
  if (state.circuitState === 'open') {
    const elapsed = Date.now() - state.lastFailure;
    if (elapsed >= config.circuitBreaker.recoveryTimeoutMs) {
      state.circuitState = 'half-open';
      state.probeInFlight = false;
      logger.info('[ProviderFailover] ' + providerId + ' circuit transitioning open -> half-open');
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
    logger.info('[ProviderFailover] ' + providerId + ' circuit half-open -> closed (probe succeeded)');
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
      logger.warn('[ProviderFailover] ' + providerId + ' circuit opened after ' + state.failures + ' failures');
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
  logger.info('[ProviderFailover] ' + providerId + ' circuit manually reset');
}

function resetAllCircuits() {
  for (const p of PROVIDERS) resetCircuit(p);
}

function selectProvider(requestedProvider, options) {
  const config = readConfig();
  if (!config.enabled) return { provider: requestedProvider, failover: false };
  const chain = [requestedProvider].concat(config.failoverChain.filter(function (p) { return p !== requestedProvider; }));
  for (const providerId of chain) {
    if (!PROVIDERS.includes(providerId)) continue;
    if (isProviderAvailable(providerId)) {
      const state = providerState[providerId];
      var wasFailover = providerId !== requestedProvider;
      if (wasFailover) {
        state.totalFailovers++;
        recordFailoverEvent(requestedProvider, providerId, 'circuit_open');
      }
      return { provider: providerId, failover: wasFailover };
    }
  }
  return { provider: requestedProvider, failover: false, allUnavailable: true };
}

function recordFailoverEvent(fromProvider, toProvider, reason) {
  var event = {
    id: 'fo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
    timestamp: new Date().toISOString(),
    fromProvider: fromProvider,
    toProvider: toProvider,
    reason: reason,
    fromCircuitState: providerState[fromProvider] ? providerState[fromProvider].circuitState : 'unknown',
    toCircuitState: providerState[toProvider] ? providerState[toProvider].circuitState : 'unknown',
  };
  failoverEvents.push(event);
  if (failoverEvents.length > MAX_EVENTS) failoverEvents.shift();
  logger.info('[ProviderFailover] Failover: ' + fromProvider + ' -> ' + toProvider + ' (' + reason + ')');
}

async function pingProvider(providerId) {
  var start = Date.now();
  try {
    var url;
    switch (providerId) {
      case 'openai': url = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'; break;
      case 'anthropic': url = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'; break;
      case 'ollama': url = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'; break;
      default: return;
    }
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 5000);
    await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    var latency = Date.now() - start;
    recordSuccess(providerId, latency);
    return { providerId: providerId, healthy: true, latencyMs: latency };
  } catch (err) {
    recordFailure(providerId, 'health_check');
    return { providerId: providerId, healthy: false, error: err.message };
  }
}

async function runHealthChecks() {
  var config = readConfig();
  if (!config.healthCheckEnabled) return;
  var results = await Promise.all(PROVIDERS.map(function (p) { return pingProvider(p); }));
  logger.info('[ProviderFailover] Health checks complete');
  return results;
}

function startHealthChecks() {
  var config = readConfig();
  if (!config.healthCheckEnabled) return;
  if (_healthTimer) clearInterval(_healthTimer);
  _healthTimer = setInterval(runHealthChecks, config.healthCheckIntervalMs);
  logger.info('[ProviderFailover] Health check scheduler started (' + config.healthCheckIntervalMs + 'ms)');
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

function getProviderStatus(providerId) {
  var state = providerState[providerId];
  if (!state) return null;
  var config = readConfig();
  var circuitState = getCircuitState(providerId);
  var successRate = state.totalRequests > 0
    ? Math.round((state.totalSuccesses / state.totalRequests) * 10000) / 100
    : 100;
  var healthScore = 100;
  if (circuitState === 'open') healthScore = 0;
  else if (circuitState === 'half-open') healthScore = 50;
  else {
    healthScore = Math.max(0, successRate);
    if (state.avgLatencyMs > config.latencyThresholdMs) healthScore = Math.max(0, healthScore - 30);
    if (state.consecutiveFailures > 0) healthScore = Math.max(0, healthScore - state.consecutiveFailures * 10);
  }
  return {
    providerId: providerId,
    circuitState: circuitState,
    healthScore: healthScore,
    failures: state.failures,
    consecutiveFailures: state.consecutiveFailures,
    consecutiveSuccesses: state.consecutiveSuccesses,
    avgLatencyMs: state.avgLatencyMs,
    lastLatency: state.lastLatency,
    totalRequests: state.totalRequests,
    totalFailures: state.totalFailures,
    totalSuccesses: state.totalSuccesses,
    totalFailovers: state.totalFailovers,
    successRate: successRate,
    lastSuccess: state.lastSuccess ? new Date(state.lastSuccess).toISOString() : null,
    lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null,
    openedAt: state.openedAt ? new Date(state.openedAt).toISOString() : null,
  };
}

function getAllProviderStatuses() {
  return PROVIDERS.map(function (p) { return getProviderStatus(p); });
}

function getFailoverEvents(limit) {
  limit = limit || 50;
  return failoverEvents.slice().reverse().slice(0, limit);
}

function getStats() {
  var statuses = getAllProviderStatuses();
  var config = readConfig();
  var totalFailovers = statuses.reduce(function (sum, s) { return sum + s.totalFailovers; }, 0);
  var totalRequests = statuses.reduce(function (sum, s) { return sum + s.totalRequests; }, 0);
  var openCircuits = statuses.filter(function (s) { return s.circuitState === 'open'; }).length;
  var halfOpenCircuits = statuses.filter(function (s) { return s.circuitState === 'half-open'; }).length;
  var healthyProviders = statuses.filter(function (s) { return s.circuitState === 'closed'; }).length;
  return {
    totalProviders: PROVIDERS.length,
    healthyProviders: healthyProviders,
    openCircuits: openCircuits,
    halfOpenCircuits: halfOpenCircuits,
    totalFailovers: totalFailovers,
    totalRequests: totalRequests,
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
  var config = readConfig();
  if (updates.enabled !== undefined) config.enabled = updates.enabled;
  if (updates.failoverChain !== undefined) config.failoverChain = updates.failoverChain;
  if (updates.latencyThresholdMs !== undefined) config.latencyThresholdMs = updates.latencyThresholdMs;
  if (updates.healthCheckIntervalMs !== undefined) config.healthCheckIntervalMs = updates.healthCheckIntervalMs;
  if (updates.healthCheckEnabled !== undefined) config.healthCheckEnabled = updates.healthCheckEnabled;
  if (updates.cooldownMs !== undefined) config.cooldownMs = updates.cooldownMs;
  if (updates.circuitBreaker) {
    config.circuitBreaker = Object.assign({}, config.circuitBreaker, updates.circuitBreaker);
  }
  writeConfig();
  if (updates.healthCheckEnabled !== undefined || updates.healthCheckIntervalMs !== undefined) {
    restartHealthChecks();
  }
  return { success: true, config: config };
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
      circuitState: 'closed', failures: 0, successes: 0, lastFailure: 0,
      lastSuccess: 0, consecutiveFailures: 0, consecutiveSuccesses: 0,
      avgLatencyMs: 0, latencyCount: 0, latencySum: 0, lastLatency: 0,
      totalRequests: 0, totalFailures: 0, totalSuccesses: 0, totalFailovers: 0,
      openedAt: 0, probeInFlight: false,
    };
  }
  failoverEvents.length = 0;
  return { success: true };
}

module.exports = {
  PROVIDERS: PROVIDERS,
  selectProvider: selectProvider,
  isProviderAvailable: isProviderAvailable,
  recordSuccess: recordSuccess,
  recordFailure: recordFailure,
  resetCircuit: resetCircuit,
  resetAllCircuits: resetAllCircuits,
  getCircuitState: getCircuitState,
  getProviderStatus: getProviderStatus,
  getAllProviderStatuses: getAllProviderStatuses,
  getFailoverEvents: getFailoverEvents,
  getStats: getStats,
  getConfig: getConfig,
  updateConfig: updateConfig,
  resetConfig: resetConfig,
  clearEvents: clearEvents,
  resetStats: resetStats,
  runHealthChecks: runHealthChecks,
  startHealthChecks: startHealthChecks,
  stopHealthChecks: stopHealthChecks,
  restartHealthChecks: restartHealthChecks,
};
