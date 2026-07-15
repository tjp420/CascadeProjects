/**
 * HTTP forward proxy gateway that screens AI API request bodies for sensitive data.
 *
 * Usage: point clients at http://localhost:constants.AI_PROXY_PORT with Host header set to api.openai.com
 * (or configure HTTP_PROXY). This is an application-layer forward proxy, not TLS MITM.
 *
 * EU AI Act Documentation Marker:
 * - Classification: Annex III AI system indicator (Generative AI / LLM integration)
 * - Article 50: Transparency — upstream consumers (chatbot, analyze) disclose AI-generated content
 *   This component interacts with artificial intelligence providers (OpenAI, Anthropic, Cohere, Google).
 * - Purpose: Data-loss-prevention proxy for AI provider traffic; no autonomous decisions
 * - Risk Level: Limited risk
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const { scanEnterprisePatterns, isBlockingFinding } = require('./enterprise-patterns');
const logger = require('./lib/app-logger');
const requireProject = require('../shared-utils/index.cjs');
const { scanTextContent } = requireProject('packages/simplebeacon-cli/src/lib/credential-pattern-scanner.js');


const constants = require('./config/constants.cjs');
const AI_DOMAINS = new Set([
    'api.openai.com',
    'api.anthropic.com',
    'chat.openai.com',
    'claude.ai',
    'api.cohere.com',
    'generativelanguage.googleapis.com'
]);

const AI_PATHS = ['/v1/chat/completions', '/v1/messages', '/v1/generate', '/v1/completions'];

const DEFAULT_CONFIG = {
    port: Number(process.env.PROXY_PORT) || constants.AI_PROXY_PORT,
    maxRequestSize: 10 * constants.BYTES_PER_KB * constants.BYTES_PER_KB,
    requestTimeout: constants.TIMEOUT_30S,
    logViolations: true,
    violationLogPath: process.env.VIOLATION_LOG_PATH || './ai-violations.log',
    blockOnMatch: process.env.BLOCK_ON_MATCH !== 'false',
    alertWebhook: process.env.ALERT_WEBHOOK || null
};

/**
 * A i proxy gateway.
 */
