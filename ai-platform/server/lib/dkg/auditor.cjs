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

module.exports = {
  recordTranscript,
  listTranscripts,
  getTranscript,
};
