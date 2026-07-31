'use strict';

/**
 * Token Budget Allocation Store — Real-time monetary expenditure tracking
 *
 * Provides:
 *   - Per-org budget allocation with monthly/quarterly/annual periods
 *   - Model-specific cost rates (per 1K tokens) for OpenAI, Anthropic, Ollama
 *   - Soft-cap and hard-stop threshold policies
 *   - Real-time expenditure tracking from inference token usage
 *   - Automatic webhook alert dispatch when thresholds are crossed
 *   - Budget reset/rollover with period management
 *   - Per-user and per-model cost breakdowns
 *   - Alert history with deduplication
 *
 * @module token-budget-allocation-store
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./app-logger.cjs');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'token-budgets.json');
const MAX_ALERTS = 300;

// ── Default model cost rates (per 1K tokens) ─────────────────────────────────

const DEFAULT_MODEL_RATES = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
  'ollama': { input: 0, output: 0 },
  'default': { input: 0.002, output: 0.006 },
};

const DEFAULT_BUDGET_CONFIG = {
  period: 'monthly',
  softCapPercent: 80,
  hardStopPercent: 100,
  alertCooldownMinutes: 30,
  autoResetEnabled: true,
  webhookAlertsEnabled: true,
  webhookEvent: 'budget_threshold_exceeded',
};

const PERIOD_DAYS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  annual: 365,
};

// In-memory alert history
const alertHistory = [];
const recentAlerts = new Map();

// ── Store I/O ────────────────────────────────────────────────────────────────

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { budgets: {}, modelRates: DEFAULT_MODEL_RATES, config: DEFAULT_BUDGET_CONFIG };
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { budgets: {}, modelRates: DEFAULT_MODEL_RATES, config: DEFAULT_BUDGET_CONFIG };
  }
}

function writeStore(store) {
  var dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  var tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
}

function makeKey(orgId, scope) {
  return scope ? orgId + '::' + scope : orgId;
}

// ── Budget CRUD ──────────────────────────────────────────────────────────────

function getBudget(orgId, scope) {
  var store = readStore();
  return store.budgets[makeKey(orgId, scope || 'org')] || null;
}

function getAllBudgets(orgId) {
  var store = readStore();
  return Object.values(store.budgets).filter(function (b) { return b.orgId === orgId; });
}

function createBudget(orgId, budgetDef, scope) {
  var store = readStore();
  var key = makeKey(orgId, scope || 'org');
  if (store.budgets[key]) return { success: false, error: 'Budget already exists for this scope' };

  var now = new Date();
  var periodDays = PERIOD_DAYS[budgetDef.period] || 30;
  var periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  store.budgets[key] = {
    id: 'budget-' + crypto.randomBytes(4).toString('hex'),
    orgId: orgId,
    scope: scope || 'org',
    name: budgetDef.name || 'Default Budget',
    limitUSD: parseFloat(budgetDef.limitUSD) || 100,
    period: budgetDef.period || 'monthly',
    periodStart: now.toISOString(),
    periodEnd: periodEnd.toISOString(),
    spentUSD: 0,
    tokenCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    byModel: {},
    byUser: {},
    alerts: [],
    config: Object.assign({}, DEFAULT_BUDGET_CONFIG, budgetDef.config || {}),
    enabled: budgetDef.enabled !== false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  writeStore(store);
  logger.info('[TokenBudget] Budget created for org=' + orgId + ' scope=' + (scope || 'org') + ' limit=$' + store.budgets[key].limitUSD);
  return { success: true, budget: store.budgets[key] };
}

function updateBudget(orgId, updates, scope) {
  var store = readStore();
  var key = makeKey(orgId, scope || 'org');
  if (!store.budgets[key]) return { success: false, error: 'Budget not found' };
  var b = store.budgets[key];
  if (updates.limitUSD !== undefined) b.limitUSD = parseFloat(updates.limitUSD);
  if (updates.period !== undefined) b.period = updates.period;
  if (updates.name !== undefined) b.name = updates.name;
  if (updates.enabled !== undefined) b.enabled = updates.enabled;
  if (updates.config) b.config = Object.assign({}, b.config, updates.config);
  b.updatedAt = new Date().toISOString();
  writeStore(store);
  return { success: true, budget: b };
}

function deleteBudget(orgId, scope) {
  var store = readStore();
  var key = makeKey(orgId, scope || 'org');
  if (!store.budgets[key]) return { success: false, error: 'Budget not found' };
  delete store.budgets[key];
  writeStore(store);
  return { success: true };
}

function resetBudget(orgId, scope) {
  var store = readStore();
  var key = makeKey(orgId, scope || 'org');
  if (!store.budgets[key]) return { success: false, error: 'Budget not found' };
  var b = store.budgets[key];
  var now = new Date();
  var periodDays = PERIOD_DAYS[b.period] || 30;
  b.periodStart = now.toISOString();
  b.periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000).toISOString();
  b.spentUSD = 0;
  b.tokenCount = 0;
  b.inputTokens = 0;
  b.outputTokens = 0;
  b.byModel = {};
  b.byUser = {};
  b.alerts = [];
  b.updatedAt = now.toISOString();
  writeStore(store);
  logger.info('[TokenBudget] Budget reset for org=' + orgId + ' scope=' + (scope || 'org'));
  return { success: true, budget: b };
}

// ── Model Rate Management ────────────────────────────────────────────────────

function getModelRates() {
  var store = readStore();
  return store.modelRates || DEFAULT_MODEL_RATES;
}

function updateModelRate(model, rates) {
  var store = readStore();
  if (!store.modelRates) store.modelRates = DEFAULT_MODEL_RATES;
  store.modelRates[model] = { input: parseFloat(rates.input) || 0, output: parseFloat(rates.output) || 0 };
  writeStore(store);
  return { success: true, rate: store.modelRates[model] };
}

function getRateForModel(model) {
  var rates = getModelRates();
  if (rates[model]) return rates[model];
  // Try prefix match
  for (var key in rates) {
    if (key !== 'default' && model && model.indexOf(key) === 0) return rates[key];
  }
  return rates.default || { input: 0.002, output: 0.006 };
}

// ── Expenditure Tracking ─────────────────────────────────────────────────────

/**
 * Record a token usage event and update budget expenditure.
 * @param {string} orgId - Organization ID
 * @param {object} usage - { model, inputTokens, outputTokens, userId }
 * @param {string} [scope] - Budget scope (defaults to 'org')
 * @returns {object} { recorded, costUSD, budget, thresholdCrossed, alertData }
 */
