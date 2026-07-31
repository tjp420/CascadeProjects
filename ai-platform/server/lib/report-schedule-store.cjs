'use strict';

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'report-schedules.json');

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { schedules: {} };
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { schedules: {} };
  }
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function makeScheduleKey(orgId, id) {
  return orgId ? `${orgId}::${id}` : id;
}

function getAllSchedules(orgId) {
  const store = readStore();
  if (!orgId) return store.schedules;
  const scoped = {};
  for (const [key, val] of Object.entries(store.schedules)) {
    if (val.orgId === orgId) {
      const idKey = val.id || key;
      scoped[idKey] = val;
    }
  }
  return scoped;
}

function getSchedule(id, orgId) {
  const store = readStore();
  const key = makeScheduleKey(orgId, id);
  return store.schedules[key] || null;
}

function setSchedule(id, config, orgId) {
  const store = readStore();
  const key = makeScheduleKey(orgId, id);
  const existing = store.schedules[key];
  store.schedules[key] = {
    orgId: orgId || 'default',
    id,
    name: config.name || id,
    enabled: config.enabled !== false,
    frequency: config.frequency || 'weekly',
    dayOfWeek: config.dayOfWeek !== undefined ? config.dayOfWeek : 1,
    dayOfMonth: config.dayOfMonth !== undefined ? config.dayOfMonth : 1,
    hour: config.hour !== undefined ? config.hour : 8,
    minute: config.minute !== undefined ? config.minute : 0,
    format: config.format || 'csv',
    recipients: Array.isArray(config.recipients) ? config.recipients : [],
    filters: config.filters || {},
    lastRunAt: existing?.lastRunAt || null,
    lastRunStatus: existing?.lastRunStatus || null,
    lastRunError: existing?.lastRunError || null,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.schedules[key];
}

function updateScheduleRunResult(id, status, error, orgId) {
  const store = readStore();
  const key = makeScheduleKey(orgId, id);
  if (store.schedules[key]) {
    store.schedules[key].lastRunAt = new Date().toISOString();
    store.schedules[key].lastRunStatus = status;
    store.schedules[key].lastRunError = error || null;
    writeStore(store);
  }
}

function deleteSchedule(id, orgId) {
  const store = readStore();
  const key = makeScheduleKey(orgId, id);
  delete store.schedules[key];
  writeStore(store);
}

module.exports = {
  getAllSchedules,
  getSchedule,
  setSchedule,
  deleteSchedule,
  updateScheduleRunResult,
};
