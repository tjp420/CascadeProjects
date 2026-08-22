'use strict';

/**
 * Agent PDA — Memory Store
 *
 * Local-first JSON-backed memory store for AI agents.
 * Each workspace gets .simplebeacon/agent-pda/memories.json
 *
 * Zero native dependencies. Atomic writes via atomic-writer.js.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteFileSync } = require('../lib/atomic-writer');

const DEFAULT_DATA = { memories: [], version: 1 };

function getDbPath(projectRoot) {
    return path.join(projectRoot || process.cwd(), '.simplebeacon', 'agent-pda', 'memories.json');
}

function load(dbPath) {
    try {
        const raw = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(raw);
        if (!data.memories || !Array.isArray(data.memories)) return { memories: [], version: 1 };
        return data;
    } catch {
        return { memories: [], version: 1 };
    }
}

function save(dbPath, data) {
    atomicWriteFileSync(dbPath, JSON.stringify(data, null, 2));
}

function genId() {
    return 'mem_' + crypto.randomBytes(6).toString('hex');
}

/**
 * Store a memory for an agent.
 * @param {string} projectRoot
 * @param {string} agentId
 * @param {string} key — unique key within agent+category
 * @param {string} value — the memory content
 * @param {string} category — decision|fact|context|session-note|handoff
 * @param {object} opts — { ttlSeconds }
 * @returns {object} the stored memory
 */
function remember(projectRoot, agentId, key, value, category = 'context', opts = {}) {
    const dbPath = getDbPath(projectRoot);
    const data = load(dbPath);
    const now = Date.now();
    const expiresAt = opts.ttlSeconds ? now + opts.ttlSeconds * 1000 : null;
    const sessionId = opts.sessionId || null;

    // Upsert: replace if same agent+key+category+session
    const idx = data.memories.findIndex(m =>
        m.agentId === agentId &&
        m.key === key &&
        m.category === category &&
        (m.sessionId || null) === sessionId
    );
    const memory = {
        id: idx >= 0 ? data.memories[idx].id : genId(),
        agentId,
        key,
        value,
        category,
        sessionId,
        createdAt: idx >= 0 ? data.memories[idx].createdAt : now,
        updatedAt: now,
        expiresAt
    };

    if (idx >= 0) {
        data.memories[idx] = memory;
    } else {
        data.memories.push(memory);
    }

    save(dbPath, data);
    return memory;
}

/**
 * Recall memories for an agent.
 * @param {string} projectRoot
 * @param {string} agentId — filter by agent (ignored if opts.allAgents is true)
 * @param {string} key — optional, filter by key
 * @param {string} category — optional, filter by category
 * @param {object} opts — { allAgents: bool, search: string (substring match on value) }
 * @returns {array} matching memories (not expired)
 */
