/**
 * SimpleBeacon Runtime Sentinel — lightweight middleware for enforcing
 * per-request, per-minute, and per-hour AI API spend caps at runtime.
 *
 * Usage:
 *   const { createSentinelMiddleware, wrapLlmClient } = require('./runtime-sentinel');
 *   const middleware = await createSentinelMiddleware({ budgetConfigPath: './simplebeacon.budget.json' });
 *   app.use(middleware);
 *   const wrappedOpenAI = await wrapLlmClient(openai, { budgetConfig });
 */

const fs = require('fs');
const path = require('path');
const constants = require('./constants');
const { access, readFile } = fs.promises;

const DEFAULT_WINDOW_MS = 60 * constants.MS_PER_SECOND; // 1 minute
const DEFAULT_HOURLY_WINDOW_MS = 60 * constants.ONE_MINUTE_MS; // 1 hour
const DEFAULT_TOKEN_CAP = 4096;
const DEFAULT_RPM_CAP = 60;
const DEFAULT_MAX_MONTHLY_SPEND = 1000;

// In-memory counters (per-process; for multi-process use Redis or shared state)
const _counters = {
  minute: new Map(),
  hour: new Map(),
};

function _now() {
  return Date.now();
}

const _budgetCache = new Map();

async function _getBudget(baseDir) {
  const cacheKey = baseDir || process.cwd();
  if (_budgetCache.has(cacheKey)) {
    return _budgetCache.get(cacheKey);
  }

  const candidates = [
    path.join(baseDir, 'simplebeacon.budget.json'),
    path.join(baseDir, '.simplebeacon.budget.json'),
    path.join(process.cwd(), 'simplebeacon.budget.json'),
    path.join(process.cwd(), '.simplebeacon.budget.json'),
  ];
  for (const p of candidates) {
    try {
      await access(p);
      const budget = JSON.parse(await readFile(p, 'utf8'));
      _budgetCache.set(cacheKey, budget);
      return budget;
    } catch {
      // file doesn't exist or can't be parsed, try next
    }
  }
  _budgetCache.set(cacheKey, null);
  return null;
}

function _windowedCount(map, key, windowMs) {
  const now = _now();
  const entries = map.get(key) || [];
  const filtered = entries.filter((t) => now - t < windowMs);
  map.set(key, filtered);
  return filtered.length;
}

function _increment(map, key) {
  const entries = map.get(key) || [];
  entries.push(_now());
  map.set(key, entries);
}

function _makeViolation(type, message, metadata = {}) {
  return { type, message, timestamp: new Date().toISOString(), metadata };
}

function _checkBudget(budget, tokenCount, costEstimateCents) {
  const violations = [];
  const rpmKey = budget._rpmKey || 'default';

  if (budget.maxTokensPerRequest && tokenCount > budget.maxTokensPerRequest) {
    violations.push(
      _makeViolation(
        'TOKEN_CAP_EXCEEDED',
        `Request tokens (${tokenCount}) exceed per-request cap (${budget.maxTokensPerRequest})`,
        { tokenCount, cap: budget.maxTokensPerRequest }
      )
    );
  }

  const rpm = _windowedCount(_counters.minute, rpmKey, budget.minuteWindowMs || DEFAULT_WINDOW_MS);
  if (budget.maxRequestsPerMinute && rpm >= budget.maxRequestsPerMinute) {
    violations.push(
      _makeViolation(
        'RPM_CAP_EXCEEDED',
        `Requests per minute (${rpm}) exceed cap (${budget.maxRequestsPerMinute})`,
        { rpm, cap: budget.maxRequestsPerMinute }
      )
    );
  }

  if (costEstimateCents && budget.maxMonthlySpend) {
    const hourlySpendKey = budget._spendKey || 'default';
    const hourlyCost = _windowedCount(
      _counters.hour,
      hourlySpendKey,
      budget.hourlyWindowMs || DEFAULT_HOURLY_WINDOW_MS
    );
    const projectedMonthly = hourlyCost * 24 * 30;
    if (projectedMonthly >= budget.maxMonthlySpend * 100) {
      violations.push(
        _makeViolation(
          'SPEND_PROJECTION_EXCEEDED',
          `Projected monthly spend ($${projectedMonthly / 100}) exceeds cap ($${budget.maxMonthlySpend})`,
          { projectedMonthly: projectedMonthly / 100, cap: budget.maxMonthlySpend }
        )
      );
    }
  }

  return violations;
}

