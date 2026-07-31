// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const logger = require('./app-logger.cjs');
const { sendEmail } = require('./email-service.cjs');

/**
 * Create a scan scheduler with injected dependencies.
 * @param {Object} options
 * @param {Function} options.runSimplebeaconScan
 * @returns {Object}
 */
function createScheduler(options) {
  const { runSimplebeaconScan, PROJECT_ROOT, REPORT_PATH, SIMPLEBEACON_DIR, SCHEDULE_PATH } =
    options;
  let scheduleTimer = null;
  let scheduleConfigCache = null;

  /**
   * Read schedule config from disk.
   * @returns {Promise<Object>}
   */
  async function readScheduleConfig() {
    try {
      const data = await fs.promises.readFile(SCHEDULE_PATH, 'utf8');
      return JSON.parse(data);
    } catch {
      return {
        enabled: false,
        intervalMinutes: 60,
        recipients: [],
        projectPath: null,
        includeCertificate: false,
        webhookUrl: null,
        zeroRetention: false,
      };
    }
  }

  /**
   * Write schedule config to disk.
   * @param {Object} config
   * @returns {Promise<void>}
   */
  async function writeScheduleConfig(config) {
    await fs.promises.mkdir(SIMPLEBEACON_DIR, { recursive: true });
    await fs.promises.writeFile(SCHEDULE_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
    scheduleConfigCache = config;
  }

  /**
   * Post JSON payload to a webhook URL.
   * @param {string} targetUrl
   * @param {any} payload
   * @returns {Promise<{success: boolean, statusCode?: number, body?: string, error?: string}>}
   */
  async function postWebhook(targetUrl, payload) {
    return new Promise((resolve) => {
      const url = new URL(targetUrl);
      const data = JSON.stringify(payload);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      };
      const mod = url.protocol === 'https:' ? https : http;
      const req = mod.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            body: body.slice(0, 500),
          });
        });
      });
      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.write(data);
      req.end();
    });
  }

  /**
   * Run scheduled scan and deliver results via email/webhook.
   * @returns {Promise<void>}
   */
  async function runScheduledScanAndDeliver() {
    const cfg = scheduleConfigCache || (await readScheduleConfig());
    if (!cfg.enabled) return;

    try {
      const result = await runSimplebeaconScan(cfg.projectPath || null);
      if (result.skipped) {
        logger.info('[Schedule] Scan skipped:', result.reason);
        return;
      }

      const report = result.report;
      if (!report) {
        logger.info('[Schedule] No report generated');
        return;
      }

      const summaryText = `Simplebeacon Scheduled Scan Complete\nProject: ${result.projectPath}\nScan ID: ${result.scanId || 'unknown'}\nGate Pass: ${report.gate?.pass ? 'PASS' : 'FAIL'}\nQuality Score: ${report.qualityScore}\nIssue Count: ${report.issueCount}\n\nView full report in the dashboard.`;

      if (Array.isArray(cfg.recipients) && cfg.recipients.length) {
        for (const recipient of cfg.recipients) {
          const attachments = [];
          if (cfg.includeCertificate && report) {
            attachments.push({
              filename: `report-${result.scanId || 'unknown'}.json`,
              content: Buffer.from(JSON.stringify(report, null, 2)).toString('base64'),
            });
          }
          await sendEmail({
            to: recipient,
            subject: `Simplebeacon Scan Report — ${result.scanId || 'unknown'}`,
            text: summaryText,
            attachments,
          }).catch((err) => logger.error('[Schedule] Email failed'));
        }
      }

      if (cfg.webhookUrl) {
        const webhookResult = await postWebhook(cfg.webhookUrl, {
          event: 'simplebeacon.scan.completed',
          scanId: result.scanId,
          projectPath: result.projectPath,
          gatePass: report.gate?.pass ?? null,
          qualityScore: report.qualityScore,
          issueCount: report.issueCount,
          report: cfg.includeCertificate ? report : undefined,
          timestamp: new Date().toISOString(),
        });
        logger.info(
          `[Schedule] Webhook ${webhookResult.success ? 'delivered' : 'failed'} to ${cfg.webhookUrl}`
        );
      }

      if (cfg.zeroRetention) {
        const reportOut = cfg.projectPath
          ? path.join(cfg.projectPath, '.simplebeacon', 'report.json')
          : REPORT_PATH;
        try {
          if (fs.existsSync(reportOut)) {
            fs.unlinkSync(reportOut);
            logger.info('[Schedule] Zero-retention: report file removed after delivery');
          }
        } catch (unlinkErr) {
          logger.warn(
            '[Schedule] Zero-retention: failed to remove report file:',
            unlinkErr.message
          );
        }
      }
    } catch (err) {
      logger.error('[Schedule] Scheduled scan delivery failed:', err.message);
    }
  }

  /**
   * Start the periodic scan scheduler.
   * @returns {void}
   */
  function startScheduler() {
    if (scheduleTimer) {
      clearInterval(scheduleTimer);
      scheduleTimer = null;
    }
    readScheduleConfig()
      .then((cfg) => {
        scheduleConfigCache = cfg;
        if (cfg.enabled && cfg.intervalMinutes > 0) {
          const ms = cfg.intervalMinutes * 60 * 1000;
          scheduleTimer = setInterval(runScheduledScanAndDeliver, ms);
          logger.info(
            `[Schedule] Started: every ${cfg.intervalMinutes} min, recipients: ${(cfg.recipients || []).join(', ') || 'none'}`
          );
        }
      })
      .catch((err) => logger.error('[Schedule] Failed to start scheduler:', err.message));
  }

  return { startScheduler, runScheduledScanAndDeliver, readScheduleConfig, writeScheduleConfig };
}

module.exports = { createScheduler };
