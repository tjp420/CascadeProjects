const http = require('http');
const https = require('https');

// Mock shared-utils requireProject helper before loading the gateway module
jest.mock('../shared-utils/index.cjs', () => {
    return () => ({
        scanTextContent: () => []
    });
});

const { AIProxyGateway } = require('../ai-proxy-gateway.cjs');

describe('AIProxyGateway timeout hardening', () => {
    let origHttpsRequest;
    let gateway;

    beforeAll(() => {
        origHttpsRequest = https.request;
        // Mock https.request to simulate an unresponsive upstream that triggers socket timeout
        https.request = function (options, cb) {
            const EventEmitter = require('events');
            const req = new EventEmitter();
            req.write = () => {};
            req.end = () => {};
            req.setTimeout = (ms, fn) => {
                // call timeout immediate-ish
                setImmediate(fn);
            };
            req.destroy = (err) => {
                // emit error asynchronously to trigger error handlers
                setImmediate(() => req.emit('error', err));
            };
            return req;
        };
    });

    afterAll(() => {
        https.request = origHttpsRequest;
    });

    test('forwards request but returns 504 on upstream timeout', (done) => {
        gateway = new AIProxyGateway({ port: 0, requestTimeout: 50 });
        const server = gateway.start();

        server.on('listening', () => {
            const port = server.address().port;
            const opts = {
                hostname: '127.0.0.1',
                port,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    host: 'api.openai.com',
                    'Content-Type': 'application/json',
                    'Content-Length': 2
                }
            };

            const req = http.request(opts, (res) => {
                let body = '';
                res.on('data', (c) => body += c.toString());
                res.on('end', () => {
                    try {
                        expect(res.statusCode).toBe(504);
                        const payload = JSON.parse(body);
                        expect(payload.error).toBe('Gateway timeout');
                        server.close(done);
                    } catch (err) {
                        server.close(() => done(err));
                    }
                });
            });

            req.on('error', (e) => {
                server.close(() => done(e));
            });

            req.write('{}');
            req.end();
        });
    });
});