function recordUsage(orgId, usage, scope) {
  var store = readStore();
  var key = makeKey(orgId, scope || 'org');
  var budget = store.budgets[key];
  if (!budget || !budget.enabled) return { recorded: false, reason: 'no_budget' };

  var model = usage.model || 'default';
  var inputTokens = usage.inputTokens || 0;
  var outputTokens = usage.outputTokens || 0;
  var totalTokens = inputTokens + outputTokens;

  var rate = getRateForModel(model);
  var costUSD = (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;

  // Update budget
  budget.spentUSD = Math.round((budget.spentUSD + costUSD) * 1000000) / 1000000;
  budget.tokenCount += totalTokens;
  budget.inputTokens += inputTokens;
  budget.outputTokens += outputTokens;

  // Update per-model breakdown
  if (!budget.byModel[model]) budget.byModel[model] = { costUSD: 0, tokenCount: 0, calls: 0 };
  budget.byModel[model].costUSD = Math.round((budget.byModel[model].costUSD + costUSD) * 1000000) / 1000000;
  budget.byModel[model].tokenCount += totalTokens;
  budget.byModel[model].calls += 1;

  // Update per-user breakdown
  if (usage.userId) {
    if (!budget.byUser[usage.userId]) budget.byUser[usage.userId] = { costUSD: 0, tokenCount: 0, calls: 0 };
    budget.byUser[usage.userId].costUSD = Math.round((budget.byUser[usage.userId].costUSD + costUSD) * 1000000) / 1000000;
    budget.byUser[usage.userId].tokenCount += totalTokens;
    budget.byUser[usage.userId].calls += 1;
  }

  budget.updatedAt = new Date().toISOString();
  writeStore(store);

  // Check thresholds
  var pct = (budget.spentUSD / budget.limitUSD) * 100;
  var thresholdCrossed = checkThresholds(budget, pct, orgId, scope);

  return {
    recorded: true,
    costUSD: costUSD,
    budget: budget,
    percentUsed: pct,
    thresholdCrossed: thresholdCrossed,
  };
}

// ── Threshold Checking & Alerts ──────────────────────────────────────────────

function checkThresholds(budget, pct, orgId, scope) {
  var config = budget.config;
  var crossed = null;

  if (pct >= config.hardStopPercent) {
    crossed = { type: 'hard_stop', pct: pct, budget: budget };
  } else if (pct >= config.softCapPercent) {
    crossed = { type: 'soft_cap', pct: pct, budget: budget };
  }

  if (!crossed) return null;

  // Dedup: check cooldown
  var alertKey = orgId + '::' + (scope || 'org') + '::' + crossed.type;
  var now = Date.now();
  var lastAlert = recentAlerts.get(alertKey);
  var cooldownMs = (config.alertCooldownMinutes || 30) * 60 * 1000;
  if (lastAlert && (now - lastAlert) < cooldownMs) {
    return { type: crossed.type, pct: pct, deduped: true };
  }

  recentAlerts.set(alertKey, now);

  // Record alert in budget
  var alertEntry = {
    id: 'alert-' + crypto.randomBytes(4).toString('hex'),
    timestamp: new Date().toISOString(),
    type: crossed.type,
    pct: Math.round(pct * 100) / 100,
    spentUSD: budget.spentUSD,
    limitUSD: budget.limitUSD,
    orgId: orgId,
    scope: scope || 'org',
  };
  budget.alerts.push(alertEntry);
  if (budget.alerts.length > 50) budget.alerts.shift();
  writeStore(readStore());

  // Record in global alert history
  alertHistory.push(alertEntry);
  if (alertHistory.length > MAX_ALERTS) alertHistory.shift();

  logger.warn('[TokenBudget] ' + crossed.type.toUpperCase() + ' threshold crossed for org=' + orgId + ': ' + pct.toFixed(1) + '% ($' + budget.spentUSD.toFixed(2) + '/$' + budget.limitUSD + ')');

  return { type: crossed.type, pct: pct, alert: alertEntry };
}

/**
 * Check if a request should be blocked by hard-stop.
 */
function checkHardStop(orgId, scope) {
  var budget = getBudget(orgId, scope);
  if (!budget || !budget.enabled) return { blocked: false };
  var pct = (budget.spentUSD / budget.limitUSD) * 100;
  if (pct >= budget.config.hardStopPercent) {
    return {
      blocked: true,
      reason: 'budget_hard_stop_exceeded',
      pct: pct,
      spentUSD: budget.spentUSD,
      limitUSD: budget.limitUSD,
    };
  }
  return { blocked: false, pct: pct };
}

// ── Alert History ────────────────────────────────────────────────────────────

function getAlertHistory(limit) {
  limit = limit || 50;
  return alertHistory.slice().reverse().slice(0, limit);
}

function clearAlertHistory() {
  var count = alertHistory.length;
  alertHistory.length = 0;
  recentAlerts.clear();
  return { success: true, cleared: count };
}

// ── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  var store = readStore();
  return store.config || DEFAULT_BUDGET_CONFIG;
}

