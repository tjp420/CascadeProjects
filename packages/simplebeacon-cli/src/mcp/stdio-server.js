/**
 * Minimal MCP stdio server (JSON-RPC 2.0) — zero extra npm dependencies.
 * Implements tools/list + tools/call for Cursor, Claude Desktop, etc.
 */

const readline = require('readline');
const path = require('path');
const { TOOL_DEFINITIONS, createMcpToolHandlers } = require('./tools');
const { createRealtimeWatcher } = require('./realtime-watcher');

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'simplebeacon', version: '1.3.0' };

function createMcpStdioServer(options = {}) {
    const handlers = createMcpToolHandlers(options);
    let initialized = false;
    const activeRequests = new Map(); // requestId -> { cancelled, startTime }
    const logger = { log: (...a) => { if (options.debug) console.error('[MCP]', ...a); } };

    function send(message) {
        const line = JSON.stringify(message);
        process.stdout.write(`${line}\n`);
        logger.log('→', message.method || message.id || 'notify', line.length, 'bytes');
    }

    function sendProgress(token, progress, total) {
        send({
            jsonrpc: '2.0',
            method: 'notifications/progress',
            params: { progressToken: token, progress, total }
        });
    }

    // ── Real-time file watcher ──────────────────────────────────────────────
    // Watches the project directory and pushes findings to the MCP client
    // via notifications/message — agents see issues without calling any tool.
    let realtimeWatcher = null;

    function startRealtimeWatch(projectRoot) {
        stopRealtimeWatch();
        const { scanFileOnDisk } = require('../lib/snippet-scanner');
        const { resolveCliProjectRoot } = require('../lib/snippet-scanner');

        const root = resolveCliProjectRoot(projectRoot || process.cwd());

        realtimeWatcher = createRealtimeWatcher({
            projectRoot: root,
            scanFile: (absolutePath) => {
                const rel = path.relative(root, absolutePath);
                return scanFileOnDisk(root, rel);
            },
            onFindings: (relativePath, findings, summary) => {
                // Push findings to the MCP client as a log notification
                const level = summary.blockingCount > 0 ? 'error' : 'info';
                const data = {
                    type: 'realtime-scan',
                    filePath: relativePath,
                    blockingCount: summary.blockingCount,
                    findingCount: summary.findingCount,
                    severityBreakdown: summary.severityBreakdown,
                    findings: findings.slice(0, 10).map((f) => ({
                        severity: f.severity,
                        type: f.type,
                        description: f.description ? String(f.description).slice(0, 200) : '',
                        line: f.line || null,
                        rule: f.rule || f.pattern || null
                    })),
                    timestamp: summary.timestamp
                };
                send({
                    jsonrpc: '2.0',
                    method: 'notifications/message',
                    params: { level, data }
                });
            },
            logger: {
                log: (...a) => { if (options.debug) console.error('[MCP watcher]', ...a); },
                error: (...a) => { console.error('[MCP watcher]', ...a); }
            }
        });

        realtimeWatcher.start();
        return realtimeWatcher.getStats();
    }

    function stopRealtimeWatch() {
        if (realtimeWatcher) {
            realtimeWatcher.stop();
            realtimeWatcher = null;
        }
    }

    function getRealtimeWatchStats() {
        return realtimeWatcher ? realtimeWatcher.getStats() : { active: false };
    }

    function toolListResult() {
        return {
            tools: TOOL_DEFINITIONS.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
            }))
        };
    }

    function validateMessage(msg) {
        if (msg.jsonrpc !== '2.0') return { valid: false, error: 'Invalid jsonrpc version' };
        if (!msg.method || typeof msg.method !== 'string') return { valid: false, error: 'Missing or invalid method' };
        return { valid: true };
    }

    function handleRequest(message) {
        const validation = validateMessage(message);
        if (!validation.valid) {
            if (message.id !== undefined) {
                send({ jsonrpc: '2.0', id: message.id, error: { code: -32600, message: validation.error } });
            }
            return;
        }

        const { id, method, params } = message;
        logger.log('←', method, id !== undefined ? `id=${id}` : 'notify');

        if (method === 'initialize') {
            send({
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: PROTOCOL_VERSION,
                    capabilities: { tools: {}, progress: {}, logging: {} },
                    serverInfo: SERVER_INFO
                }
            });
            initialized = true;
            logger.log('Initialized');
            return;
        }

        if (method === '$/cancelRequest' && params && params.id !== undefined) {
            const req = activeRequests.get(params.id);
            if (req) { req.cancelled = true; }
            return; // No response for cancel
        }

        if (!initialized && method !== 'ping') {
            send({
                jsonrpc: '2.0',
                id,
                error: { code: -32002, message: 'Server not initialized. Call initialize first.' }
            });
            return;
        }

        if (method === 'ping') {
            send({ jsonrpc: '2.0', id, result: {} });
            return;
        }

        if (method === 'tools/list') {
            send({ jsonrpc: '2.0', id, result: toolListResult() });
            return;
        }

        if (method === 'tools/call') {
            const name = params?.name;
            const args = params?.arguments || {};
            const handler = handlers[name];

            // Real-time watch control — handled inline (not in handlers map)
            if (name === 'watch_project') {
                const action = String(args.action || 'start').toLowerCase();
                if (action === 'start') {
                    const root = args.projectRoot || process.cwd();
                    const stats = startRealtimeWatch(root);
                    send({
                        jsonrpc: '2.0', id, result: {
                            content: [{ type: 'text', text: JSON.stringify({
                                active: true,
                                message: 'Real-time monitoring started. Findings will be pushed via notifications/message as files change.',
                                ...stats
                            }, null, 2) }]
                        }
                    });
                } else if (action === 'stop') {
                    stopRealtimeWatch();
                    send({
                        jsonrpc: '2.0', id, result: {
                            content: [{ type: 'text', text: JSON.stringify({
                                active: false,
                                message: 'Real-time monitoring stopped.'
                            }, null, 2) }]
                        }
                    });
                } else if (action === 'status') {
                    const stats = getRealtimeWatchStats();
                    send({
                        jsonrpc: '2.0', id, result: {
                            content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }]
                        }
                    });
                } else {
                    send({
                        jsonrpc: '2.0', id, result: {
                            content: [{ type: 'text', text: 'Invalid action. Use: start, stop, or status.' }],
                            isError: true
                        }
                    });
                }
                return;
            }

            if (!handler) {
                send({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                        isError: true
                    }
                });
                return;
            }

            const progressToken = params?.meta?.progressToken || id;
            activeRequests.set(id, { cancelled: false, startTime: Date.now() });
            const reqState = activeRequests.get(id);

            // Helper to check if cancelled mid-flight
            const checkCancelled = () => reqState.cancelled;

            (async () => {
                try {
                    // Progress for long-running tools
                    const longRunning = ['scan_project', 'run_analyzer_suite'];
                    if (longRunning.includes(name) && progressToken !== undefined) {
                        sendProgress(progressToken, 0, 100);
                    }

                    const result = await handler(args);

                    if (checkCancelled()) {
                        logger.log('Request cancelled:', id); // simplebeacon-ignore pii-logging — logs request ID only, no user data
                        activeRequests.delete(id);
                        return;
                    }

                    if (longRunning.includes(name) && progressToken !== undefined) {
                        sendProgress(progressToken, 100, 100);
                    }

                    const elapsed = Date.now() - reqState.startTime;
                    logger.log('Tool', name, 'completed in', elapsed, 'ms');
                    activeRequests.delete(id);
                    send({ jsonrpc: '2.0', id, result });
                } catch (err) {
                    activeRequests.delete(id);
                    logger.log('Tool', name, 'error:', err.message);
                    send({
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [{ type: 'text', text: err.message || 'Tool failed' }],
                            isError: true
                        }
                    });
                }
            })();
            return;
        }

        if (id !== undefined) {
            send({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Method not found: ${method}` }
            });
        }
    }

    function handleNotification(message) {
        const validation = validateMessage(message);
        if (!validation.valid) return;

        if (message.method === 'notifications/initialized') {
            initialized = true;
            logger.log('Client initialized');
        }
        if (message.method === 'notifications/cancelled' && message.params && message.params.requestId) {
            const req = activeRequests.get(message.params.requestId);
            if (req) req.cancelled = true;
        }
    }

    function start() {
        const rl = readline.createInterface({
            input: process.stdin,
            crlfDelay: Infinity
        });

        process.on('SIGINT', () => { logger.log('SIGINT'); stopRealtimeWatch(); process.exit(0); });
        process.on('SIGTERM', () => { logger.log('SIGTERM'); stopRealtimeWatch(); process.exit(0); });
        process.on('uncaughtException', (err) => { console.error('[MCP] Uncaught:', err.message); stopRealtimeWatch(); process.exit(1); });

        rl.on('line', (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;

            let message;
            try {
                message = JSON.parse(trimmed);
            } catch (e) {
                logger.log('JSON parse error:', e.message);
                return;
            }

            if (message.method && message.id === undefined) {
                handleNotification(message);
                return;
            }

            handleRequest(message);
        });

        rl.on('close', () => {
            logger.log('stdin closed');
            process.exit(0);
        });

        logger.log('Server ready. Protocol:', PROTOCOL_VERSION);
    }

    return { start, toolListResult, handlers, startRealtimeWatch, stopRealtimeWatch, getRealtimeWatchStats };
}

module.exports = {
    createMcpStdioServer,
    PROTOCOL_VERSION,
    SERVER_INFO
};
