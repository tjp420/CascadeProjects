const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

(async function(){
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg-compliance-'));
  const tmpLogPath = path.join(tmpDir, 'audit-log.json');
  const tmpPolicyPath = path.join(tmpDir, 'audit-policy.json');
  fs.writeFileSync(tmpLogPath, JSON.stringify({ entries: {} }, null, 2));
  fs.writeFileSync(tmpPolicyPath, JSON.stringify({}, null, 2));

  process.env.AUDIT_LOG_PATH = tmpLogPath;
  process.env.AUDIT_POLICY_PATH = tmpPolicyPath;

  // reload modules
  delete require.cache[require.resolve('../ai-platform/server/lib/audit-logger.cjs')];
  const auditLogger = require('../ai-platform/server/lib/audit-logger.cjs');

  console.log('Calling generateComplianceReport now...');
  const report = auditLogger.generateComplianceReport('test-debug');
  console.log('Report id:', report.reportId);

  const storeRaw = fs.readFileSync(tmpLogPath, 'utf8');
  console.log('Audit log contents:\n', storeRaw);

  // cleanup
  // fs.rmSync(tmpDir, { recursive: true, force: true });
})();