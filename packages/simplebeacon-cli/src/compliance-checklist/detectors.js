/**
 * Detection helpers for compliance checklist evaluation.
 * Separated from the main module for easier testing.
 */

const fs = require('fs');
const path = require('path');

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function detectNpmAuditSummary(projectRoot) {
  if (!projectRoot) return null;
  const root = path.resolve(projectRoot);
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const auditRunnerPath = path.join(root, 'server', 'lib', 'npm-audit-runner.js');
    if (fs.existsSync(auditRunnerPath)) {
      const { runNpmAudit } = require(auditRunnerPath);
      const audit = runNpmAudit(root, { force: false });
      if (audit?.summary && !audit.error) {
        const summary = audit.summary;
        return {
          source: 'npm-audit',
          summary: {
            critical: summary.critical || 0,
            high: summary.high || 0,
            moderate: summary.moderate ?? summary.medium ?? 0,
            low: summary.low || 0,
            info: summary.info || 0,
            total: summary.total ?? summary.vulnerabilityTotal ?? 0,
          },
          note: 'Real npm audit from project root',
        };
      }
    }
  } catch {
    /* fall through to lockfile heuristic */
  }

  const lock = readJsonSafe(path.join(root, 'package-lock.json'));
  const pkg = readJsonSafe(pkgPath);
  const naturalVer =
    lock?.packages?.['node_modules/natural']?.version ||
    String(pkg?.dependencies?.natural || pkg?.devDependencies?.natural || '').replace(
      /^[\^~>=<]+/,
      ''
    );
  const naturalMajor = parseInt(String(naturalVer).split('.')[0], 10);

  if (!naturalVer) {
    return {
      source: 'lockfile-heuristic',
      summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
      note: 'natural not in dependency tree — run npm audit on CI for full CVE coverage',
    };
  }

  return {
    source: 'lockfile-heuristic',
    summary: {
      critical: 0,
      high: 0,
      moderate: Number.isFinite(naturalMajor) && naturalMajor >= 8 ? 0 : 1,
      low: 0,
      info: 0,
      total: Number.isFinite(naturalMajor) && naturalMajor >= 8 ? 0 : 1,
    },
    note:
      Number.isFinite(naturalMajor) && naturalMajor >= 8
        ? 'Lockfile heuristic clean (natural≥8) — run npm audit on CI for full CVE coverage'
        : 'Run npm audit for full dependency posture',
  };
}

function parseEnvMap(envText) {
  const map = Object.create(null);
  for (const rawLine of String(envText).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function isPlaceholderSecret(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  return /^(REPLACE_ON_HOST|changeme|your-secret|replace-me|example|placeholder)/i.test(normalized);
}

function detectProductionAuthProfile(projectRoot) {
  if (!projectRoot) return null;
  const envPath = path.join(path.resolve(projectRoot), '.env.production');
  const fromFile = fs.existsSync(envPath);
  const env = fromFile ? parseEnvMap(fs.readFileSync(envPath, 'utf8')) : process.env;
  const source = fromFile ? '.env.production' : 'process.env';

  const requireAuth = String(env.REQUIRE_AUTH || '').toLowerCase() === 'true';
  const jwtSecretSet = !isPlaceholderSecret(env.JWT_SECRET);
  const hasRefreshSecret = Object.prototype.hasOwnProperty.call(env, 'JWT_REFRESH_SECRET');
  const jwtRefreshSecretSet = hasRefreshSecret
    ? !isPlaceholderSecret(env.JWT_REFRESH_SECRET)
    : true;
  const jwtSet = jwtSecretSet && jwtRefreshSecretSet;

  return {
    configured: requireAuth && jwtSet,
    requireAuth,
    jwtConfigured: jwtSet,
    jwtSecretConfigured: jwtSecretSet,
    jwtRefreshConfigured: jwtRefreshSecretSet,
    reason:
      requireAuth && jwtSet
        ? `REQUIRE_AUTH=true with non-placeholder JWT (${source})`
        : !requireAuth
          ? `Set REQUIRE_AUTH=true in ${source}`
          : !jwtSecretSet
            ? `Set a non-placeholder JWT_SECRET in ${source}`
            : `Set a non-placeholder JWT_REFRESH_SECRET in ${source}`,
  };
}

module.exports = { detectNpmAuditSummary, detectProductionAuthProfile, readJsonSafe };