function _logEvent(event, options = {}) {
  if (options.onEvent) {
    options.onEvent(event);
  }
}

/**
 * Express/Fastify middleware that enforces budget caps on LLM API routes.
 */
async function createSentinelMiddleware(options = {}) {
  const budget = options.budgetConfig ||
    (await _getBudget(options.baseDir || process.cwd())) || {
      maxTokensPerRequest: options.maxTokensPerRequest || DEFAULT_TOKEN_CAP,
      maxRequestsPerMinute: options.maxRequestsPerMinute || DEFAULT_RPM_CAP,
      maxMonthlySpend: options.maxMonthlySpend || DEFAULT_MAX_MONTHLY_SPEND,
    };

  budget._rpmKey = options.rpmKey || 'global';
  budget._spendKey = options.spendKey || 'global';

  return function sentinelMiddleware(req, res, next) {
    // Only intercept known LLM route patterns
    const isLlmRoute = /\/v1\/(chat\/completions|embeddings|completions|messages)/.test(
      req.path || req.url || ''
    );
    if (!isLlmRoute) {
      return next ? next() : undefined;
    }

    const tokenCount =
      req.body?.max_tokens || req.body?.max_completion_tokens || req.body?.maxOutputTokens || 0;
    const violations = _checkBudget(budget, tokenCount, 0);

    if (violations.length) {
      violations.forEach((v) => _logEvent(v, options));
      if (res && res.status) {
        return res.status(429).json({
          error: 'budget_cap_exceeded',
          message: violations[0].message,
          violations,
        });
      }
      const err = new Error(violations[0].message);
      err.code = 'BUDGET_CAP_EXCEEDED';
      throw err;
    }

    _increment(_counters.minute, budget._rpmKey);
    if (next) next();
  };
}

/**
 * Wraps an LLM client (OpenAI, Anthropic, etc.) to enforce budget caps per call.
 */
async function wrapLlmClient(client, options = {}) {
  const budget = options.budgetConfig ||
    (await _getBudget(options.baseDir || process.cwd())) || {
      maxTokensPerRequest: options.maxTokensPerRequest || DEFAULT_TOKEN_CAP,
      maxRequestsPerMinute: options.maxRequestsPerMinute || DEFAULT_RPM_CAP,
      maxMonthlySpend: options.maxMonthlySpend || DEFAULT_MAX_MONTHLY_SPEND,
    };

  budget._rpmKey = options.rpmKey || 'client';
  budget._spendKey = options.spendKey || 'client';

  const proxy = new Proxy(client, {
    get(target, prop) {
      const orig = target[prop];
      if (typeof orig !== 'function') return orig;

      return function wrapped(...args) {
        const params = args[0] || {};
        const tokenCount =
          params.max_tokens || params.max_completion_tokens || params.maxOutputTokens || 0;
        const violations = _checkBudget(budget, tokenCount, 0);

        if (violations.length) {
          violations.forEach((v) => _logEvent(v, options));
          return Promise.reject(new Error(`[RuntimeSentinel] ${violations[0].message}`));
        }

        _increment(_counters.minute, budget._rpmKey);
        return orig.apply(target, args);
      };
    },
  });

  return proxy;
}

/**
 * Low-level check — useful inside LangChain callbacks or custom orchestrators.
 */
async function checkBudget(options = {}) {
  const budget = options.budgetConfig || (await _getBudget(options.baseDir || process.cwd())) || {};
  const tokenCount = options.tokenCount || 0;
  const costEstimateCents = options.costEstimateCents || 0;
  return _checkBudget(budget, tokenCount, costEstimateCents);
}

module.exports = {
  createSentinelMiddleware,
  wrapLlmClient,
  checkBudget,
  _getBudget,
  _windowedCount,
  _checkBudget,
};
