"use strict";

const fs = require('fs');
const path = require('path');
const logger = require('../../app-logger.cjs').child('hsm-events');

const FORensic_DIR = path.join(process.cwd(), '.simplebeacon');
const LOG_FILE = path.join(FORensic_DIR, 'forensic-events.log');

function ensureDir() {
  try {
    if (!fs.existsSync(FORensic_DIR)) fs.mkdirSync(FORensic_DIR, { recursive: true });
  } catch (e) {}
}

function safeWrite(obj) {
  try {
    ensureDir();
    const line = JSON.stringify(Object.assign({ time: new Date().toISOString() }, obj)) + '\n';
    fs.appendFileSync(LOG_FILE, line, { encoding: 'utf8' });
  } catch (e) {
    try { logger.warn('forensic write failed', e && e.message ? e.message : String(e)); } catch (e2) {}
  }
}

module.exports = {
  recordSparseEvent: function (name, payload = {}) {
    try {
      const entry = { event: name, payload };
      logger.info('forensic event', entry);
      safeWrite(entry);
    } catch (e) {
      try { logger.warn('recordSparseEvent failed', e && e.message ? e.message : String(e)); } catch (e2) {}
    }
  }
};
