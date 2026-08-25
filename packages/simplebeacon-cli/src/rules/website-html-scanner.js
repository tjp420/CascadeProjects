/**
 * Live Website HTML analyzer (SB-WEB-001).
 * Fetches live URLs and analyzes the rendered HTML for production quality issues:
 * - Inline scripts/styles (CSP violation risk)
 * - TODO/FIXME/HACK markers shipped to production
 * - Placeholder/coming-soon text in live pages
 * - Missing meta tags (description, OG, Twitter Card)
 * - Missing canonical URLs
 * - Missing JSON-LD structured data
 * - Missing <main> / ARIA landmarks
 * - Images without alt attributes
 * - Hardcoded localhost/127.0.0.1 references in live HTML
 * - console.log() calls in production HTML
 * - href="#" placeholder links
 *
 * This analyzer is network-based — it fetches live URLs rather than
 * scanning local files. It is gated behind the websiteScans tier feature.
 */

const https = require("https");
const http = require("http");

const DEFAULT_TIMEOUT_MS = 10000;

function fetchPage(url, timeoutMs) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (d) => {
        body += d;
      });
      res.on("end", () =>
        resolve({
          url,
          status: res.statusCode,
          headers: res.headers,
          body,
          size: body.length,
        }),
      );
    });
    req.on("error", (err) => resolve({ url, error: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ url, error: "timeout" });
    });
  });
}

