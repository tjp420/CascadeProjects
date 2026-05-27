const { AIProxyGateway } = require('./ai-proxy-gateway');
const { DLPDashboard } = require('./dlp-dashboard');
const logger = require('./lib/app-logger');

class EnterpriseDLP {
    constructor(config = {}) {
        this.config = {
            proxyPort: Number(config.proxyPort || process.env.PROXY_PORT) || 8080,
            dashboardPort: Number(config.dashboardPort || process.env.DASHBOARD_PORT) || 3000,
            violationLogPath: config.violationLogPath || process.env.VIOLATION_LOG_PATH || './ai-violations.log',
            blockOnMatch: config.blockOnMatch !== false && process.env.BLOCK_ON_MATCH !== 'false',
            alertWebhook: config.alertWebhook || process.env.ALERT_WEBHOOK || null,
            organizationName: config.organizationName || process.env.ORG_NAME || 'Enterprise'
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

        logger.info(`Proxy: http://localhost:${this.config.proxyPort}`);
        logger.info(`Dashboard: http://localhost:${this.config.dashboardPort}`);
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
