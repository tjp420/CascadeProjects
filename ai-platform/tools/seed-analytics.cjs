'use strict';

/**
 * Analytics Seed Script — Populates the usage analytics store with realistic
 * mock data for sales demonstrations and dashboard testing.
 *
 * Generates 90 days of time-series scan data across multiple enterprise orgs
 * with business-hours variance, weekend dips, improving posture trends, and
 * realistic severity / language / category distributions.
 *
 * Usage:
 *   node tools/seed-analytics.cjs                  # 90 days, default orgs
 *   node tools/seed-analytics.cjs --days=60        # 60 days
 *   node tools/seed-analytics.cjs --clear           # wipe store before seeding
 *   node tools/seed-analytics.cjs --orgs=5          # number of orgs
 *
 * @module seed-analytics
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── Configuration ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cliArgs = {};
for (const a of args) {
  const m = a.match(/^--([a-zA-Z]+)=(.+)$/);
  if (m) cliArgs[m[1]] = m[2];
  else if (a.startsWith('--')) cliArgs[a.slice(2)] = true;
}

const DAYS = parseInt(cliArgs.days, 10) || 90;
const NUM_ORGS = parseInt(cliArgs.orgs, 10) || 4;
const CLEAR = !!cliArgs.clear;

const STORE_PATH =
  cliArgs.storePath ||
  process.env.USAGE_ANALYTICS_STORE_PATH ||
  path.join(__dirname, '..', '.simplebeacon', 'usage-analytics.json');

// ── Enterprise Org Profiles ─────────────────────────────────────────────────

const ORG_PROFILES = [
  {
    orgId: 'acme-corp',
    companyName: 'Acme Corporation',
    industry: 'Financial Services',
    repos: [
      'acme-payment-gateway',
      'acme-risk-engine',
      'acme-compliance-api',
      'acme-trading-platform',
    ],
    languages: { JavaScript: 35, TypeScript: 30, Python: 20, Java: 10, Go: 5 },
    baseFiles: 850,
    baseFindings: 45,
    initialPosture: 62,
    triggerSources: ['ci-pipeline', 'scheduled-scan', 'pr-check', 'manual-scan'],
    branches: ['main', 'develop', 'feature/payment-v2', 'release/v3.1'],
  },
  {
    orgId: 'globex-health',
    companyName: 'Globex Health Systems',
    industry: 'Healthcare / HIPAA',
    repos: [
      'globex-patient-portal',
      'globex-ehr-backend',
      'globex-medical-ml',
      'globex-claims-processor',
    ],
    languages: { Python: 40, TypeScript: 25, JavaScript: 15, Java: 15, SQL: 5 },
    baseFiles: 620,
    baseFindings: 38,
    initialPosture: 55,
    triggerSources: ['ci-pipeline', 'scheduled-scan', 'pr-check'],
    branches: ['main', 'develop', 'feature/hipaa-audit'],
  },
  {
    orgId: 'initech-ai',
    companyName: 'Initech AI Labs',
    industry: 'AI / ML Platform',
    repos: [
      'initech-model-training',
      'initech-inference-api',
      'initech-data-pipeline',
      'initech-feature-store',
    ],
    languages: { Python: 50, TypeScript: 20, Go: 15, JavaScript: 10, Rust: 5 },
    baseFiles: 480,
    baseFindings: 28,
    initialPosture: 71,
    triggerSources: ['ci-pipeline', 'scheduled-scan', 'manual-scan', 'pr-check'],
    branches: ['main', 'develop', 'feature/gpu-optimization', 'experiment/v2'],
  },
  {
    orgId: 'umbrella-logistics',
    companyName: 'Umbrella Logistics',
    industry: 'Supply Chain / IoT',
    repos: ['umbrella-fleet-tracker', 'umbrella-route-optimizer', 'umbrella-warehouse-api'],
    languages: { JavaScript: 30, TypeScript: 25, Python: 20, Go: 15, C: 10 },
    baseFiles: 410,
    baseFindings: 32,
    initialPosture: 58,
    triggerSources: ['ci-pipeline', 'scheduled-scan', 'pr-check'],
    branches: ['main', 'develop', 'feature/iot-sensors'],
  },
  {
    orgId: 'stark-industries',
    companyName: 'Stark Industries',
    industry: 'Defense / Aerospace',
    repos: [
      'stark-guidance-system',
      'stark-telemetry-processor',
      'stark-mission-control',
      'stark-sim-engine',
    ],
    languages: { C: 30, Python: 25, TypeScript: 20, Java: 15, Rust: 10 },
    baseFiles: 720,
    baseFindings: 52,
    initialPosture: 48,
    triggerSources: ['ci-pipeline', 'scheduled-scan', 'manual-scan', 'pr-check'],
    branches: ['main', 'develop', 'feature/avionics-v4', 'classified/v2'],
  },
];

// ── Violation Categories ────────────────────────────────────────────────────

const VIOLATION_CATEGORIES = [
  'EU AI Act — Prohibited Practices',
  'EU AI Act — High-Risk Obligations',
  'California SB 1047 — Critical Harm',
  'GDPR — Data Subject Rights',
  'HIPAA — PHI Exposure',
  'OWASP — Injection',
  'OWASP — Broken Access Control',
  'OWASP — Security Misconfiguration',
  'OWASP — Vulnerable Dependencies',
  'Hardcoded Secrets',
  'Unsafe Deserialization',
  'Missing Input Validation',
  'Improper Error Handling',
  'Non-deterministic Output',
  'Missing Model Card',
  'Bias Detection Gap',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isBusinessHours(date) {
  const hour = date.getHours();
  return hour >= 8 && hour <= 19;
}

/**
 * Generate a realistic severity distribution given a total finding count
 * and an improving posture trend (fewer criticals over time).
 */
