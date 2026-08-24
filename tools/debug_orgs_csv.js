const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function writeEntryDirectly(auditLogger, storePath, params) {
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const id = `audit-${crypto.randomBytes(6).toString('hex')}`;
  const orgId = params.orgId || 'default';
  const entry = {
    id,
    orgId,
    timestamp: params.timestamp,
    actorId: params.actorId || 'unknown',
    actorEmail: params.actorEmail || 'unknown',
    action: params.action || 'TEST',
    entity: params.entity || 'test',
    entityId: params.entityId || '',
    changes: null,
    metadata: params.metadata || null,
    prevHash: params.prevHash || '0'.repeat(64),
  };
  const entryWithoutHash = { ...entry };
  delete entryWithoutHash.hash;
  entry.hash = auditLogger.computeEntryHash(entryWithoutHash, entry.prevHash);
  const key = orgId ? `${orgId}::${id}` : id;
  store.entries[key] = entry;
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  return entry;
}

function writeChainedEntries(auditLogger, storePath, orgId, timestamps) {
  let prevHash = '0'.repeat(64);
  const entries = [];
  for (const ts of timestamps) {
    const entry = writeEntryDirectly(auditLogger, storePath, {
      orgId,
      timestamp: ts,
      action: 'TEST',
      prevHash,
    });
    prevHash = entry.hash;
    entries.push(entry);
  }
  return entries;
}

(async function(){
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg-orgs-'));
  const tmpLogPath = path.join(tmpDir, 'audit-log.json');
  fs.writeFileSync(tmpLogPath, JSON.stringify({ entries: {} }, null, 2));
  process.env.AUDIT_LOG_PATH = tmpLogPath;

  delete require.cache[require.resolve('../ai-platform/server/lib/audit-logger.cjs')];
  const auditLogger = require('../ai-platform/server/lib/audit-logger.cjs');

  const now = new Date().toISOString();
  writeChainedEntries(auditLogger, tmpLogPath, 'org-a', [now]);
  writeChainedEntries(auditLogger, tmpLogPath, 'org-b', [now]);
  writeChainedEntries(auditLogger, tmpLogPath, 'caller-org', [now]);

  const report = auditLogger.generateComplianceReport('caller-org');
  console.log('Orgs in report:', report.orgs.map(o=>o.orgId));
  const csv = auditLogger.complianceReportToCsv(report);
  console.log('\nCSV excerpt:\n', csv.substring(csv.indexOf('SECTION 2')));
})();