function analyzeHtml(html, url) {
  const findings = [];

  // 1. Inline scripts (CSP violation risk)
  const inlineScriptMatches =
    html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || [];
  if (inlineScriptMatches.length > 0) {
    findings.push({
      type: "website-html",
      severity: "medium",
      url,
      description: `${inlineScriptMatches.length} inline <script> block(s) — CSP violation risk and harder to cache`,
      ruleId: "SB-WEB-001",
      metadata: {
        url,
        count: inlineScriptMatches.length,
        category: "inline-scripts",
      },
    });
  }

  // 2. Inline styles
  const inlineStyleMatches =
    html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  if (inlineStyleMatches.length > 3) {
    findings.push({
      type: "website-html",
      severity: "low",
      url,
      description: `${inlineStyleMatches.length} inline <style> block(s) — consider externalizing for caching`,
      ruleId: "SB-WEB-001",
      metadata: {
        url,
        count: inlineStyleMatches.length,
        category: "inline-styles",
      },
    });
  }

  // 3. TODO/FIXME/HACK markers in production HTML
  const todoMatches = html.match(/\b(TODO|FIXME|HACK|XXX)\b/g) || [];
  if (todoMatches.length > 0) {
    findings.push({
      type: "website-html",
      severity: "medium",
      url,
      description: `${todoMatches.length} TODO/FIXME/HACK marker(s) found in production HTML — incomplete work shipped to live site`,
      ruleId: "SB-WEB-002",
      metadata: { url, count: todoMatches.length, category: "todo-markers" },
    });
  }

  // 4. Placeholder/coming-soon text
  const placeholderMatches =
    html.match(/\b(lorem ipsum|coming soon|placeholder text|tbd|TBD)\b/gi) ||
    [];
  if (placeholderMatches.length > 0) {
    findings.push({
      type: "website-html",
      severity: "medium",
      url,
      description: `${placeholderMatches.length} placeholder/coming-soon text occurrence(s) in production HTML`,
      ruleId: "SB-WEB-003",
      metadata: {
        url,
        count: placeholderMatches.length,
        category: "placeholder-text",
      },
    });
  }

  // 5. Missing meta tags
  if (
    !html.includes('name="description"') &&
    !html.includes("name='description'")
  ) {
    findings.push({
      type: "website-html",
      severity: "medium",
      url,
      description:
        "Missing meta description tag — impacts SEO and social sharing",
      ruleId: "SB-WEB-004",
      metadata: { url, category: "missing-meta" },
    });
  }
  if (
    !html.includes('property="og:title"') &&
    !html.includes("property='og:title'")
  ) {
    findings.push({
      type: "website-html",
      severity: "low",
      url,
      description: "Missing og:title meta tag — impacts social media sharing",
      ruleId: "SB-WEB-004",
      metadata: { url, category: "missing-og" },
    });
  }
  if (
    !html.includes('name="twitter:card"') &&
    !html.includes("name='twitter:card'")
  ) {
    findings.push({
      type: "website-html",
      severity: "low",
      url,
      description: "Missing twitter:card meta tag — impacts Twitter/X sharing",
      ruleId: "SB-WEB-004",
      metadata: { url, category: "missing-twitter" },
    });
  }

  // 6. Missing canonical
  if (!html.includes('rel="canonical"') && !html.includes("rel='canonical'")) {
    findings.push({
      type: "website-html",
      severity: "low",
      url,
      description:
        "Missing canonical link tag — may cause duplicate content SEO issues",
      ruleId: "SB-WEB-005",
      metadata: { url, category: "missing-canonical" },
    });
  }

  // 7. Missing JSON-LD structured data
  if (!html.includes("application/ld+json")) {
    findings.push({
      type: "website-html",
      severity: "low",
      url,
      description:
        "No JSON-LD structured data found — impacts search engine understanding and rich results",
      ruleId: "SB-WEB-006",
      metadata: { url, category: "missing-jsonld" },
    });
  }

  // 8. Missing <main> or role="main"
  if (
    !html.includes("<main") &&
    !html.includes('role="main"') &&
    !html.includes("role='main'")
  ) {
    findings.push({
      type: "website-html",
      severity: "low",
      url,
      description:
        'Missing <main> element or role="main" — impacts accessibility landmark navigation',
      ruleId: "SB-WEB-007",
      metadata: { url, category: "missing-main-landmark" },
    });
  }

  // 9. Images without alt attributes
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const imgsWithoutAlt = imgMatches.filter((img) => !/\balt\s*=/.test(img));
  if (imgsWithoutAlt.length > 0) {
    findings.push({
      type: "website-html",
      severity: "medium",
      url,
      description: `${imgsWithoutAlt.length} <img> element(s) without alt attribute — accessibility violation`,
      ruleId: "SB-WEB-008",
      metadata: { url, count: imgsWithoutAlt.length, category: "missing-alt" },
    });
  }

  // 10. console.log in production HTML
  const consoleLogMatches = html.match(/console\.log\s*\(/g) || [];
  if (consoleLogMatches.length > 0) {
    findings.push({
      type: "website-html",
      severity: "low",
      url,
      description: `${consoleLogMatches.length} console.log() call(s) in production HTML — debug code shipped to live site`,
      ruleId: "SB-WEB-009",
      metadata: {
        url,
        count: consoleLogMatches.length,
        category: "console-log",
      },
    });
  }

  // 11. href="#" placeholder links
  const brokenLinkMatches = html.match(/href="#"/gi) || [];
  if (brokenLinkMatches.length > 0) {
    findings.push({
      type: "website-html",
      severity: "low",
      url,
      description: `${brokenLinkMatches.length} href="#" placeholder link(s) — non-functional navigation elements`,
      ruleId: "SB-WEB-010",
      metadata: {
        url,
        count: brokenLinkMatches.length,
        category: "broken-links",
      },
    });
  }

  // 12. Hardcoded localhost in live HTML (excluding hostname comparison checks)
  // Only flag if it appears in a URL context, not a comparison
  const localhostUrlMatches =
    html.match(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//gi) || [];
  if (localhostUrlMatches.length > 0) {
    findings.push({
      type: "website-html",
      severity: "high",
      url,
      description: `${localhostUrlMatches.length} hardcoded localhost URL(s) in production HTML — dev endpoint leaked to live site`,
      ruleId: "SB-WEB-011",
      metadata: {
        url,
        count: localhostUrlMatches.length,
        category: "localhost-leak",
        matches: localhostUrlMatches.slice(0, 5),
      },
    });
  }

  return findings;
}

/**
 * @param {string[]} urls URLs to fetch and analyze
 * @param {object} options { timeoutMs }
 * @returns {object} scan result with _asyncRun for async execution
 */
function scanWebsiteHtml(urls, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  if (!Array.isArray(urls) || urls.length === 0) {
    return { scanned: 0, findings: [], scannedUrls: [] };
  }

  return {
    scanned: 0,
    scannedUrls: [],
    findings: [],
    pending: true,
    timeoutMs,
    _asyncRun: async function () {
      const allFindings = [];
      const scanned = [];

      for (const url of urls) {
        const result = await fetchPage(url, timeoutMs);
        if (result.error) {
          allFindings.push({
            type: "website-html",
            severity: "low",
            url,
            description: `Could not fetch ${url} for HTML analysis: ${result.error}`,
            ruleId: "SB-WEB-001",
            metadata: { url, error: result.error },
          });
          continue;
        }
        if (result.status >= 400) {
          allFindings.push({
            type: "website-html",
            severity: "medium",
            url,
            description: `${url} returned HTTP ${result.status} — page is broken or inaccessible`,
            ruleId: "SB-WEB-001",
            metadata: { url, statusCode: result.status },
          });
          continue;
        }
        scanned.push({ url, status: result.status, size: result.size });
        const pageFindings = analyzeHtml(result.body, url);
        allFindings.push(...pageFindings);
      }

      return {
        scanned: scanned.length,
        scannedUrls: scanned.map((s) => s.url),
        findings: allFindings,
        summary: {
          totalUrls: urls.length,
          totalFindings: allFindings.length,
          bySeverity: allFindings.reduce((acc, f) => {
            acc[f.severity] = (acc[f.severity] || 0) + 1;
            return acc;
          }, {}),
        },
      };
    },
  };
}

module.exports = { scanWebsiteHtml, analyzeHtml, REQUIRED_HEADERS: [] };
