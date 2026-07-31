'use strict';

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'ticket-status.json');

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { tickets: {} };
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { tickets: {} };
  }
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function makeKey(scanId, category) {
  return `${scanId}::${category}`;
}

function makeOrgKey(orgId, scanId, category) {
  return `${orgId}::${scanId}::${category}`;
}

// ── Org-scoped operations (multi-tenant) ────────────────────────────

function markTicketed(scanId, category, ticketRef, ticketTarget, orgId) {
  const store = readStore();
  const key = orgId ? makeOrgKey(orgId, scanId, category) : makeKey(scanId, category);
  store.tickets[key] = {
    orgId: orgId || 'default',
    scanId,
    category,
    ticketRef,
    ticketTarget: ticketTarget || 'jira',
    status: 'ticketed',
    markedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.tickets[key];
}

function unmarkTicketed(scanId, category, orgId) {
  const store = readStore();
  const key = orgId ? makeOrgKey(orgId, scanId, category) : makeKey(scanId, category);
  delete store.tickets[key];
  writeStore(store);
  return { scanId, category, status: 'unticketed' };
}

function getTicketStatus(scanId, category, orgId) {
  const store = readStore();
  const key = orgId ? makeOrgKey(orgId, scanId, category) : makeKey(scanId, category);
  return store.tickets[key] || null;
}

function getAllTicketStatuses(orgId) {
  const store = readStore();
  if (!orgId) return store.tickets;
  const scoped = {};
  for (const [key, val] of Object.entries(store.tickets)) {
    if (val.orgId === orgId) scoped[key] = val;
  }
  return scoped;
}

function getTicketedKeys(orgId) {
  const store = readStore();
  if (!orgId) return new Set(Object.keys(store.tickets));
  const keys = new Set();
  for (const [key, val] of Object.entries(store.tickets)) {
    if (val.orgId === orgId) keys.add(key);
  }
  return keys;
}

// Backward-compatible key builder for org-scoped lookups in route handlers
function buildTicketKey(orgId, scanId, category) {
  return orgId ? makeOrgKey(orgId, scanId, category) : makeKey(scanId, category);
}

module.exports = {
  markTicketed,
  unmarkTicketed,
  getTicketStatus,
  getAllTicketStatuses,
  getTicketedKeys,
  buildTicketKey,
};
