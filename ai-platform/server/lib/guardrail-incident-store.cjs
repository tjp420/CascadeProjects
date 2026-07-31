'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'guardrail-incidents.json');
const MAX_INCIDENTS_PER_ORG = 500;

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { incidents: {} };
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { incidents: {} };
  }
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function makeKey(orgId, id) {
  return orgId ? `${orgId}::${id}` : id;
}

/**
 * Record a guardrail incident.
 * @param {object} params
 * @returns {object} The recorded incident
 */
function recordIncident(params) {
  const store = readStore();
  const id = `gdi-${crypto.randomBytes(6).toString('hex')}`;
  const orgId = params.orgId || 'default';

  const incident = {
    id,
    orgId,
    timestamp: new Date().toISOString(),
    actorId: params.actorId || 'unknown',
    actorEmail: params.actorEmail || 'unknown',
    verdict: params.verdict || 'allow',
    endpoint: params.endpoint || '',
    provider: params.provider || '',
    matches: params.matches || [],
    summary: params.summary || '',
    originalTextSnippet: (params.originalText || '').slice(0, 500),
    scrubbedTextSnippet: (params.scrubbedText || '').slice(0, 500),
  };

  const key = makeKey(orgId, id);
  store.incidents[key] = incident;

  // Prune
  const orgIncidents = Object.entries(store.incidents)
    .filter(([, v]) => v.orgId === orgId)
    .sort((a, b) => b[1].timestamp.localeCompare(a[1].timestamp));
  if (orgIncidents.length > MAX_INCIDENTS_PER_ORG) {
    for (const [k] of orgIncidents.slice(MAX_INCIDENTS_PER_ORG)) {
      delete store.incidents[k];
    }
  }

  writeStore(store);
  return incident;
}

/**
 * Query incidents with filters.
 */
function query(filters) {
  const store = readStore();
  const orgId = filters.orgId || 'default';
  let incidents = Object.values(store.incidents).filter(i => i.orgId === orgId);

  if (filters.verdict) incidents = incidents.filter(i => i.verdict === filters.verdict);
  if (filters.provider) incidents = incidents.filter(i => i.provider === filters.provider);
  if (filters.actorId) incidents = incidents.filter(i => i.actorId === filters.actorId);
  if (filters.startDate) incidents = incidents.filter(i => i.timestamp >= filters.startDate);
  if (filters.endDate) incidents = incidents.filter(i => i.timestamp <= filters.endDate);

  incidents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = incidents.length;
  const limit = Math.min(filters.limit || 100, 500);
  const offset = Math.max(filters.offset || 0, 0);
  incidents = incidents.slice(offset, offset + limit);

  return { incidents, total, limit, offset };
}

/**
 * Get aggregate stats for an org.
 */
function getStats(orgId) {
  const store = readStore();
  const scoped = Object.values(store.incidents).filter(i => i.orgId === (orgId || 'default'));
  const byVerdict = { allow: 0, scrub: 0, block: 0 };
  const byProvider = {};
  const byMatchType = {};

  for (const i of scoped) {
    byVerdict[i.verdict] = (byVerdict[i.verdict] || 0) + 1;
    byProvider[i.provider] = (byProvider[i.provider] || 0) + 1;
    for (const m of (i.matches || [])) {
      byMatchType[m.type] = (byMatchType[m.type] || 0) + 1;
    }
  }

  return {
    total: scoped.length,
    byVerdict,
    byProvider,
    byMatchType,
    blockedCount: byVerdict.block || 0,
    scrubbedCount: byVerdict.scrub || 0,
    allowedWithWarnings: byVerdict.allow || 0,
  };
}

module.exports = {
  recordIncident,
  query,
  getStats,
};