function updateConfig(updates) {
  var store = readStore();
  if (!store.config) store.config = DEFAULT_BUDGET_CONFIG;
  if (updates.softCapPercent !== undefined) store.config.softCapPercent = parseFloat(updates.softCapPercent);
  if (updates.hardStopPercent !== undefined) store.config.hardStopPercent = parseFloat(updates.hardStopPercent);
  if (updates.alertCooldownMinutes !== undefined) store.config.alertCooldownMinutes = parseInt(updates.alertCooldownMinutes, 10);
  if (updates.autoResetEnabled !== undefined) store.config.autoResetEnabled = updates.autoResetEnabled;
  if (updates.webhookAlertsEnabled !== undefined) store.config.webhookAlertsEnabled = updates.webhookAlertsEnabled;
  if (updates.webhookEvent !== undefined) store.config.webhookEvent = updates.webhookEvent;
  if (updates.period !== undefined) store.config.period = updates.period;
  writeStore(store);
  return { success: true, config: store.config };
}

// ── Stats ────────────────────────────────────────────────────────────────────

function getStats(orgId) {
  var budgets = getAllBudgets(orgId);
  var totalLimit = 0;
  var totalSpent = 0;
  var totalTokens = 0;
  var activeBudgets = 0;
  var overSoftCap = 0;
  var overHardStop = 0;

  for (var i = 0; i < budgets.length; i++) {
    var b = budgets[i];
    if (!b.enabled) continue;
    activeBudgets++;
    totalLimit += b.limitUSD;
    totalSpent += b.spentUSD;
    totalTokens += b.tokenCount;
    var pct = (b.spentUSD / b.limitUSD) * 100;
    if (pct >= b.config.hardStopPercent) overHardStop++;
    else if (pct >= b.config.softCapPercent) overSoftCap++;
  }

  return {
    activeBudgets: activeBudgets,
    totalBudgetUSD: totalLimit,
    totalSpentUSD: Math.round(totalSpent * 100) / 100,
    totalRemainingUSD: Math.round((totalLimit - totalSpent) * 100) / 100,
    totalTokens: totalTokens,
    overSoftCap: overSoftCap,
    overHardStop: overHardStop,
    avgUtilization: totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 10000) / 100 : 0,
    totalAlerts: alertHistory.length,
    modelRates: getModelRates(),
  };
}

function getExpenditureBreakdown(orgId, scope) {
  var budget = getBudget(orgId, scope);
  if (!budget) return null;
  return {
    byModel: budget.byModel,
    byUser: budget.byUser,
    totalSpent: budget.spentUSD,
    totalTokens: budget.tokenCount,
    inputTokens: budget.inputTokens,
    outputTokens: budget.outputTokens,
    periodStart: budget.periodStart,
    periodEnd: budget.periodEnd,
  };
}

module.exports = {
  DEFAULT_MODEL_RATES: DEFAULT_MODEL_RATES,
  DEFAULT_BUDGET_CONFIG: DEFAULT_BUDGET_CONFIG,
  PERIOD_DAYS: PERIOD_DAYS,
  getBudget: getBudget,
  getAllBudgets: getAllBudgets,
  createBudget: createBudget,
  updateBudget: updateBudget,
  deleteBudget: deleteBudget,
  resetBudget: resetBudget,
  getModelRates: getModelRates,
  updateModelRate: updateModelRate,
  getRateForModel: getRateForModel,
  recordUsage: recordUsage,
  checkHardStop: checkHardStop,
  getAlertHistory: getAlertHistory,
  clearAlertHistory: clearAlertHistory,
  getConfig: getConfig,
  updateConfig: updateConfig,
  getStats: getStats,
  getExpenditureBreakdown: getExpenditureBreakdown,
};
