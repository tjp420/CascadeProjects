// SPDX-License-Identifier: MIT
/**
 * Enterprise DLP gateway and dashboard bootstrap.
 *
 * @license MIT
 */

const { AIProxyGateway } = require('./ai-proxy-gateway.cjs');
const { DLPDashboard } = require('./dlp-dashboard.cjs');
const logger = require('./lib/app-logger.cjs');

const constants = require('./config/constants.cjs');
/**
 * Enterprise d l p.
 */
class EnterpriseDLP {
    constructor(config = {}) {
        const env = process.env;
        this.config = {
            proxyPort: Number(config.proxyPort || env.PROXY_PORT) || constants.AI_PROXY_PORT,
            dashboardPort: Number(config.dashboardPort || env.DASHBOARD_PORT) || 3000,
            violationLogPath: config.violationLogPath || env.VIOLATION_LOG_PATH || './ai-violations.log',
            blockOnMatch: config.blockOnMatch !== false && env.BLOCK_ON_MATCH !== 'false',
            alertWebhook: config.alertWebhook || env.ALERT_WEBHOOK || null,
            organizationName: config.organizationName || env.ORG_NAME || 'Enterprise'
        };

        this.proxyGateway = new AIProxyGateway({
            port: this.config.proxyPort,
            violationLogPath: this.config.violationLogPath,
            blockOnMatch: this.config.blockOnMatch,
            alertWebhook: this.config.alertWebhook
        });

        this.dashboard = new DLPDashboard({
            port: this.config.dashboardPort,
            violationLogPath: this.config.violationLogPath
        });
    }

    start() {
        logger.info(`Starting Enterprise DLP for ${this.config.organizationName}`);
        logger.info(`Proxy port: ${this.config.proxyPort}`);
        logger.info(`Dashboard port: ${this.config.dashboardPort}`);
        logger.info(`Block mode: ${this.config.blockOnMatch ? 'ENABLED' : 'MONITOR ONLY'}`);
        logger.info(`Violation log: ${this.config.violationLogPath}`);

        this.proxyGateway.start();
        this.dashboard.start();

        logger.info(`Proxy listening on port ${this.config.proxyPort}`);
        logger.info(`DLP dashboard listening on port ${this.config.dashboardPort}`);
    }

    getSystemStatus() {
        return {
            proxy: this.proxyGateway.getStats(),
            organization: this.config.organizationName,
            config: this.config
        };
    }
}

if (require.main === module) {
    const dlp = new EnterpriseDLP();
    dlp.start();

    process.on('SIGTERM', () => process.exit(0));
}

module.exports = { EnterpriseDLP };
