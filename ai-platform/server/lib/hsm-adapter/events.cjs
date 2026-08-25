'use strict';

const fs = require('fs');
const path = require('path');

// Locate the repo-root .simplebeacon directory from anywhere under ai-platform/
function findRepoRoot(start) {
  let dir = start;
  while (dir.length > 3) {
    const marker = path.join(dir, '.simplebeacon');
    if (fs.existsSync(marker)) return marker;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(start, '.simplebeacon');
}

const LOG_DIR = findRepoRoot(__dirname);
const LOG_FILE = path.join(LOG_DIR, 'forensic-events.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    } catch (e) {
      console.error('events.cjs error:', e);
      // ignore if unable to create
    }
  }
}

function recordSparseEvent(type, info = {}) {
  try {
    ensureLogDir();
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      info,
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', { mode: 0o600 });
  } catch (e) {
    console.error('events.cjs error:', e);
    // Forensic logging must never crash the runtime
  }
}

module.exports = { recordSparseEvent };
