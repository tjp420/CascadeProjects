// simplebeacon-ignore: test fixture — all findings are false positives
/**
 * WebSocket Integration Test for Realtime Analysis API
 *
 * Tests the full flow against a live server:
 *   1. POST /api/realtime/session to create an analysis session
 *   2. Connect to ws://localhost:8082/api/realtime/stream?sessionId=...
 *   3. Send a ping message and verify pong response
 *   4. Close the session via DELETE
 *
 * Usage:
 *   node tests/integration/realtime-ws-integration.test.cjs
 *
 * Prerequisites:
 *   - Server running on port 58000 (node simplebeacon-server.cjs)
 *   - WebSocket server on port 8082 (auto-started by the server)
 */

const http = require('http');
const WebSocket = require('ws');

const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = process.env.API_PORT || 58000;
const WS_PORT = process.env.WS_PORT || 8082;

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const INFO = '\x1b[36mINFO\x1b[0m';

let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    testCount++;
    if (condition) {
        passCount++;
        console.log(`  ${PASS} ${message}`);
    } else {
        failCount++;
        console.log(`  ${FAIL} ${message}`);
    }
}

function httpJsonRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: API_HOST,
            port: API_PORT,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
            },
            timeout: 10000
        };
        const req = http.request(options, (res) => {
            let chunks = '';
            res.on('data', (d) => { chunks += d; });
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(chunks) });
                } catch {
                    resolve({ statusCode: res.statusCode, body: chunks });
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
        if (data) req.write(data);
        req.end();
    });
}

function wsConnect(url, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
        }, timeoutMs);
        ws.on('open', () => {
            clearTimeout(timer);
            resolve(ws);
        });
        ws.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

async function runTests() {
    console.log(`\n${INFO} WebSocket Integration Test`);
    console.log(`${INFO} API: http://${API_HOST}:${API_PORT}`);
    console.log(`${INFO} WS:  ws://${API_HOST}:${WS_PORT}/api/realtime/stream\n`);

    // Test 1: Health check
    console.log('Test 1: Server health check');
    try {
        const health = await httpJsonRequest('GET', '/api/health');
        assert(health.statusCode === 200, `GET /api/health returns 200 (got ${health.statusCode})`);
        assert(health.body.status === 'healthy', `Response status is "healthy" (got "${health.body.status}")`);
    } catch (err) {
        assert(false, `Health check failed: ${err.message}`);
        console.log(`\n${FAIL} Server not reachable. Start it with: cd ai-platform && node simplebeacon-server.cjs\n`);
        return finish();
    }

    // Test 2: Create analysis session
    console.log('\nTest 2: Create analysis session via REST');
    let sessionId = null;
    try {
        const res = await httpJsonRequest('POST', '/api/realtime/session', {
            profile: 'balanced',
            analysisType: 'general'
        });
        assert(res.statusCode === 200, `POST /api/realtime/session returns 200 (got ${res.statusCode})`);
        assert(res.body.success === true, `Response success is true`);
        assert(!!res.body.sessionId, `sessionId is present: ${res.body.sessionId}`);
        sessionId = res.body.sessionId;
    } catch (err) {
        assert(false, `Session creation failed: ${err.message}`);
        return finish();
    }

    // Test 3: Connect to WebSocket with session
    console.log('\nTest 3: WebSocket connection with valid session');
    let ws = null;
    try {
        ws = await wsConnect(`ws://${API_HOST}:${WS_PORT}/api/realtime/stream?sessionId=${sessionId}`);
        assert(true, `WebSocket connected on port ${WS_PORT} with sessionId`);
    } catch (err) {
        assert(false, `WebSocket connection failed: ${err.message}`);
        return finish();
    }

    // Test 4: Receive initial status message
    console.log('\nTest 4: Receive initial status message');
    await new Promise((resolve) => {
        const timer = setTimeout(() => {
            assert(false, 'Timeout waiting for initial status message');
            resolve();
        }, 5000);
        const handler = (data) => {
            clearTimeout(timer);
            ws.off('message', handler);
            try {
                const msg = JSON.parse(data.toString());
                assert(msg.type === 'status', `Initial message type is "status" (got "${msg.type}")`);
                assert(msg.sessionId === sessionId, `Message sessionId matches (got "${msg.sessionId}")`);
                assert(msg.status === 'connected', `Message status is "connected" (got "${msg.status}")`);
            } catch (err) {
                assert(false, `Failed to parse initial message: ${err.message}`);
            }
            resolve();
        };
        ws.on('message', handler);
    });

    // Test 5: Send ping, receive pong
    console.log('\nTest 5: Ping/pong round-trip');
    await new Promise((resolve) => {
        const timer = setTimeout(() => {
            assert(false, 'Timeout waiting for pong response');
            resolve();
        }, 5000);
        const handler = (data) => {
            clearTimeout(timer);
            ws.off('message', handler);
            try {
                const msg = JSON.parse(data.toString());
                assert(msg.type === 'pong', `Response type is "pong" (got "${msg.type}")`);
                assert(msg.sessionId === sessionId, `Pong sessionId matches`);
                assert(typeof msg.timestamp === 'number', `Pong timestamp is a number`);
            } catch (err) {
                assert(false, `Failed to parse pong: ${err.message}`);
            }
            resolve();
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ type: 'ping' }));
    });

    // Test 6: Close WebSocket
    console.log('\nTest 6: Close WebSocket connection');
    await new Promise((resolve) => {
        ws.on('close', () => {
            assert(true, 'WebSocket closed cleanly');
            resolve();
        });
        ws.close();
    });

    // Test 7: Delete session via REST
    console.log('\nTest 7: Delete session via REST');
    try {
        const res = await httpJsonRequest('DELETE', `/api/realtime/session/${sessionId}`);
        assert(res.statusCode === 200, `DELETE /api/realtime/session returns 200 (got ${res.statusCode})`);
        assert(res.body.success === true, `Delete response success is true`);
    } catch (err) {
        assert(false, `Session deletion failed: ${err.message}`);
    }

    // Test 8: WebSocket rejection without sessionId
    console.log('\nTest 8: WebSocket rejection without sessionId');
    await new Promise((resolve) => {
        const wsNoSession = new WebSocket(`ws://${API_HOST}:${WS_PORT}/api/realtime/stream`);
        const timer = setTimeout(() => {
            wsNoSession.close();
            assert(false, 'Timeout — server did not close connection');
            resolve();
        }, 5000);
        wsNoSession.on('open', () => {
            // Server may briefly accept then close with 1008
        });
        wsNoSession.on('close', (code, reason) => {
            clearTimeout(timer);
            assert(code === 1008, `WebSocket closed with code 1008 (got ${code}): ${reason.toString()}`);
            resolve();
        });
        wsNoSession.on('error', () => {
            // Some Node versions emit error before close
        });
    });

    finish();
}

function finish() {
    console.log(`\n${INFO} Results: ${passCount} pass, ${failCount} fail, ${testCount} total\n`);
    if (failCount > 0) {
        console.log(`${FAIL} Integration test FAILED\n`);
        process.exit(1);
    } else {
        console.log(`${PASS} Integration test PASSED\n`);
        process.exit(0);
    }
}

runTests().catch((err) => {
    console.error(`\n${FAIL} Unexpected error:`, err);
    process.exit(1);
});