class AIProxyGateway {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.server = null;
        this.violationCount = 0;
    }

    start() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(this.config.port, () => {
            logger.info(`AI Proxy Gateway running on port ${this.config.port}`);
            logger.info(`Blocking mode: ${this.config.blockOnMatch ? 'ENABLED' : 'MONITOR ONLY'}`);
            logger.info(`Violations logged to: ${this.config.violationLogPath}`);
        });

        return this.server;
    }

    async handleRequest(req, res) {
        const hostHeader = req.headers.host || '';
        const hostname = hostHeader.split(':')[0];
        const requestUrl = `http://${hostHeader}${req.url}`;

        if (!this.isAIRequest(hostname, req.url)) {
            this.sendNotFound(res);
            return;
        }

        const contentLength = Number.parseInt(req.headers['content-length'] || '0', 10);
        if (contentLength > this.config.maxRequestSize) {
            this.sendRequestTooLarge(res);
            return;
        }

        try {
            const body = await this.collectRequestBody(req);
            const scanResult = this.scanRequest(body, requestUrl);

            if (scanResult.blocked && this.config.blockOnMatch) {
                this.logViolation(scanResult, req, requestUrl);
                this.sendViolationResponse(res, scanResult);
                return;
            }

            if (scanResult.blocked && !this.config.blockOnMatch) {
                this.logViolation(scanResult, req, requestUrl);
            }

            await this.forwardRequest(req, res, body, hostname);
        } catch (error) {
            console.error('Gateway error:', error);
            this.sendErrorResponse(res, error);
        }
    }

    isAIRequest(hostname, pathname) {
        if (AI_DOMAINS.has(hostname)) {
            return true;
        }
        return AI_PATHS.some((entry) => pathname.includes(entry));
    }

    collectRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            let total = 0;

            const timeout = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, this.config.requestTimeout);

            req.on('data', (chunk) => {
                total += chunk.length;
                if (total > this.config.maxRequestSize) {
                    clearTimeout(timeout);
                    reject(new Error('Request too large'));
                    req.destroy();
                    return;
                }
                body += chunk;
            });

            req.on('end', () => {
                clearTimeout(timeout);
                resolve(body);
            });

            req.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    scanRequest(body, requestUrl) {
        const credentialFindings = scanTextContent('request', body, requestUrl);
        const privacyFindings = scanEnterprisePatterns(body, { requestUrl });
        const findings = [...credentialFindings, ...privacyFindings];
        const criticalFindings = findings.filter(isBlockingFinding);

        if (criticalFindings.length > 0) {
            const top = criticalFindings[0];
            return {
                blocked: true,
                patterns: [...new Set(criticalFindings.map((f) => f.pattern))],
                severity: top.severityBand || top.severity,
                count: criticalFindings.length,
                details: criticalFindings
            };
        }

        return {
            blocked: false,
            patterns: [],
            count: 0,
            details: []
        };
    }

    logViolation(scanResult, req, requestUrl) {
        this.violationCount += 1;

        const violation = {
            id: `VIOLATION-${Date.now()}-${this.violationCount}`,
            timestamp: new Date().toISOString(),
            url: requestUrl,
            method: req.method,
            patterns: scanResult.patterns,
            severity: scanResult.severity,
            count: scanResult.count,
            userAgent: req.headers['user-agent'],
            sourceIp: req.socket.remoteAddress,
            headers: {
                referer: req.headers.referer,
                origin: req.headers.origin
            }
        };

        if (this.config.logViolations) {
            try {
                fs.appendFileSync(this.config.violationLogPath, `${JSON.stringify(violation)}\n`);
            } catch (error) {
                console.error('Failed to log violation:', error);
            }
        }

        if (this.config.alertWebhook) {
            this.sendWebhookAlert(violation);
        }

        logger.info(`Violation #${this.violationCount}: ${scanResult.patterns.join(', ')}`);
    }

    sendWebhookAlert(violation) {
        try {
            const webhookUrl = new URL(this.config.alertWebhook);
            const payload = JSON.stringify({
                text: 'AI Data Leak Prevention Alert',
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: [
                                '*Data Leak Blocked*',
                                `*Severity:* ${violation.severity}`,
                                `*Patterns:* ${violation.patterns.join(', ')}`,
                                `*URL:* ${violation.url}`,
                                `*Time:* ${violation.timestamp}`
                            ].join('\n')
                        }
                    }
                ]
            });

            const req = https.request({
                hostname: webhookUrl.hostname,
                port: webhookUrl.port || 443,
                path: `${webhookUrl.pathname}${webhookUrl.search}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            });

            req.on('error', (error) => {
                console.error('Failed to send webhook alert:', error);
            });

            req.write(payload);
            req.end();
        } catch (error) {
            console.error('Failed to send webhook alert:', error);
        }
    }

    forwardRequest(req, res, body, hostname) {
        const path = req.url;
        const headers = { ...req.headers, host: hostname };
        delete headers['proxy-connection'];
        delete headers.connection;

        return new Promise((resolve, reject) => {
            const proxyReq = https.request({
                hostname,
                port: 443,
                path,
                method: req.method,
                headers
            }, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
                proxyRes.on('end', resolve);
                proxyRes.on('error', reject);
            });

            proxyReq.on('error', (error) => {
                reject(error);
            });

            if (body) {
                proxyReq.write(body);
            }
            proxyReq.end();
        });
    }

    sendNotFound(res) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Not found',
            message: 'This gateway only proxies AI API requests'
        }));
    }

    sendRequestTooLarge(res) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Request too large',
            message: `Maximum request size is ${this.config.maxRequestSize / 1024 / 1024}MB`
        }));
    }

    sendViolationResponse(res, scanResult) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Request blocked',
            reason: 'Sensitive data patterns detected',
            blocked: true,
            patterns: scanResult.patterns,
            severity: scanResult.severity,
            count: scanResult.count,
            message: 'This request contains sensitive data that violates data protection policies. Remove the sensitive information and try again.',
            details: scanResult.details.map((entry) => ({
                pattern: entry.pattern,
                description: entry.description,
                recommendation: entry.recommendation
            }))
        }));
    }

    sendErrorResponse(res, error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Gateway error',
            message: error.message
        }));
    }

    getStats() {
        return {
            uptime: process.uptime(),
            violations: this.violationCount,
            config: {
                port: this.config.port,
                blockOnMatch: this.config.blockOnMatch,
                maxRequestSize: this.config.maxRequestSize
            }
        };
    }
}

if (require.main === module) {
    const gateway = new AIProxyGateway();
    gateway.start();

    process.on('SIGTERM', () => {
        if (gateway.server) {
            gateway.server.close(() => process.exit(0));
        } else {
            process.exit(0);
        }
    });
}

module.exports = { AIProxyGateway };
