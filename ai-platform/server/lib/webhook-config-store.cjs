'use strict';

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'webhook-configs.json');

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { configs: {} };
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { configs: {} };
  }
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function getConfig(target) {
  const store = readStore();
  return store.configs[target] || null;
}

function getAllConfigs() {
  const store = readStore();
  return store.configs;
}

function setConfig(target, config) {
  const store = readStore();
  store.configs[target] = {
    target,
    apiUrl: config.apiUrl || '',
    authToken: config.authToken || '',
    projectKey: config.projectKey || '',
    teamId: config.teamId || '',
    repoOwner: config.repoOwner || '',
    repoName: config.repoName || '',
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.configs[target];
}

function deleteConfig(target) {
  const store = readStore();
  delete store.configs[target];
  writeStore(store);
}

module.exports = {
  getConfig,
  getAllConfigs,
  setConfig,
  deleteConfig,
};
