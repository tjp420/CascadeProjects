const fs = require('fs');
const path = require('path');

function publishProof({ taskId, params, proof }) {
  const dir = path.join(__dirname, '.proofs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${taskId || Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ params, proof, ts: new Date().toISOString() }, null, 2));
  return file;
}

module.exports = { publishProof };