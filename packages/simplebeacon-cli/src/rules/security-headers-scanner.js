/**
 * Security Headers analyzer (SB-SEC-010).
 * Fetches live URLs and inspects HTTP response headers for missing
 * security controls. Checks for CSP, HSTS, X-Frame-Options,
 * X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
 *
 * This analyzer is network-based — it fetches live URLs rather than
 * scanning local files. It is gated behind the websiteScans tier feature.
 */

const https = require('https');
const http = require('http');

const DEFAULT_TIMEOUT_MS = 10000;

const REQUIRED_HEADERS = [
  {
    name: 'content-security-policy',
    severity: 'high',
    description: 'Missing Content-Security-Policy header — exposes page to XSS and data injection attacks',
    remediation: 'Set Content-Security-Policy: default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\''
  },
  {
    name: 'strict-transport-security',
    severity: 'high',
    description: 'Missing Strict-Transport-Security header — allows protocol downgrade and MITM attacks',
    remediation: 'Set Strict-Transport-Security: max-age=31536000; includeSubDomains; preload'
  },
  {
    name: 'x-frame-options',
    severity: 'medium',
    description: 'Missing X-Frame-Options header — page can be embedded in iframes (clickjacking risk)',
    remediation: 'Set X-Frame-Options: DENY or CSP frame-ancestors directive'
  },
  {
    name: 'x-content-type-options',
    severity: 'medium',
    description: 'Missing X-Content-Type-Options header — browsers may MIME-sniff responses',
    remediation: 'Set X-Content-Type-Options: nosniff'
  },
  {
    name: 'referrer-policy',
    severity: 'low',
    description: 'Missing Referrer-Policy header — referrer may leak sensitive path data',
    remediation: 'Set Referrer-Policy: strict-origin-when-cross-origin'
  },
  {
    name: 'permissions-policy',
    severity: 'low',
    description: 'Missing Permissions-Policy header — browser features are not restricted',
    remediation: 'Set Permissions-Policy: camera=(), microphone=(), geolocation=()'
  }
];

function fetchHeaders(url, timeoutMs) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
  });
}

/**
 * @param {string[]} urls URLs to fetch and check
 * @param {object} options { timeoutMs, headers }
 * @returns {object} scan result
 */
function scanSecurityHeaders(urls, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const findings = [];
  const scanned = [];

  if (!Array.isArray(urls) || urls.length === 0) {
    return { scanned: 0, findings: [], scannedUrls: [] };
  }

  // Synchronous-style: collect results for the scan engine
  // The caller (scan.js) handles async via the async scanner entry
  return {
    scanned: urls.length,
    scannedUrls: urls,
    findings: [],
    pending: true,
    timeoutMs,
    _asyncRun: async function () {
      for (const url of urls) {
        const result = await fetchHeaders(url, timeoutMs);
        if (result.error) {
          findings.push({
            type: 'security-headers',
            severity: 'low',
            url,
            description: `Could not fetch ${url} for header analysis: ${result.error}`,
            ruleId: 'SB-SEC-010',
            metadata: { url, error: result.error }
          });
          continue;
        }
        scanned.push({ url, status: result.status, headers: result.headers });
        for (const rule of REQUIRED_HEADERS) {
          const headerVal = result.headers[rule.name];
          if (!headerVal) {
            findings.push({
              type: 'security-headers',
              severity: rule.severity,
              url,
              description: rule.description,
              remediation: rule.remediation,
              ruleId: 'SB-SEC-010',
              metadata: { url, header: rule.name, statusCode: result.status }
            });
          }
        }
      }
      return {
        scanned: scanned.length,
        scannedUrls: scanned.map(s => s.url),
        findings,
        summary: {
          totalUrls: urls.length,
          totalFindings: findings.length,
          bySeverity: findings.reduce((acc, f) => {
            acc[f.severity] = (acc[f.severity] || 0) + 1;
            return acc;
          }, {})
        }
      };
    }
  };
}

module.exports = { scanSecurityHeaders, REQUIRED_HEADERS };
