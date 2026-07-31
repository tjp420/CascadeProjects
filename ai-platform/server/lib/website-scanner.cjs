// simplebeacon-ignore workspace-health
/**
 * Website Scanner — fetch remote pages and run AI Slop / security / PII patterns.
 * Tier-gated: Pro+ for website scans.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Fetch raw HTML from a URL with timeout and redirect handling.
 */
function fetchUrl(targetUrl, opts = {}) {
  const timeout = opts.timeout || 15000;
  const maxRedirects = opts.maxRedirects || 3;

  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(
      url,
      {
        timeout,
        headers: {
          'User-Agent': 'SimpleBeacon-WebsiteScanner/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          maxRedirects > 0
        ) {
          return resolve(
            fetchUrl(new URL(res.headers.location, url).href, {
              ...opts,
              maxRedirects: maxRedirects - 1,
            })
          );
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      }
    );
    req.on('timeout', () => reject(new Error(`Request timeout for ${targetUrl}`)));
    req.on('error', reject);
  });
}

/**
 * Extract inline JS and text content from HTML.
 */
function extractContent(html) {
  const scripts = [];
  const styles = [];
  const text = html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, code) => {
      scripts.push(code.trim());
      return '';
    })
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, code) => {
      styles.push(code.trim());
      return '';
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { html, scripts, styles, text };
}

/**
 * Run regex patterns against extracted content.
 */
function scanPatterns(content, catalog, { minConfidence = 0.5 } = {}) {
  const findings = [];
  const sources = [
    { name: 'html', text: content.html },
    { name: 'script', text: content.scripts.join('\n') },
    { name: 'style', text: content.styles.join('\n') },
    { name: 'text', text: content.text },
  ];

  for (const rule of catalog) {
    if ((rule.confidence || 0) < minConfidence) continue;
    const regex = new RegExp(rule.regexSource, rule.regexFlags || 'gi');
    for (const source of sources) {
      const matches = source.text.match(regex);
      if (matches) {
        for (const match of matches) {
          findings.push({
            id: rule.id,
            type: rule.type,
            severity: rule.severity,
            message: rule.message,
            suggestion: rule.suggestion,
            confidence: rule.confidence,
            match: match.slice(0, 200),
            source: source.name,
          });
        }
      }
    }
  }
  return findings;
}

/**
 * Basic security header check.
 */
function checkSecurityHeaders(rawHeaders) {
  const headers = Object.fromEntries(
    Object.entries(rawHeaders).map(([k, v]) => [k.toLowerCase(), String(v)])
  );
  const required = ['content-security-policy', 'x-content-type-options', 'x-frame-options'];
  const findings = [];
  for (const h of required) {
    if (!headers[h]) {
      findings.push({
        id: `missing-${h}`,
        type: 'security-headers',
        severity: 'medium',
        message: `Missing security header: ${h}`,
        suggestion: `Add ${h} response header`,
        confidence: 1.0,
        match: h,
        source: 'headers',
      });
    }
  }
  return findings;
}

/**
 * Scan a website URL.
 * @param {string} targetUrl
 * @param {object} options
 * @returns {Promise<{url: string, findings: Array, severityCounts: object, scanTimeMs: number}>}
 */
async function scanWebsite(targetUrl, options = {}) {
  const start = Date.now();
  const scanTypes = options.scanTypes || ['ai-slop'];
  const html = await fetchUrl(targetUrl, { timeout: options.timeout || 15000 });
  const content = extractContent(html);
  const findings = [];

  if (scanTypes.includes('ai-slop') || scanTypes.includes('all')) {
    const slopCatalog = require('../../../packages/simplebeacon-cli/src/rules/llm-slop-patterns.js');
    findings.push(
      ...scanPatterns(content, slopCatalog.RULE_CATALOG || [], {
        minConfidence: options.minConfidence || 0.5,
      })
    );
  }

  if (scanTypes.includes('security-headers') || scanTypes.includes('all')) {
    // Headers not available from simple fetch; placeholder for future Playwright integration
  }

  if (scanTypes.includes('pii') || scanTypes.includes('all')) {
    const piiPatterns = [
      {
        id: 'email-leak',
        regexSource: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
        type: 'pii',
        severity: 'high',
        message: 'Email address exposed',
        suggestion: 'Remove or obfuscate',
        confidence: 0.9,
      },
      {
        id: 'phone-leak',
        regexSource: '\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b',
        type: 'pii',
        severity: 'medium',
        message: 'Phone number exposed',
        suggestion: 'Remove or obfuscate',
        confidence: 0.7,
      },
    ];
    findings.push(
      ...scanPatterns(content, piiPatterns, { minConfidence: options.minConfidence || 0.5 })
    );
  }

  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});

  return {
    url: targetUrl,
    findings,
    severityCounts,
    scanTimeMs: Date.now() - start,
    contentSize: html.length,
  };
}

module.exports = {
  scanWebsite,
  fetchUrl,
  extractContent,
  scanPatterns,
  checkSecurityHeaders,
};