function generateSeverityCounts(total, trendFactor) {
  const critical = Math.max(0, Math.round(total * 0.08 * trendFactor));
  const high = Math.max(0, Math.round(total * 0.22 * trendFactor));
  const medium = Math.round(total * 0.35);
  const low = Math.round(total * 0.25);
  const info = Math.max(0, total - critical - high - medium - low);
  return { critical, high, medium, low, info: Math.max(0, info) };
}

function generateCategoryCounts(total) {
  const cats = {};
  const numCats = randomInt(3, 7);
  const selected = [...VIOLATION_CATEGORIES].sort(() => Math.random() - 0.5).slice(0, numCats);
  let remaining = total;
  for (let i = 0; i < selected.length; i++) {
    if (i === selected.length - 1) {
      cats[selected[i]] = Math.max(0, remaining);
    } else {
      const portion = randomInt(1, Math.max(2, Math.floor(remaining / (selected.length - i))));
      cats[selected[i]] = portion;
      remaining -= portion;
    }
  }
  return cats;
}

function generateLanguageBreakdown(baseFiles, langDist) {
  const breakdown = {};
  for (const [lang, pct] of Object.entries(langDist)) {
    breakdown[lang] = Math.round(baseFiles * (pct / 100) * randomFloat(0.85, 1.15));
  }
  return breakdown;
}

// ── Posture Score Trend Model ───────────────────────────────────────────────

/**
 * Posture improves over time as orgs remediate findings.
 * Starts at initialPosture, trends upward with noise, plateaus near 85-92.
 */
function postureForDay(profile, dayIndex, totalDays) {
  const progress = dayIndex / totalDays;
  const improvement = (90 - profile.initialPosture) * Math.min(1, progress * 1.2);
  const noise = randomFloat(-4, 4);
  const score = profile.initialPosture + improvement + noise;
  return Math.max(20, Math.min(98, Math.round(score)));
}

// ── Scan Generation ─────────────────────────────────────────────────────────

function generateScans() {
  const orgs = ORG_PROFILES.slice(0, NUM_ORGS);
  const scans = [];
  const now = new Date();

  for (const profile of orgs) {
    // Each org scans 1-4 repos per business day, fewer on weekends
    for (let dayOffset = DAYS; dayOffset >= 0; dayOffset--) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      date.setHours(randomInt(7, 20), randomInt(0, 59), randomInt(0, 59), 0);

      const weekend = isWeekend(date);
      const businessHrs = isBusinessHours(date);

      // Scan frequency: weekdays 2-5 scans, weekends 0-1
      let scansToday;
      if (weekend) {
        scansToday = Math.random() < 0.4 ? 1 : 0;
      } else if (businessHrs) {
        scansToday = randomInt(2, 5);
      } else {
        scansToday = Math.random() < 0.3 ? 1 : 0;
      }

      for (let s = 0; s < scansToday; s++) {
        const scanTime = new Date(date);
        scanTime.setHours(randomInt(7, 20), randomInt(0, 59), randomInt(0, 59), 0);

        const repo = pick(profile.repos);
        const trendFactor = 1 - (dayOffset / DAYS) * 0.4; // fewer criticals over time
        const fileVariance = randomFloat(0.7, 1.3);
        const filesAnalyzed = Math.round(profile.baseFiles * fileVariance);
        const findingsVariance = randomFloat(0.6, 1.4);
        const totalFindings = Math.max(
          0,
          Math.round(profile.baseFindings * findingsVariance * (1 - (1 - trendFactor) * 0.3))
        );

        const severityCounts = generateSeverityCounts(totalFindings, trendFactor);
        const postureScore = postureForDay(profile, DAYS - dayOffset, DAYS);

        // Adjust findings to match posture score roughly
        const adjustedFindings =
          severityCounts.critical +
          severityCounts.high +
          severityCounts.medium +
          severityCounts.low +
          severityCounts.info;

        const branch = pick(profile.branches);
        const triggeredBy = pick(profile.triggerSources);
        const gateStatus = postureScore >= 70 ? 'pass' : postureScore >= 50 ? 'warn' : 'fail';

        scans.push({
          scanId: `scan-${crypto.randomBytes(4).toString('hex')}`,
          orgId: profile.orgId,
          timestamp: scanTime.toISOString(),
          projectPath: `/repos/${repo}`,
          repository: repo,
          branch,
          commitSha: crypto.randomBytes(7).toString('hex'),
          triggeredBy,
          codeFilesAnalyzed: filesAnalyzed,
          totalFindings: adjustedFindings,
          severityCounts,
          categoryCounts: generateCategoryCounts(adjustedFindings),
          languageBreakdown: generateLanguageBreakdown(filesAnalyzed, profile.languages),
          scanDurationMs: randomInt(3000, 45000),
          gateStatus,
          postureScore,
        });
      }
    }
  }

  // Sort by timestamp ascending
  scans.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return scans;
}

