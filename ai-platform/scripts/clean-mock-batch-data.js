#!/usr/bin/env node
/**
 * Clean mock_data_*.json files in test-batch-data:
 * - Remove null / empty entries
 * - Normalize user schema fields
 * - Deduplicate by id
 */

const fs = require('fs');
const path = require('path');
const {
    defaultBatchDir,
    readMockShards,
    writeMockShards,
    hasConsolidatedMockData,
    listLegacyShardFiles,
    SHARD_FILE_PATTERN
} = require('./test-batch-shard-store');

const BATCH_DIR = defaultBatchDir();
const USER_FIELDS = ['id', 'name', 'email', 'age', 'address', 'phone'];

function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalString(value) {
    if (value == null || value === '') return null;
    return String(value);
}

function normalizeUserRecord(item) {
    if (!isPlainObject(item)) return null;
    if (Object.keys(item).length === 0) return null;
    if (item.id == null || item.name == null || item.email == null) return null;

    return {
        id: Number(item.id),
        name: String(item.name),
        email: String(item.email),
        age: item.age == null || item.age === '' ? null : Number(item.age),
        address: normalizeOptionalString(item.address),
        phone: normalizeOptionalString(item.phone)
    };
}

function cleanUserArray(items) {
    const seen = new Set();
    const cleaned = [];

    for (const item of items) {
        const normalized = normalizeUserRecord(item);
        if (!normalized) continue;
        if (seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        cleaned.push(normalized);
    }

    return cleaned;
}

function cleanConsolidatedFile(data) {
    if (!isPlainObject(data) || !Array.isArray(data.unique_data)) {
        return { changed: false, data };
    }

    const next = { ...data, unique_data: cleanUserArray(data.unique_data) };
    const changed = JSON.stringify(next) !== JSON.stringify(data);
    return { changed, data: next };
}

function cleanFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    let next;
    let changed = false;

    if (Array.isArray(parsed)) {
        next = cleanUserArray(parsed);
        changed = JSON.stringify(next) !== JSON.stringify(parsed);
    } else if (filePath.endsWith('_consolidated.json')) {
        const result = cleanConsolidatedFile(parsed);
        next = result.data;
        changed = result.changed;
    } else {
        return { filePath, skipped: true, reason: 'unsupported shape' };
    }

    if (changed) {
        fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    }

    const beforeCount = Array.isArray(parsed) ? parsed.length : (parsed.unique_data?.length || 0);
    const afterCount = Array.isArray(next) ? next.length : (next.unique_data?.length || 0);

    return {
        filePath,
        changed,
        beforeCount,
        afterCount,
        removed: beforeCount - afterCount
    };
}

function main() {
    if (hasConsolidatedMockData(BATCH_DIR)) {
        const shards = readMockShards(BATCH_DIR);
        const cleanedShards = shards.map((shard) => cleanUserArray(shard));
        const results = shards.map((shard, index) => {
            const beforeCount = shard.length;
            const afterCount = cleanedShards[index].length;
            return {
                shard: index,
                changed: beforeCount !== afterCount,
                beforeCount,
                afterCount,
                removed: beforeCount - afterCount
            };
        });
        writeMockShards(cleanedShards, BATCH_DIR);

        const changed = results.filter((r) => r.changed);
        const totalRemoved = changed.reduce((sum, r) => sum + (r.removed || 0), 0);
        console.log(JSON.stringify({
            filesProcessed: shards.length,
            filesChanged: changed.length,
            entriesRemoved: totalRemoved,
            consolidatedFile: 'mock_data.json',
            changedFiles: changed
        }, null, 2));
        return;
    }

    const files = listLegacyShardFiles(BATCH_DIR, SHARD_FILE_PATTERN)
        .map((entry) => entry.filePath);

    const results = files.map(cleanFile);
    const changed = results.filter((r) => r.changed);
    const totalRemoved = changed.reduce((sum, r) => sum + (r.removed || 0), 0);

    console.log(JSON.stringify({
        filesProcessed: files.length,
        filesChanged: changed.length,
        entriesRemoved: totalRemoved,
        changedFiles: changed.map((r) => ({
            file: path.basename(r.filePath),
            removed: r.removed,
            before: r.beforeCount,
            after: r.afterCount
        }))
    }, null, 2));
}

main();
