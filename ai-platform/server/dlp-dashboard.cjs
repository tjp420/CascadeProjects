/**
 * DLP Dashboard — monitors AI API traffic for data-loss-prevention violations.
 *
 * EU AI Act Documentation Marker:
 * - Classification: Supporting infrastructure (Annex III AI system indicator)
 * - Purpose: Real-time monitoring and logging of artificial intelligence provider request/response payloads
 * - Article 12: Violations logged for audit trail and accountability
 * - Risk Level: Minimal (observability/monitoring component)
 */

const fs = require('fs');
const http = require('http');
const logger = require('./lib/app-logger');

const constants = require('./config/constants.cjs');
// i18n stub — replace with real translation framework when available
/**
 * T.
 * @param {string} str
 * @returns {any}
 */
function t(str) { return str; }

/**
 * D l p dashboard.
 */
class DLPDashboard {
    constructor(config = {}) {
        this.port = config.port || Number(process.env.DASHBOARD_PORT) || 3000;
        this.violationLogPath = config.violationLogPath || process.env.VIOLATION_LOG_PATH || './ai-violations.log';
        this.server = null;
    }

    start() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(this.port, () => {
            logger.info(`DLP Dashboard running on port ${this.port}`);
        });

        return this.server;
    }

    handleRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);

        if (url.pathname === '/') {
            this.serveDashboard(req, res);
            return;
        }
        if (url.pathname === '/api/violations') {
            this.serveViolations(req, res);
            return;
        }
        if (url.pathname === '/api/stats') {
            this.serveStats(req, res);
            return;
        }
        if (url.pathname === '/api/compliance') {
            this.serveCompliance(req, res);
            return;
        }

        res.writeHead(404);
        res.end('Not found');
    }

    serveDashboard(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.generateDashboardHTML());
    }

    async serveViolations(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
        const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
        const offset = (page - 1) * limit;
        const all = await this.loadViolations(false);
        const paginated = all.slice(offset, offset + limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            violations: paginated,
            pagination: { page, limit, total: all.length, pages: Math.ceil(all.length / limit) }
        }));
    }

    async serveStats(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(await this.generateStats()));
    }

    async serveCompliance(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(await this.generateComplianceReport()));
    }

    async loadViolations(paginated = true) {
        try {
            const data = await fs.promises.readFile(this.violationLogPath, 'utf8');
            const all = data.split('\n')
                .filter((line) => line.trim())
                .map((line) => JSON.parse(line))
                .reverse();
            return paginated ? all.slice(0, 100) : all;
        } catch {
            return [];
        }
    }

    async generateStats() {
        const violations = await this.loadViolations();
        const stats = {
            total: violations.length,
            bySeverity: {
                critical: violations.filter((v) => v.severity === 'critical').length,
                high: violations.filter((v) => v.severity === 'high').length,
                medium: violations.filter((v) => v.severity === 'medium').length,
                low: violations.filter((v) => v.severity === 'low').length
            },
            byPattern: {},
            bySource: {},
            timeline: violations.map((v) => ({
                timestamp: v.timestamp,
                severity: v.severity,
                patterns: v.patterns
            })),
            riskScore: this.calculateRiskScore(violations)
        };

        for (const violation of violations) {
            for (const pattern of violation.patterns || []) {
                stats.byPattern[pattern] = (stats.byPattern[pattern] || 0) + 1;
            }
            const source = violation.userAgent || 'unknown';
            stats.bySource[source] = (stats.bySource[source] || 0) + 1;
        }

        return stats;
    }

    calculateRiskScore(violations) {
        if (violations.length === 0) return 0;

        const severityWeights = { critical: 10, high: 5, medium: 2, low: 1 };
        const score = violations.reduce((total, v) => total + (severityWeights[v.severity] || 0), 0);
        return Math.min(100, Math.round(score / violations.length));
    }

    async generateComplianceReport() {
        const violations = await this.loadViolations();
        const stats = await this.generateStats();

        return {
            overallRisk: this.assessOverallRisk(stats),
            regulatoryExposure: this.assessRegulatoryExposure(violations),
            recommendations: this.generateRecommendations(stats),
            complianceScore: this.calculateComplianceScore(stats),
            lastAudit: new Date().toISOString(),
            auditPeriod: this.getAuditPeriod(violations)
        };
    }

    assessOverallRisk(stats) {
        if (stats.total === 0) return 'LOW';
        if (stats.bySeverity.critical > 0) return 'CRITICAL';
        if (stats.bySeverity.high > 5) return 'HIGH';
        if (stats.bySeverity.medium > 10) return 'MEDIUM';
        return 'LOW';
    }

    assessRegulatoryExposure(violations) {
        const regulations = {
            GDPR: 0,
            HIPAA: 0,
            'PCI-DSS': 0,
            CCPA: 0,
            'Internal Policy': 0
        };

        for (const violation of violations) {
            for (const pattern of violation.patterns || []) {
                if (pattern.includes('ssn') || pattern.includes('email')) {
                    regulations.GDPR += 1;
                    regulations.CCPA += 1;
                }
                if (pattern.includes('medical') || pattern.includes('patient') || pattern.includes('diagnosis')) {
                    regulations.HIPAA += 1;
                }
                if (pattern.includes('credit-card') || pattern.includes('bank') || pattern.includes('routing')) {
                    regulations['PCI-DSS'] += 1;
                }
                if (pattern.includes('confidential') || pattern.includes('internal')) {
                    regulations['Internal Policy'] += 1;
                }
            }
        }

        return regulations;
    }

    generateRecommendations(stats) {
        const recommendations = [];

        if (stats.bySeverity.critical > 0) {
            recommendations.push({
                priority: 'CRITICAL',
                action: 'Review all critical violations and implement additional security measures',
                timeline: '24 hours'
            });
        }

        if ((stats.byPattern['openai-key'] || 0) + (stats.byPattern['aws-access-key'] || 0) > 0) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Rotate exposed credentials and enforce secret scanning in CI',
                timeline: '1 week'
            });
        }

        if ((stats.byPattern['email-address'] || 0) > 10) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Review email handling and implement redaction policies for AI prompts',
                timeline: '2 weeks'
            });
        }

        if (stats.total > 50) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Add employee training on safe AI usage and approved tooling',
                timeline: '1 month'
            });
        }

        return recommendations;
    }

    calculateComplianceScore(stats) {
        const deductions = (stats.bySeverity.critical * 10)
            + (stats.bySeverity.high * 5)
            + (stats.bySeverity.medium * 2);
        return Math.max(0, 100 - deductions);
    }

    getAuditPeriod(violations) {
        if (violations.length === 0) return null;

        const timestamps = violations.map((v) => new Date(v.timestamp).getTime());
        const oldest = Math.min(...timestamps);
        const newest = Math.max(...timestamps);

        return {
            start: new Date(oldest).toISOString(),
            end: new Date(newest).toISOString(),
            days: Math.ceil((newest - oldest) / constants.ONE_DAY_MS)
        };
    }

    generateDashboardHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Data Leak Prevention Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: #5b6ee1; color: white; padding: 24px; border-radius: 8px; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .value { font-size: 28px; font-weight: bold; }
    .critical { color: #d32f2f; }
    .high { color: #f57c00; }
    .violation { background: white; padding: 12px; margin: 8px 0; border-left: 4px solid #ccc; border-radius: 4px; }
    .violation.critical { border-left-color: #d32f2f; }
    .violation.high { border-left-color: #f57c00; }
  </style>
</head>
<body>
  <div class="header">
    <h1>AI Data Leak Prevention Dashboard</h1>
    <p>Real-time monitoring for outbound AI traffic</p>
  </div>
  <div class="stats">
    <div class="card"><div>Total Violations</div><div class="value" id="total">0</div></div>
    <div class="card"><div>Critical</div><div class="value critical" id="critical">0</div></div>
    <div class="card"><div>High</div><div class="value high" id="high">0</div></div>
    <div class="card"><div>Risk Score</div><div class="value" id="risk">0</div></div>
  </div>
  <div class="card">
    <h2>Compliance Score: <span id="score">--</span></h2>
    <div id="status" data-label="Overall risk">Loading...</div>
  </div>
  <div class="card">
    <h2>Recent Violations</h2>
    <div id="violations">Loading...</div>
    <div id="pagination" style="margin-top:12px;display:flex;gap:8px;align-items:center;"></div>
  </div>
  <script>
    let currentPage = 1;
    let currentLimit = 20;
/**
 * Load violations.
 * @param {any} page
 * @returns {any}
 */
    async function loadViolations(page = 1) {
      const res = await fetch('/api/violations?page=' + page + '&limit=' + currentLimit);
      return res.json();
    }
/**
 * Render violations.
 * @param {any} data
 * @returns {any}
 */
    function renderViolations(data) {
      const violationsEl = document.getElementById('violations');
      const paginationEl = document.getElementById('pagination');
      const violations = data.violations || [];
      const p = data.pagination || {};
      violationsEl.replaceChildren();
      if (violations.length) {
        violations.forEach((v) => {
          const div = document.createElement('div');
          div.className = 'violation ' + v.severity;
          const strong = document.createElement('strong');
          strong.textContent = v.severity;
          div.appendChild(strong);
          div.appendChild(document.createTextNode(' ' + v.timestamp));
          const br = document.createElement('br');
          div.appendChild(br);
          div.appendChild(document.createTextNode('Patterns: ' + (v.patterns || []).join(', ')));
          violationsEl.appendChild(div);
        });
      } else {
        violationsEl.textContent = t('No violations detected.');
      }
      paginationEl.replaceChildren();
      if (p.pages > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Prev';
        prevBtn.disabled = p.page <= 1;
        prevBtn.addEventListener('click', () => changePage(p.page - 1));
        const span = document.createElement('span');
        span.textContent = 'Page ' + p.page + ' of ' + p.pages;
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next →';
        nextBtn.disabled = p.page >= p.pages;
        nextBtn.addEventListener('click', () => changePage(p.page + 1));
        paginationEl.appendChild(prevBtn);
        paginationEl.appendChild(span);
        paginationEl.appendChild(nextBtn);
      }
    }
/**
 * Change page.
 * @param {any} page
 * @returns {any}
 */
    async function changePage(page) {
      if (page < 1) return;
      const data = await loadViolations(page);
      currentPage = data.pagination?.page || 1;
      renderViolations(data);
    }
/**
 * Refresh.
 * @returns {any}
 */
    async function refresh() {
      const stats = await fetch('/api/stats').then(r => r.json());
      document.getElementById('total').textContent = stats.total;
      document.getElementById('critical').textContent = stats.bySeverity.critical;
      document.getElementById('high').textContent = stats.bySeverity.high;
      document.getElementById('risk').textContent = stats.riskScore;

      const compliance = await fetch('/api/compliance').then(r => r.json());
      document.getElementById('score').textContent = compliance.complianceScore;
      const statusEl = document.getElementById('status');
      statusEl.textContent = statusEl.dataset.label + ': ' + compliance.overallRisk;

      const data = await loadViolations(currentPage);
      renderViolations(data);
    }
    refresh();
    setInterval(refresh, constants.TIMEOUT_30S);
  </script>
</body>
</html>`;
    }
}

module.exports = { DLPDashboard };