// ── Store Writer ────────────────────────────────────────────────────────────

function buildStoreFromScans(scans) {
  const store = { scans: [], orgs: {}, aggregated: {} };

  for (const scan of scans) {
    store.scans.push(scan);

    if (!store.orgs[scan.orgId]) {
      store.orgs[scan.orgId] = {
        totalScans: 0,
        totalFilesAnalyzed: 0,
        totalFindings: 0,
        severityTotals: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        postureScores: [],
        lastScanAt: null,
        firstScanAt: null,
        repositories: {},
      };
    }

    const org = store.orgs[scan.orgId];
    org.totalScans++;
    org.totalFilesAnalyzed += scan.codeFilesAnalyzed;
    org.totalFindings += scan.totalFindings;
    org.severityTotals.critical += scan.severityCounts.critical;
    org.severityTotals.high += scan.severityCounts.high;
    org.severityTotals.medium += scan.severityCounts.medium;
    org.severityTotals.low += scan.severityCounts.low;
    org.severityTotals.info += scan.severityCounts.info;
    org.postureScores.push(scan.postureScore);
    if (org.postureScores.length > 100) org.postureScores = org.postureScores.slice(-100);
    org.lastScanAt = scan.timestamp;
    if (!org.firstScanAt) org.firstScanAt = scan.timestamp;

    if (scan.repository) {
      if (!org.repositories[scan.repository]) {
        org.repositories[scan.repository] = { scans: 0, findings: 0, lastScanAt: null };
      }
      org.repositories[scan.repository].scans++;
      org.repositories[scan.repository].findings += scan.totalFindings;
      org.repositories[scan.repository].lastScanAt = scan.timestamp;
    }
  }

  return store;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n  Analytics Seed Script`);
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  Days: ${DAYS} | Orgs: ${NUM_ORGS} | Clear: ${CLEAR}`);
  console.log(`  Store: ${STORE_PATH}`);
  console.log(`  ${'─'.repeat(50)}\n`);

  if (CLEAR && fs.existsSync(STORE_PATH)) {
    fs.unlinkSync(STORE_PATH);
    console.log('  [clear] Removed existing store file.');
  }

  console.log('  [generate] Building realistic scan data...');
  const scans = generateScans();
  console.log(`  [generate] Created ${scans.length} scan records across ${NUM_ORGS} orgs.\n`);

  // Print per-org summary
  const orgIds = [...new Set(scans.map((s) => s.orgId))];
  for (const orgId of orgIds) {
    const orgScans = scans.filter((s) => s.orgId === orgId);
    const profile = ORG_PROFILES.find((p) => p.orgId === orgId);
    const avgPosture = Math.round(
      orgScans.reduce((a, s) => a + s.postureScore, 0) / orgScans.length
    );
    const firstScore = orgScans[0]?.postureScore || 0;
    const lastScore = orgScans[orgScans.length - 1]?.postureScore || 0;
    const totalFiles = orgScans.reduce((a, s) => a + s.codeFilesAnalyzed, 0);
    const totalFindings = orgScans.reduce((a, s) => a + s.totalFindings, 0);
    const repos = [...new Set(orgScans.map((s) => s.repository))];

    console.log(`  ${profile?.companyName || orgId} (${profile?.industry || 'Unknown'})`);
    console.log(
      `    Scans: ${orgScans.length} | Files: ${totalFiles.toLocaleString()} | Findings: ${totalFindings.toLocaleString()}`
    );
    console.log(
      `    Posture: ${firstScore} → ${lastScore} (avg ${avgPosture}) | Repos: ${repos.length}`
    );
    console.log(
      `    First: ${orgScans[0]?.timestamp?.slice(0, 10)} | Last: ${orgScans[orgScans.length - 1]?.timestamp?.slice(0, 10)}\n`
    );
  }

  console.log('  [write] Building store with org aggregates...');
  const store = buildStoreFromScans(scans);

  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmpPath = STORE_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);

  const fileSizeKB = Math.round(fs.statSync(STORE_PATH).size / 1024);
  console.log(`  [write] Store saved to ${STORE_PATH} (${fileSizeKB} KB)\n`);
  console.log(`  ${'═'.repeat(50)}`);
  console.log(`  DONE — ${scans.length} scans seeded across ${orgIds.length} orgs.`);
  console.log(`  Launch the dashboard and navigate to the Analytics tab`);
  console.log(`  to view populated charts and KPI cards.\n`);
}

main();
