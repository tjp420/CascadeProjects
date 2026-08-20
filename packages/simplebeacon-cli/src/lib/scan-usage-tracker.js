/**
 * Local scan usage counter for tier-based quota enforcement.
 * Tracks local scan counts in ~/.simplebeacon/scan-usage.json.
 * Pipeline scans (--ci flag) bypass local counter and validate license token instead.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const USAGE_FILE = path.join(os.homedir(), ".simplebeacon", "scan-usage.json");
const PAID_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function defaultUsage(tier = "developer") {
  return {
    periodStart: new Date().toISOString(),
    localScans: 0,
    pipelineScans: 0,
    tier: tier,
  };
}

function readUsage() {
  try {
    const raw = fs.readFileSync(USAGE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      periodStart: parsed.periodStart || new Date().toISOString(),
      localScans: Number(parsed.localScans) || 0,
      pipelineScans: Number(parsed.pipelineScans) || 0,
      tier: parsed.tier || "developer",
    };
  } catch {
    return defaultUsage();
  }
}

function writeUsage(usage) {
  try {
    fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2) + "\n", "utf8");
  } catch {
    // Silently fail if we can't write usage file (e.g., read-only filesystem)
  }
}

function resetPeriodIfNeeded(usage) {
  const periodStart = usage.periodStart ? Date.parse(usage.periodStart) : 0;
  if (!periodStart || Date.now() - periodStart >= PAID_PERIOD_MS) {
    return {
      ...usage,
      localScans: 0,
      pipelineScans: 0,
      periodStart: new Date().toISOString(),
    };
  }
  return usage;
}

function isPipelineScan() {
  return Boolean(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL,
  );
}

function checkLocalScanQuota(tierLimits) {
  const usage = resetPeriodIfNeeded(readUsage());
  const quota = tierLimits.maxScansPerPeriod || Infinity;
  const allowed = quota === Infinity || usage.localScans < quota;

  return {
    allowed,
    scansUsed: usage.localScans,
    scansRemaining:
      quota === Infinity ? Infinity : Math.max(0, quota - usage.localScans),
    quota,
    periodStart: usage.periodStart,
    reason: allowed ? undefined : "scan_quota_exceeded",
  };
}

function incrementLocalScan(tier = "developer") {
  const usage = resetPeriodIfNeeded(readUsage());
  usage.localScans += 1;
  usage.tier = tier;
  writeUsage(usage);
  return usage;
}

function incrementPipelineScan(tier = "developer") {
  const usage = resetPeriodIfNeeded(readUsage());
  usage.pipelineScans += 1;
  usage.tier = tier;
  writeUsage(usage);
  return usage;
}

module.exports = {
  readUsage,
  writeUsage,
  checkLocalScanQuota,
  incrementLocalScan,
  incrementPipelineScan,
  isPipelineScan,
  resetPeriodIfNeeded,
  USAGE_FILE,
};
