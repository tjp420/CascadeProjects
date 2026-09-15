// SimpleBeacon Incremental Scan Invariant Cache Manager (CommonJS)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class IncrementalCacheManager {
  constructor(cacheFilePath) {
    this.cachePath = String(cacheFilePath || '.simplebeacon/scan_cache.json');
    this.cacheData = { version: '1.0', files: {} };
    this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const raw = fs.readFileSync(this.cachePath, 'utf8');
        this.cacheData = JSON.parse(raw || '{"version":"1.0","files":{}}');
      }
    } catch (e) {
      // Corrupt or unreadable cache — fall back to empty
      this.cacheData = { version: '1.0', files: {} };
    }
  }

  computeFileHash(fileContent) {
    return crypto.createHash('sha256').update(String(fileContent), 'utf8').digest('hex');
  }

  isFileUnchanged(filePath, currentContent) {
    const normalizedPath = path.normalize(String(filePath));
    const cachedRecord = this.cacheData.files[normalizedPath];
    if (!cachedRecord) return false;
    const currentHash = this.computeFileHash(currentContent);
    return cachedRecord.hash === currentHash;
  }

  updateFileRecord(filePath, currentContent, findingsArray) {
    const normalizedPath = path.normalize(String(filePath));
    const currentHash = this.computeFileHash(currentContent);
    this.cacheData.files[normalizedPath] = {
      hash: currentHash,
      timestamp: new Date().toISOString(),
      findings: Array.isArray(findingsArray) ? findingsArray : [],
    };
  }

  getSavedFindings(filePath) {
    const normalizedPath = path.normalize(String(filePath));
    return this.cacheData.files[normalizedPath]?.findings || [];
  }

  saveCache() {
    try {
      const targetDir = path.dirname(this.cachePath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cacheData, null, 2), 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = { IncrementalCacheManager };
