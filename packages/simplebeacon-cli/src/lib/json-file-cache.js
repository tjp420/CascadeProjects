'use strict';

const _cache = new Map();

function readJsonFileCached(filePath) {
    if (!filePath || typeof filePath !== 'string') return null;
    if (_cache.has(filePath)) return _cache.get(filePath);
    try {
        const fs = require('fs');
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);
        _cache.set(filePath, parsed);
        return parsed;
    } catch {
        return null;
    }
}

function clearJsonFileCache() {
    _cache.clear();
}

module.exports = {
    readJsonFileCached,
    clearJsonFileCache
};
