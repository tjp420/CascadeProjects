'use strict';

const fs = require('fs');
const path = require('path');

const STORE_DIR = path.join(process.cwd(), '.simplebeacon');
const STORE_FILE = path.join(STORE_DIR, 'compliance-reports.json');
const MAX_REPORTS_PER_ORG = 100;

const REPORT_FRAMEWORKS = ['eu_ai_act', 'soc2', 'owasp'];
const REPORT_FORMATS = ['html', 'json'];
const REPORT_STATUSES = ['generated', 'failed', 'scheduled'];

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
}

function readStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) return { reports: {} };
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { reports: {} };
  }
}

function writeStore(store) {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function saveReport(report) {
  const store = readStore();
  if (!store.reports[report.orgId]) store.reports[report.orgId] = [];
  store.reports[report.orgId].unshift(report);
  if (store.reports[report.orgId].length > MAX_REPORTS_PER_ORG) {
    store.reports[report.orgId] = store.reports[report.orgId].slice(0, MAX_REPORTS_PER_ORG);
  }
  writeStore(store);
  return report;
}

function getReport(reportId, orgId) {
  const store = readStore();
  const orgReports = store.reports[orgId] || [];
  return orgReports.find(r => r.id === reportId) || null;
}

function getAllReports(orgId) {
  const store = readStore();
  return store.reports[orgId] || [];
}

function deleteReport(reportId, orgId) {
  const store = readStore();
  if (!store.reports[orgId]) return false;
  const idx = store.reports[orgId].findIndex(r => r.id === reportId);
  if (idx === -1) return false;
  store.reports[orgId].splice(idx, 1);
  writeStore(store);
  return true;
}

function getStats(orgId) {
  const reports = getAllReports(orgId);
  const byFramework = {};
  const byStatus = {};
  const byFormat = {};
  for (const r of reports) {
    for (const fw of (r.frameworks || [])) {
      byFramework[fw] = (byFramework[fw] || 0) + 1;
    }
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byFormat[r.format] = (byFormat[r.format] || 0) + 1;
  }
  const lastGenerated = reports.length > 0 ? reports[0].generatedAt : null;
  return {
    total: reports.length,
    byFramework,
    byStatus,
    byFormat,
    lastGeneratedAt: lastGenerated,
  };
}

module.exports = {
  REPORT_FRAMEWORKS,
  REPORT_FORMATS,
  REPORT_STATUSES,
  saveReport,
  getReport,
  getAllReports,
  deleteReport,
  getStats,
};
