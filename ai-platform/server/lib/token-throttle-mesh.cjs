'use strict';

/**
 * Real-Time Token-Throttling Backpressure Mesh
 *
 * Tracks per-organization, per-provider token-per-minute (TPM) and
 * request-per-minute (RPM) consumption. When an external LLM provider is
 * at risk of being rate-limited, requests are queued and delayed until a
 * window slot is available.
 *
 * @module token-throttle-mesh
 */

const logger = require('./app-logger.cjs');

const WINDOW_MS = parseInt(process.env.TOKEN_THROTTLE_WINDOW_MS, 10) || 60 * 1000;
const DEFAULT_RPM = parseInt(process.env.DEFAULT_LLM_RPM, 10) || 0;
const DEFAULT_TPM = parseInt(process.env.DEFAULT_LLM_TPM, 10) || 0;
const MAX_BACKPRESSURE_MS = parseInt(process.env.MAX_BACKPRESSURE_MS, 10) || 30 * 1000;

const state = new Map();

function key(orgId, provider) {
  return `${orgId}:${provider}`;
}

function getOrCreateState(orgId, provider) {
  const k = key(orgId, provider);
  if (!state.has(k)) {
    state.set(k, {
      orgId,
      provider,
      rpm: DEFAULT_RPM,
      tpm: DEFAULT_TPM,
      requestTimestamps: [],
      tokenTimestamps: [],
      queue: [],
      pumping: false,
    });
  }
  return state.get(k);
}

function now() {
  return Date.now();
}

function cleanWindow(s) {
  const cutoff = now() - WINDOW_MS;
  s.requestTimestamps = s.requestTimestamps.filter((t) => t >= cutoff);
  s.tokenTimestamps = s.tokenTimestamps.filter(({ ts }) => ts >= cutoff);
}

function tokenCount(s) {
  return s.tokenTimestamps.reduce((acc, { tokens }) => acc + tokens, 0);
}

function canProceed(s, estimatedTokens) {
  if (s.rpm <= 0 && s.tpm <= 0) return { allowed: true, retryAfterMs: 0 };

  cleanWindow(s);

  const rpmOk = s.rpm <= 0 || s.requestTimestamps.length < s.rpm;
  const tpmOk = s.tpm <= 0 || (tokenCount(s) + estimatedTokens) <= s.tpm;

  if (rpmOk && tpmOk) return { allowed: true, retryAfterMs: 0 };

  // Calculate when the earliest item in the combined window will expire
  const oldest = Math.min(
    s.requestTimestamps[0] || Number.MAX_SAFE_INTEGER,
    (s.tokenTimestamps[0] && s.tokenTimestamps[0].ts) || Number.MAX_SAFE_INTEGER,
  );
  const retryAfterMs = Math.max(0, (oldest + WINDOW_MS) - now());
  return { allowed: false, retryAfterMs };
}

function recordUsage(s, estimatedTokens) {
  const ts = now();
  s.requestTimestamps.push(ts);
  s.tokenTimestamps.push({ ts, tokens: estimatedTokens });
}

function setLimits(orgId, provider, limits) {
  const s = getOrCreateState(orgId, provider);
  if (typeof limits.rpm === 'number' && Number.isFinite(limits.rpm)) s.rpm = limits.rpm;
  if (typeof limits.tpm === 'number' && Number.isFinite(limits.tpm)) s.tpm = limits.tpm;
  if (!s.pumping) pumpQueue(s);
  return { orgId, provider, rpm: s.rpm, tpm: s.tpm };
}

function getStatus(orgId, provider) {
  const s = getOrCreateState(orgId, provider);
  cleanWindow(s);
  return {
    orgId,
    provider,
    limitRpm: s.rpm,
    limitTpm: s.tpm,
    currentRpm: s.requestTimestamps.length,
    currentTpm: tokenCount(s),
    queueDepth: s.queue.length,
    throttlingEnabled: s.rpm > 0 || s.tpm > 0,
  };
}

function reset(orgId, provider) {
  const k = key(orgId, provider);
  if (!state.has(k)) return { orgId, provider, cleared: false };
  const s = state.get(k);
  s.requestTimestamps = [];
  s.tokenTimestamps = [];
  s.rpm = 0;
  s.tpm = 0;
  s.queue.forEach((item) => item.reject(new Error('Throttling state reset')));
  s.queue = [];
  return { orgId, provider, cleared: true };
}

async function pumpQueue(s) {
  if (s.pumping) return;
  s.pumping = true;

  while (s.queue.length > 0) {
    const next = s.queue[0];
    const estimated = typeof next.estimatedTokens === 'number' && next.estimatedTokens > 0
      ? next.estimatedTokens : 1;
    const { allowed, retryAfterMs } = canProceed(s, estimated);

    if (allowed) {
      recordUsage(s, estimated);
      s.queue.shift();
      s.pumping = false;
      try {
        const result = await next.fn();
        next.resolve(result);
      } catch (err) {
        next.reject(err);
      }
      s.pumping = false;
      // Resume pumping for the next item
      return pumpQueue(s);
    }

    const totalWait = now() - next.enqueuedAt;
    if (totalWait + retryAfterMs > next.timeoutMs) {
      s.queue.shift();
      next.reject(new Error(`Throttling timeout; retry after ${retryAfterMs}ms`));
      continue;
    }

    if (retryAfterMs <= 0) {
      // No headroom at all — remove head and reject
      s.queue.shift();
      next.reject(new Error('Throttling limits exceeded'));
      continue;
    }

    s.pumping = false;
    await sleep(retryAfterMs);
    return pumpQueue(s);
  }

  s.pumping = false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throttleRequest({ orgId, provider, estimatedTokens, timeoutMs = MAX_BACKPRESSURE_MS, fn }) {
  return new Promise((resolve, reject) => {
    const s = getOrCreateState(orgId, provider);
    s.queue.push({
      orgId,
      provider,
      estimatedTokens,
      timeoutMs,
      fn,
      resolve,
      reject,
      enqueuedAt: now(),
    });
    logger.info('[TokenThrottle] queued', { orgId, provider, estimatedTokens, queueDepth: s.queue.length });
    pumpQueue(s).catch((err) => logger.error('[TokenThrottle] pumpQueue error', err));
  });
}

module.exports = {
  setLimits,
  getStatus,
  reset,
  throttleRequest,
};
