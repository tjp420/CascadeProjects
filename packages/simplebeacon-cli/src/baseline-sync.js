/**
 * Sync measured baselines into .simplebeacon/baseline.json
 */

const fs = require('fs');
const path = require('path');
const { loadSimplebeaconConfig } = require('./config');
const {
  checkJestBaseline,
  parseJestSummary,
  readJestResultCache,
  runCommand,
} = require('./rules/jest-baseline');
const { withTransaction } = require('./lib/transaction-manager');
const { writeManagedFileSync } = require('./lib/safe-write');
const { validateJSON, validateNotEmpty } = require('./lib/file-validator');
const { sanitizePath } = require('./lib/path-sanitizer');

async function syncJestBaseline(baseDir, options = {}) {
  const sanitizedBaseDir = sanitizePath(baseDir, baseDir);
  const config = loadSimplebeaconConfig(sanitizedBaseDir, options.config);
  const ruleOptions = config.rules?.['jest-baseline'] || {};
  const testCommand =
    options.testCommand || ruleOptions.testCommand || 'npm test -- --no-coverage --passWithNoTests';

  const fallbackToCache = options.fallbackToCache === true;
  let summary = null;
  let jestNote = null;
  let jestSynced = true;
  let fromCache = false;

  try {
    const result = await runCommand(sanitizedBaseDir, testCommand, options.timeoutMs || 300000);
    summary = parseJestSummary(result.output);

    if (!summary) {
      throw new Error(
        'Could not parse Jest summary — run npm test locally and check output format'
      );
    }

    if (summary.testsFailed > 0 || result.code !== 0) {
      throw new Error(
        `Jest reported failures (${summary.testsPassed}/${summary.testsTotal} passed) — fix tests before syncing baseline`
      );
    }
  } catch (err) {
    if (!fallbackToCache) {
      throw err;
    }
    const cached = readJestResultCache(sanitizedBaseDir);
    if (!cached || cached.success === false || cached.testsFailed > 0) {
      throw err;
    }
    summary = cached;
    fromCache = true;
    jestNote = `Fell back to cached jest-result.json; ${err.message || 'live test run failed'}`;
    jestSynced = false;
  }

  const baseline = {
    ...config.baseline,
    jestTestsPassing: summary.testsPassed,
    jestTestsLabel: `${summary.testsPassed}/${summary.testsTotal}`,
    jestSuites: summary.suitesPassed ?? config.baseline.jestSuites ?? null,
    syncedAt: new Date().toISOString(),
  };

  const baselineContent = `${JSON.stringify(baseline, null, 2)}\n`;

  if (options.dryRun) {
    return {
      dryRun: true,
      baselinePath: config.baselinePath,
      summary,
      baseline,
      plannedActions: [
        {
          action: fs.existsSync(config.baselinePath) ? 'overwrite' : 'create',
          path: config.baselinePath,
        },
      ],
    };
  }

  await withTransaction(async (transaction) => {
    writeManagedFileSync(config.baselinePath, baselineContent, {
      force: true,
      transaction,
      validators: [validateJSON, validateNotEmpty],
    });

    if (!fromCache) {
      const cachePath = path.join(sanitizedBaseDir, '.simplebeacon', 'jest-result.json');
      const cacheContent = `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          summary,
          exitCode: 0,
        },
        null,
        2
      )}\n`;
      writeManagedFileSync(cachePath, cacheContent, {
        force: true,
        transaction,
        backupBeforeOverwrite: false,
        validators: [validateJSON, validateNotEmpty],
      });
    }
  });

  return {
    baselinePath: config.baselinePath,
    summary,
    baseline,
    jestSynced,
    jestNote,
  };
}

async function verifyJestBaseline(baseDir, options = {}) {
  const sanitizedBaseDir = sanitizePath(baseDir, baseDir);
  const config = loadSimplebeaconConfig(sanitizedBaseDir, options.config);
  return checkJestBaseline(sanitizedBaseDir, {
    baseline: config.baseline,
    runTests: true,
    testCommand: options.testCommand || config.rules?.['jest-baseline']?.testCommand,
    timeoutMs: options.timeoutMs,
  });
}

module.exports = {
  syncJestBaseline,
  verifyJestBaseline,
};
