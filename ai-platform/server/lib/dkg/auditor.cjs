// auditor.cjs - persist and manage epoch transcripts and signed audit logs

const fs = require('fs');
const path = require('path');

const AUDIT_DIR = path.join(__dirname, '.audit');
if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });

async function recordTranscript(epochId, transcript) {
  const file = path.join(AUDIT_DIR, `epoch-${epochId}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(transcript, null, 2));
  return { file };
}

async function listTranscripts() {
  return fs.readdirSync(AUDIT_DIR).filter((f) => f.endsWith('.json'));
}

async function getTranscript(fileName) {
  const file = path.join(AUDIT_DIR, fileName);
  if (!fs.existsSync(file)) throw new Error('not found');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Append a VDF proof to the audit store.
 * This creates a proof file under the audit dir for durable record.
 */
async function appendProof(epochId, taskId, vdfObject) {
  const safeEpoch = epochId || 'unknown';
  const safeTask = taskId || Date.now();
  const file = path.join(AUDIT_DIR, `proof-${safeEpoch}-${safeTask}-${Date.now()}.json`);
  const payload = { epochId: safeEpoch, taskId: safeTask, proof: vdfObject, ts: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return { file };
}

module.exports = {
  recordTranscript,
  listTranscripts,
  getTranscript,
  appendProof,
};