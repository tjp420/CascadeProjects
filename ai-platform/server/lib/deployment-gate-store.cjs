"use strict";

const fs = require("fs");
const path = require("path");

const STORE_PATH = path.join(
  process.cwd(),
  ".simplebeacon",
  "deployment-gates.json",
);

const DEFAULT_POLICY = {
  minPostureScore: 70,
  maxCritical: 0,
  maxHigh: 5,
  maxMedium: 20,
  maxLow: 50,
  blockOnGateFail: true,
  blockOnSlaBreached: false,
  blockOnUnticketedCritical: false,
};

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { policies: {}, history: {} };
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { policies: {}, history: {} };
  }
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function makePolicyKey(orgId) {
  return orgId || "default";
}

function makeHistoryKey(orgId, id) {
  return orgId ? `${orgId}::${id}` : id;
}

// ── Policy CRUD ─────────────────────────────────────────────────────────────

function getPolicy(orgId) {
  const store = readStore();
  const key = makePolicyKey(orgId);
  if (store.policies[key]) return store.policies[key];
  return {
    ...DEFAULT_POLICY,
    orgId: key,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function setPolicy(orgId, config) {
  const store = readStore();
  const key = makePolicyKey(orgId);
  const existing = store.policies[key];
  store.policies[key] = {
    orgId: key,
    minPostureScore:
      config.minPostureScore !== undefined
        ? config.minPostureScore
        : DEFAULT_POLICY.minPostureScore,
    maxCritical:
      config.maxCritical !== undefined
        ? config.maxCritical
        : DEFAULT_POLICY.maxCritical,
    maxHigh:
      config.maxHigh !== undefined ? config.maxHigh : DEFAULT_POLICY.maxHigh,
    maxMedium:
      config.maxMedium !== undefined
        ? config.maxMedium
        : DEFAULT_POLICY.maxMedium,
    maxLow: config.maxLow !== undefined ? config.maxLow : DEFAULT_POLICY.maxLow,
    blockOnGateFail:
      config.blockOnGateFail !== undefined
        ? config.blockOnGateFail
        : DEFAULT_POLICY.blockOnGateFail,
    blockOnSlaBreached:
      config.blockOnSlaBreached !== undefined
        ? config.blockOnSlaBreached
        : DEFAULT_POLICY.blockOnSlaBreached,
    blockOnUnticketedCritical:
      config.blockOnUnticketedCritical !== undefined
        ? config.blockOnUnticketedCritical
        : DEFAULT_POLICY.blockOnUnticketedCritical,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.policies[key];
}

// ── Evaluation History ──────────────────────────────────────────────────────

function getHistory(orgId, limit) {
  const store = readStore();
  const scoped = [];
  for (const [key, val] of Object.entries(store.history || {})) {
    if (val.orgId === (orgId || "default")) scoped.push(val);
  }
  scoped.sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
  const max = limit || 50;
  return scoped.slice(0, max);
}

function recordEvaluation(orgId, result) {
  const store = readStore();
  if (!store.history) store.history = {};
  const id = result.evaluationId;
  const key = makeHistoryKey(orgId, id);
  store.history[key] = {
    orgId: orgId || "default",
    evaluationId: id,
    pass: result.pass,
    failures: result.failures || [],
    scanId: result.scan?.scanId || null,
    repository: result.scan?.repository || null,
    branch: result.scan?.branch || null,
    commitSha: result.scan?.commitSha || null,
    postureScore: result.scan?.postureScore ?? null,
    gateStatus: result.scan?.gateStatus ?? null,
    triggeredBy: result.triggeredBy || null,
    evaluatedAt: result.evaluatedAt,
  };
  // Cap history at 500 entries per org
  const orgEntries = Object.entries(store.history)
    .filter(([, v]) => v.orgId === (orgId || "default"))
    .sort((a, b) => b[1].evaluatedAt.localeCompare(a[1].evaluatedAt));
  if (orgEntries.length > 500) {
    for (const [k] of orgEntries.slice(500)) {
      delete store.history[k];
    }
  }
  writeStore(store);
}

module.exports = {
  DEFAULT_POLICY,
  getPolicy,
  setPolicy,
  getHistory,
  recordEvaluation,
};