function recall(projectRoot, agentId, key, category, opts = {}) {
    const dbPath = getDbPath(projectRoot);
    const data = load(dbPath);
    const now = Date.now();
    const searchLower = opts.search ? opts.search.toLowerCase() : null;
    const sessionId = opts.sessionId || null;

    return data.memories.filter(m => {
        if (!opts.allAgents && m.agentId !== agentId) return false;
        if (key && m.key !== key) return false;
        if (category && m.category !== category) return false;
        if (m.expiresAt && m.expiresAt < now) return false;
        if (searchLower && !m.value.toLowerCase().includes(searchLower) &&
            !m.key.toLowerCase().includes(searchLower)) return false;
        // Session filtering: if sessionId specified, only return memories from that session
        // If sessionId is null and opts.includeSessionless is true, only return sessionless memories
        // If sessionId is null and opts.includeSessionless is not set, return all memories (session + sessionless)
        if (sessionId !== null) {
            if ((m.sessionId || null) !== sessionId) return false;
        }
        return true;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Recall the latest memory for a specific key.
 * @returns {object|null}
 */
function recallLatest(projectRoot, agentId, key, category) {
    const results = recall(projectRoot, agentId, key, category);
    return results.length > 0 ? results[0] : null;
}

/**
 * Delete a memory.
 * @returns {boolean} true if deleted
 */
function forget(projectRoot, agentId, key, category) {
    const dbPath = getDbPath(projectRoot);
    const data = load(dbPath);
    const before = data.memories.length;
    data.memories = data.memories.filter(m => {
        if (m.agentId !== agentId) return true;
        if (key && m.key !== key) return true;
        if (category && m.category !== category) return true;
        return false;
    });
    if (data.memories.length !== before) {
        save(dbPath, data);
        return true;
    }
    return false;
}

/**
 * List all memories for an agent, grouped by category.
 */
function listByCategory(projectRoot, agentId) {
    const memories = recall(projectRoot, agentId);
    const grouped = {};
    for (const m of memories) {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m);
    }
    return grouped;
}

/**
 * Purge expired memories. Returns count purged.
 */
function purgeExpired(projectRoot) {
    const dbPath = getDbPath(projectRoot);
    const data = load(dbPath);
    const now = Date.now();
    const before = data.memories.length;
    data.memories = data.memories.filter(m => !m.expiresAt || m.expiresAt >= now);
    const purged = before - data.memories.length;
    if (purged > 0) save(dbPath, data);
    return purged;
}

/**
 * Export memories as a markdown document.
 * @param {string} projectRoot
 * @param {string} agentId — optional, export all agents if null
 * @param {object} opts — { category, search }
 * @returns {string} markdown content
 */
function exportMarkdown(projectRoot, agentId, opts = {}) {
    const memories = recall(projectRoot, agentId, null, opts.category, {
        allAgents: !agentId,
        search: opts.search
    });

    const lines = [];
    lines.push('# Agent PDA Memory Export');
    lines.push('');
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push(`Agent: ${agentId || 'all agents'}`);
    lines.push(`Memories: ${memories.length}`);
    lines.push('');

    // Group by category
    const grouped = {};
    for (const m of memories) {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m);
    }

    for (const category of Object.keys(grouped).sort()) {
        lines.push(`## ${category}`);
        lines.push('');
        for (const m of grouped[category]) {
            lines.push(`### ${m.key}`);
            lines.push('');
            lines.push(`- **ID:** ${m.id}`);
            lines.push(`- **Agent:** ${m.agentId}`);
            lines.push(`- **Created:** ${new Date(m.createdAt).toISOString()}`);
            lines.push(`- **Updated:** ${new Date(m.updatedAt).toISOString()}`);
            if (m.expiresAt) lines.push(`- **Expires:** ${new Date(m.expiresAt).toISOString()}`);
            lines.push('');
            lines.push(m.value);
            lines.push('');
        }
    }

    return lines.join('\n');
}

/**
 * Import memories from a markdown document.
 * Parses the format produced by exportMarkdown.
 * @param {string} projectRoot
 * @param {string} markdown
 * @param {object} opts — { agentId: override agent ID, dryRun: only parse, don't save }
 * @returns {object} { imported, skipped, errors }
 */
function importMarkdown(projectRoot, markdown, opts = {}) {
    const errors = [];
    let imported = 0;
    let skipped = 0;
    const parsed = [];

    const lines = markdown.split('\n');
    let currentCategory = null;
    let currentKey = null;
    let currentValue = [];
    let inValue = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('## ')) {
            // Save previous entry
            if (currentKey && currentValue.length) {
                parsed.push({ category: currentCategory, key: currentKey, value: currentValue.join('\n').trim() });
            }
            currentCategory = line.slice(3).trim();
            currentKey = null;
            currentValue = [];
            inValue = false;
            continue;
        }

        if (line.startsWith('### ')) {
            // Save previous entry
            if (currentKey && currentValue.length) {
                parsed.push({ category: currentCategory, key: currentKey, value: currentValue.join('\n').trim() });
            }
            currentKey = line.slice(4).trim();
            currentValue = [];
            inValue = false;
            continue;
        }

        // Skip metadata lines
        if (line.startsWith('- **') || line.startsWith('Exported:') || line.startsWith('Agent:') || line.startsWith('Memories:') || line === '') {
            if (inValue && line === '') {
                currentValue.push('');
            }
            continue;
        }

        // Everything else is value content
        if (currentKey) {
            inValue = true;
            currentValue.push(line);
        }
    }

    // Save last entry
    if (currentKey && currentValue.length) {
        parsed.push({ category: currentCategory, key: currentKey, value: currentValue.join('\n').trim() });
    }

    // Import parsed entries
    if (!opts.dryRun) {
        for (const entry of parsed) {
            if (!entry.category || !entry.key || !entry.value) {
                skipped++;
                continue;
            }
            try {
                const agentId = opts.agentId || 'imported';
                remember(projectRoot, agentId, entry.key, entry.value, entry.category);
                imported++;
            } catch (err) {
                errors.push({ key: entry.key, error: err.message });
            }
        }
    } else {
        imported = parsed.length;
    }

    return { imported, skipped, errors, parsed: opts.dryRun ? parsed : undefined };
}

module.exports = {
    remember,
    recall,
    recallLatest,
    forget,
    listByCategory,
    purgeExpired,
    exportMarkdown,
    importMarkdown,
    _getDbPath: getDbPath,
    _load: load,
    _save: save
};
