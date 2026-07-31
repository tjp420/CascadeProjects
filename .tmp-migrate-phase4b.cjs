/**
 * Phase 4b Migration Script
 *
 * Migrates error responses in route files to use the shared sendError helper.
 * Handles two patterns:
 * 1. res.status(N).json({ success: false, error: '...' }) → sendError(res, N, '...')
 * 2. res.status(N).json({ error: 'code', message: '...' }) → sendError(res, N, 'code', { message: '...' })
 *
 * Also handles multi-line variants and template literals.
 */

const fs = require('fs');
const path = require('path');

const routesDir = 'ai-platform/server/routes';

// Files to migrate (excluding already-migrated: admin-api, analytics-routes, flexible-analyze-api)
const filesToMigrate = [
  'token-auth.cjs',
  'local-models-api.cjs',
  'whitelabel-routes.cjs',
  'fix-orchestrator-api.cjs',
  'integration-routes.cjs',
  'sso-auth-handler.cjs',
  'sso-config-routes.cjs',
  'upload.cjs',
  'webauthn-api.cjs',
  'sso-routes.cjs',
  'chatbot-api.cjs',
  'workspaces.cjs',
  'demo-simplebeacon-api.cjs',
  'realtime-analysis-api.cjs',
  'auth-inline-routes.cjs',
  'mock-data-api.cjs',
  'repository-scanner-api.cjs',
  'stripe-webhook-routes.cjs',
  'ai-context-routes.cjs',
  'deployment-gate-routes.cjs',
  'eu-ai-act-audit-route.cjs',
  'auth.cjs',
  'agent-routes.cjs',
  'ai-math-audit-route.cjs',
  'meta-routes.cjs',
  'auth-routes.cjs',
  'enterprise-analytics-routes.cjs',
  'external-weather-api.cjs',
  'oracle-search.cjs',
  'pr-integration-api.cjs',
  'proxy-ollama-api.cjs',
  'audit.cjs',
];

let totalReplacements = 0;
const results = [];

for (const file of filesToMigrate) {
  const filePath = path.join(routesDir, file);
  if (!fs.existsSync(filePath)) {
    results.push({ file, status: 'NOT FOUND', replacements: 0 });
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let replacements = 0;

  // Check if sendError is already imported
  const hasImport = /require\(['"]\.\.\/lib\/response-helpers\.cjs['"]\)/.test(content);

  // Pattern 1: Single-line { success: false, error: EXPRESSION }
  // res.status(N).json({ success: false, error: '...' }) → sendError(res, N, '...')
  const pattern1 = /res\.status\((\d+)\)\.json\(\{ success: false, error: ([^}]+) \}\)/g;
  const matches1 = content.match(pattern1) || [];
  content = content.replace(pattern1, (match, status, error) => {
    replacements++;
    return 'sendError(res, ' + status + ', ' + error.trim() + ')';
  });

  // Pattern 2: Single-line { error: 'code', message: '...' }
  // res.status(N).json({ error: 'code', message: '...' }) → sendError(res, N, 'code', { message: '...' })
  const pattern2 =
    /res\.status\((\d+)\)\.json\(\{ error: ('[^']*'|`[^`]*`), message: ([^}]+) \}\)/g;
  const matches2 = content.match(pattern2) || [];
  content = content.replace(pattern2, (match, status, error, message) => {
    replacements++;
    return (
      'sendError(res, ' + status + ', ' + error.trim() + ', { message: ' + message.trim() + ' })'
    );
  });

  // Pattern 3: Single-line { error: '...' } (no message, no success)
  // res.status(N).json({ error: '...' }) → sendError(res, N, '...')
  const pattern3 = /res\.status\((\d+)\)\.json\(\{ error: ([^}]+) \}\)/g;
  const matches3 = content.match(pattern3) || [];
  content = content.replace(pattern3, (match, status, error) => {
    replacements++;
    return 'sendError(res, ' + status + ', ' + error.trim() + ')';
  });

  // Pattern 4: Multi-line { success: false, error: '...' }
  // res.status(N).json({\n  success: false,\n  error: '...'\n})
  const pattern4 =
    /res\.status\((\d+)\)\.json\(\{\s*\n\s*success: false,\s*\n\s*error: ([^}\n]+)\s*\n\s*\}\)/g;
  const matches4 = content.match(pattern4) || [];
  content = content.replace(pattern4, (match, status, error) => {
    replacements++;
    return 'sendError(res, ' + status + ', ' + error.trim() + ')';
  });

  // Pattern 5: Multi-line { error: 'code', message: '...' }
  const pattern5 =
    /res\.status\((\d+)\)\.json\(\{\s*\n\s*error: ('[^']*'|`[^`]*`),\s*\n\s*message: ([^}\n]+)\s*\n\s*\}\)/g;
  const matches5 = content.match(pattern5) || [];
  content = content.replace(pattern5, (match, status, error, message) => {
    replacements++;
    return (
      'sendError(res, ' + status + ', ' + error.trim() + ', { message: ' + message.trim() + ' })'
    );
  });

  // Pattern 6: Multi-line { error: '...' } (no message, no success)
  const pattern6 = /res\.status\((\d+)\)\.json\(\{\s*\n\s*error: ([^}\n]+)\s*\n\s*\}\)/g;
  const matches6 = content.match(pattern6) || [];
  content = content.replace(pattern6, (match, status, error) => {
    replacements++;
    return 'sendError(res, ' + status + ', ' + error.trim() + ')';
  });

  if (replacements > 0) {
    // Add import if not present
    if (!hasImport) {
      // Find the last require statement and add after it
      const lastRequireMatch = content.match(/^(const .+ = require\('.+'\);)$/gm);
      if (lastRequireMatch) {
        const lastRequire = lastRequireMatch[lastRequireMatch.length - 1];
        const importLine = "const { sendError } = require('../lib/response-helpers.cjs');";
        content = content.replace(lastRequire, lastRequire + '\n' + importLine);
      }
    }

    fs.writeFileSync(filePath, content);
    totalReplacements += replacements;
    results.push({ file, status: 'MIGRATED', replacements, hasImport: !hasImport });
  } else {
    results.push({ file, status: 'NO CHANGES', replacements: 0 });
  }
}

console.log('\n=== Phase 4b Migration Results ===\n');
for (const r of results) {
  const importNote = r.hasImport ? ' (import added)' : '';
  console.log(
    r.file.padEnd(35) +
      ' | ' +
      r.status.padEnd(12) +
      ' | ' +
      r.replacements +
      ' replacements' +
      importNote
  );
}
console.log('\nTotal replacements: ' + totalReplacements);
console.log('Files migrated: ' + results.filter((r) => r.status === 'MIGRATED').length);
