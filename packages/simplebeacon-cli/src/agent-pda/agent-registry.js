'use strict';

/**
 * Agent PDA — Agent Registry
 *
 * Registers and tracks AI agents in a workspace.
 * Stored in .simplebeacon/agent-pda/agents.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteFileSync } = require('../lib/atomic-writer');
const { getAgentIdentity } = require('./agent-detect');

const DEFAULT_DATA = { agents: [], version: 1 };

function getDbPath(projectRoot) {
    return path.join(projectRoot || process.cwd(), '.simplebeacon', 'agent-pda', 'agents.json');
}

function load(dbPath) {
    try {
        const raw = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(raw);
        if (!data.agents || !Array.isArray(data.agents)) return { agents: [], version: 1 };
        return data;
    } catch {
        return { agents: [], version: 1 };
    }
}

function save(dbPath, data) {
    atomicWriteFileSync(dbPath, JSON.stringify(data, null, 2));
}

function genId() {
    return 'agent_' + crypto.randomBytes(6).toString('hex');
}

/**
 * Register an agent. If an agent with the same name+type exists, return it.
 * Optionally creates a new session for the agent.
 * @param {string} projectRoot
 * @param {string} name — agent display name
 * @param {string} type — cursor|claude|devin|copilot|cline|windsurf|aider|continue|custom
 * @param {object} opts — { sessionId: create new session, reuse existing }
 * @returns {object} the agent record (with sessionId if sessions enabled)
 */
function registerAgent(projectRoot, name, type, opts = {}) {
    const dbPath = getDbPath(projectRoot);
    const data = load(dbPath);

    // Check for existing agent with same name+type
    const existing = data.agents.find(a => a.name === name && a.type === type);
    if (existing) {
        existing.lastSeen = Date.now();

        // Session handling: if sessionId provided, find or create it
        if (opts.sessionId) {
            if (!existing.sessions) existing.sessions = [];
            let session = existing.sessions.find(s => s.id === opts.sessionId);
            if (!session) {
                session = { id: opts.sessionId, createdAt: Date.now(), lastSeen: Date.now() };
                existing.sessions.push(session);
            } else {
                session.lastSeen = Date.now();
            }
            existing.currentSessionId = opts.sessionId;
        }

        save(dbPath, data);
        return existing;
    }

    const now = Date.now();
    const agent = {
        id: genId(),
        name,
        type: type || 'custom',
        createdAt: now,
        lastSeen: now,
        sessions: [],
        currentSessionId: null
    };

    if (opts.sessionId) {
        agent.sessions.push({ id: opts.sessionId, createdAt: now, lastSeen: now });
        agent.currentSessionId = opts.sessionId;
    }

    data.agents.push(agent);
    save(dbPath, data);
    return agent;
}

/**
 * Auto-register the current agent based on environment detection.
 * @returns {object} the agent record
 */
function autoRegister(projectRoot) {
    const identity = getAgentIdentity();
    return registerAgent(projectRoot, identity.name, identity.type);
}

/**
 * List all registered agents.
 */
function listAgents(projectRoot) {
    const dbPath = getDbPath(projectRoot);
    const data = load(dbPath);
    return data.agents.sort((a, b) => b.lastSeen - a.lastSeen);
}

/**
 * Get an agent by ID.
 */
function getAgent(projectRoot, agentId) {
    const dbPath = getDbPath(projectRoot);
    const data = load(dbPath);
    return data.agents.find(a => a.id === agentId) || null;
}

/**
 * Update an agent's lastSeen timestamp.
 */
function touchAgent(projectRoot, agentId) {
    const dbPath = getDbPath(projectRoot);
    const data = load(dbPath);
    const idx = data.agents.findIndex(a => a.id === agentId);
    if (idx < 0) return null;
    data.agents[idx].lastSeen = Date.now();
    save(dbPath, data);
    return data.agents[idx];
}

/**
 * Remove an agent by ID.
 */
function removeAgent(projectRoot, agentId) {
    const dbPath = getDbPath(projectRoot);
    const data = load(dbPath);
    const before = data.agents.length;
    data.agents = data.agents.filter(a => a.id !== agentId);
    if (data.agents.length !== before) {
        save(dbPath, data);
        return true;
    }
    return false;
}

module.exports = {
    registerAgent,
    autoRegister,
    listAgents,
    getAgent,
    touchAgent,
    removeAgent,
    _getDbPath: getDbPath,
    _load: load,
    _save: save
};
