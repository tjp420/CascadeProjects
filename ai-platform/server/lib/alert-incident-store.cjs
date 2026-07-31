'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'alert-incidents.json');
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

function recordIncident(params) {
  const store = readStore();
  const id = `alt-${crypto.randomBytes(6).toString('hex')}`;
  const orgId = params.orgId || 'default';

  const incident = {
    id,
    orgId,
    timestamp: new Date().toISOString(),
    ruleId: params.ruleId || '',
    ruleName: params.ruleName || '',
    eventType: params.eventType || '',
    destinationType: params.destinationType || 'webhook',
    destination: params.destination || {},
    payload: (params.payload || {}).slice
      ? params.payload
      : JSON.stringify(params.payload || {}).slice(0, 1000),
    status: params.status || 'pending',
    attempts: params.attempts || 0,
    responseStatus: params.responseStatus || null,
    responseBody: params.responseBody ? String(params.responseBody).slice(0, 500) : '',
    error: params.error || '',
    durationMs: params.durationMs || 0,
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

function query(filters) {
  const store = readStore();
  const orgId = filters.orgId || 'default';
  let incidents = Object.values(store.incidents).filter((i) => i.orgId === orgId);

  if (filters.status) incidents = incidents.filter((i) => i.status === filters.status);
  if (filters.eventType) incidents = incidents.filter((i) => i.eventType === filters.eventType);
  if (filters.ruleId) incidents = incidents.filter((i) => i.ruleId === filters.ruleId);

  incidents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = incidents.length;
  const limit = Math.min(filters.limit || 100, 500);
  const offset = Math.max(filters.offset || 0, 0);
  incidents = incidents.slice(offset, offset + limit);

  return { incidents, total, limit, offset };
}

function getStats(orgId) {
  const store = readStore();
  const scoped = Object.values(store.incidents).filter((i) => i.orgId === (orgId || 'default'));
  const byStatus = { delivered: 0, failed: 0, pending: 0 };
  const byEventType = {};
  const byDestination = {};

  for (const i of scoped) {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    byEventType[i.eventType] = (byEventType[i.eventType] || 0) + 1;
    byDestination[i.destinationType] = (byDestination[i.destinationType] || 0) + 1;
  }

  return {
    total: scoped.length,
    byStatus,
    byEventType,
    byDestination,
    deliveredCount: byStatus.delivered || 0,
    failedCount: byStatus.failed || 0,
  };
}

module.exports = {
  recordIncident,
  query,
  getStats,
};
