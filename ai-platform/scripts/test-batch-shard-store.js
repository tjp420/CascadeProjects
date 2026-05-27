/**
 * Read/write consolidated test-batch-data shard bundles.
 * Active layout: mock_data.json and clean_mock_data.json as arrays of shard arrays.
 */

const fs = require('fs');
const path = require('path');

const MOCK_DATA_FILE = 'mock_data.json';
const CLEAN_MOCK_DATA_FILE = 'clean_mock_data.json';
const SHARD_FILE_PATTERN = /^mock_data_(\d+)\.json$/;
const CLEAN_SHARD_FILE_PATTERN = /^clean_mock_data_(\d+)\.json$/;
const CONSOLIDATED_SUFFIX_PATTERN = /_consolidated\.json$/;

function defaultBatchDir() {
    return path.join(__dirname, '..', 'test-batch-data');
}

function isShardBundle(data) {
    return Array.isArray(data)
        && data.length > 0
        && data.every((item) => Array.isArray(item));
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listLegacyShardFiles(batchDir, pattern) {
    return fs.readdirSync(batchDir)
        .filter((name) => pattern.test(name))
        .map((name) => ({
            index: Number(name.match(pattern)[1]),
            name,
            filePath: path.join(batchDir, name)
        }))
        .sort((a, b) => a.index - b.index);
}

function readLegacyShards(batchDir, pattern) {
    return listLegacyShardFiles(batchDir, pattern).map((entry) => readJson(entry.filePath));
}

function readShardBundle(batchDir, fileName, legacyPattern) {
    const consolidatedPath = path.join(batchDir, fileName);
    if (fs.existsSync(consolidatedPath)) {
        const data = readJson(consolidatedPath);
        if (!isShardBundle(data)) {
            throw new Error(`${fileName} must be an array of shard arrays`);
        }
        return data;
    }
    return readLegacyShards(batchDir, legacyPattern);
}

function readMockShards(batchDir = defaultBatchDir()) {
    return readShardBundle(batchDir, MOCK_DATA_FILE, SHARD_FILE_PATTERN);
}

function readCleanMockShards(batchDir = defaultBatchDir()) {
    return readShardBundle(batchDir, CLEAN_MOCK_DATA_FILE, CLEAN_SHARD_FILE_PATTERN);
}

function writeShardBundle(batchDir, fileName, shards) {
    if (!Array.isArray(shards) || !shards.every((shard) => Array.isArray(shard))) {
        throw new Error(`${fileName} requires an array of shard arrays`);
    }
    fs.writeFileSync(
        path.join(batchDir, fileName),
        `${JSON.stringify(shards, null, 2)}\n`,
        'utf8'
    );
}

function writeMockShards(shards, batchDir = defaultBatchDir()) {
    writeShardBundle(batchDir, MOCK_DATA_FILE, shards);
}

function writeCleanMockShards(shards, batchDir = defaultBatchDir()) {
    writeShardBundle(batchDir, CLEAN_MOCK_DATA_FILE, shards);
}

function getMockShard(batchDir, index) {
    const shards = readMockShards(batchDir);
    if (index < 0 || index >= shards.length) {
        throw new RangeError(`Shard index out of range: ${index}`);
    }
    return shards[index];
}

function getMockShardLabel(index) {
    return `mock_data_${index}.json`;
}

function getCleanMockShardLabel(index) {
    return `clean_mock_data_${index}.json`;
}

function hasConsolidatedMockData(batchDir = defaultBatchDir()) {
    return fs.existsSync(path.join(batchDir, MOCK_DATA_FILE));
}

function listBatchInputFiles(batchDir = defaultBatchDir()) {
    const consolidatedPath = path.join(batchDir, MOCK_DATA_FILE);
    if (fs.existsSync(consolidatedPath)) {
        return [consolidatedPath];
    }
    return listLegacyShardFiles(batchDir, SHARD_FILE_PATTERN).map((entry) => entry.filePath);
}

function shouldSkipBatchScanFile(fileName, batchDir = defaultBatchDir()) {
    if (CONSOLIDATED_SUFFIX_PATTERN.test(fileName)) return true;
    if (fileName === CLEAN_MOCK_DATA_FILE) return true;
    if (CLEAN_SHARD_FILE_PATTERN.test(fileName)) return true;
    if (fileName === MOCK_DATA_FILE) return false;
    if (SHARD_FILE_PATTERN.test(fileName) && fs.existsSync(path.join(batchDir, MOCK_DATA_FILE))) {
        return true;
    }
    return false;
}

module.exports = {
    MOCK_DATA_FILE,
    CLEAN_MOCK_DATA_FILE,
    SHARD_FILE_PATTERN,
    CLEAN_SHARD_FILE_PATTERN,
    defaultBatchDir,
    isShardBundle,
    readMockShards,
    readCleanMockShards,
    writeMockShards,
    writeCleanMockShards,
    getMockShard,
    getMockShardLabel,
    getCleanMockShardLabel,
    hasConsolidatedMockData,
    listBatchInputFiles,
    shouldSkipBatchScanFile,
    listLegacyShardFiles
};
