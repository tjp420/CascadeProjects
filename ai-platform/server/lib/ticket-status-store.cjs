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

function markTicketed(scanId, category, ticketRef, ticketTarget) {
  const store = readStore();
  const key = makeKey(scanId, category);
  store.tickets[key] = {
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

function unmarkTicketed(scanId, category) {
  const store = readStore();
  const key = makeKey(scanId, category);
  delete store.tickets[key];
  writeStore(store);
  return { scanId, category, status: 'unticketed' };
}

function getTicketStatus(scanId, category) {
  const store = readStore();
  const key = makeKey(scanId, category);
  return store.tickets[key] || null;
}

function getAllTicketStatuses() {
  const store = readStore();
  return store.tickets;
}

function getTicketedKeys() {
  const store = readStore();
  return new Set(Object.keys(store.tickets));
}

module.exports = {
  markTicketed,
  unmarkTicketed,
  getTicketStatus,
  getAllTicketStatuses,
  getTicketedKeys,
};
