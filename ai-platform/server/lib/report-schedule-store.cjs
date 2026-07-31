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

function getAllSchedules() {
  const store = readStore();
  return store.schedules;
}

function getSchedule(id) {
  const store = readStore();
  return store.schedules[id] || null;
}

function setSchedule(id, config) {
  const store = readStore();
  store.schedules[id] = {
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
    lastRunAt: store.schedules[id]?.lastRunAt || null,
    lastRunStatus: store.schedules[id]?.lastRunStatus || null,
    lastRunError: store.schedules[id]?.lastRunError || null,
    createdAt: store.schedules[id]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.schedules[id];
}

function updateScheduleRunResult(id, status, error) {
  const store = readStore();
  if (store.schedules[id]) {
    store.schedules[id].lastRunAt = new Date().toISOString();
    store.schedules[id].lastRunStatus = status;
    store.schedules[id].lastRunError = error || null;
    writeStore(store);
  }
}

function deleteSchedule(id) {
  const store = readStore();
  delete store.schedules[id];
  writeStore(store);
}

module.exports = {
  getAllSchedules,
  getSchedule,
  setSchedule,
  deleteSchedule,
  updateScheduleRunResult,
};
