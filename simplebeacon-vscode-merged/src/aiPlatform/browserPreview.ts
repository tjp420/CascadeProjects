import * as http from 'http';
import * as https from 'https';

/**
 * Options for fetching remote HTML content.
 */
export interface FetchOptions {
  maxRedirects?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Fetch raw HTML from a URL with redirect and timeout handling.
 * @param url - Target URL to fetch.
 * @param options - Optional fetch configuration.
 * @returns Raw HTML string.
 */
export function fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
  const { maxRedirects = 5, timeoutMs = 15000, headers = {} } = options;

  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'SimpleBeacon-VSCode-Extension/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...headers,
      },
    };

    const req = client.request(requestOptions, (res) => {
      if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        const redirectUrl = new URL(res.headers.location, url).toString();
        fetchHtml(redirectUrl, { ...options, maxRedirects: maxRedirects - 1 })
          .then((result) => { resolve(result); })
          .catch((err) => { reject(err); });
        return;
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Unknown'}`));
        }
      });
    });

    req.on('error', (err) => reject(err));

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    });

    req.end();
  });
}

/**
 * Result of rewriting page HTML for VS Code webview compatibility.
 */
export interface RewriteResult {
  html: string;
  origin: string;
  baseUrl: string;
}

/**
 * Rewrite HTML page content to resolve relative URLs and strip cache scripts.
 * @param html - Raw HTML content.
 * @param pageUrl - Original page URL for base resolution.
 * @returns Rewritten HTML with resolved URLs.
 */
export function rewritePageHtml(html: string, pageUrl: string): RewriteResult {
  const baseUrl = pageUrl.replace(/\/[^/]*$/, '/');
  const origin = pageUrl.replace(/^(https?:\/\/[^/]+).*$/, '$1');

  let rewritten = html
    // Absolute-relative URLs first (e.g., href="/path")
    .replace(/href="(\/[^"]*)"/g, 'href="' + origin + '$1"')
    .replace(/src="(\/[^"]*)"/g, 'src="' + origin + '$1"')
    // Then regular relative URLs
    .replace(/href="(?!https?:\/\/|\/\/|#|data:)([^"]*)"/g, 'href="' + baseUrl + '$1"')
    .replace(/src="(?!https?:\/\/|\/\/|#|data:)([^"]*)"/g, 'src="' + baseUrl + '$1"')
    // CSS url()
    .replace(/url\((?!https?:\/\/|\/\/|#|data:)([^)]*)\)/g, 'url(' + baseUrl + '$1)');

  // Strip cache-busting redirect that breaks VS Code webviews
  rewritten = rewritten.replace(
    /<script>\s*\(\s*function\s*\(\)\s*\{\s*try\s*\{\s*var\s+key\s*=\s*['"]sb_dash_[^'"]+['"];[\s\S]*?\}\s*catch\s*\(e\)\s*\{[\s\S]*?\}\s*\}\s*\)\s*\(\s*\)\s*;?\s*<\/script>/gi,
    ''
  );

  return { html: rewritten, origin, baseUrl };
}

/**
 * Build a browser security meta tag for the given origin.
 * @param origin - Allowed origin for security directives.
 * @returns Security meta tag string.
 */
export function buildCspTag(origin: string): string {
  const directives = [
    `default-src ${origin}`,
    `script-src ${origin} 'unsafe-inline'`,
    `style-src ${origin} 'unsafe-inline'`,
    `img-src ${origin} data: blob:`,
    `connect-src ${origin}`,
    `font-src ${origin}`,
  ];
  return `<meta http-equiv="Content-Security-Policy" content="${directives.join('; ')};">`;
}

/**
 * Inject preview scripts and CSP tag into HTML head.
 * @param html - Target HTML content.
 * @param origin - API host origin.
 * @param hashRoute - Initial hash route for the preview.
 * @returns Modified HTML with injected scripts.
 */
export function injectPreviewScripts(html: string, origin: string, hashRoute: string): string {
  const cspTag = buildCspTag(origin);
  const apiHostScript = `<script>window.__SB_API_HOST__ = "${origin}";<\/script>`;
  const initialView = hashRoute.replace(/^#\//, '');
  const routeScript = initialView
    ? `<script>window.__SB_INITIAL_ROUTE__ = "${initialView}";<\/script>`
    : '';

  const headClose = html.indexOf('</head>');
  if (headClose > 0) {
    return html.slice(0, headClose) + cspTag + apiHostScript + routeScript + html.slice(headClose);
  }
  return cspTag + apiHostScript + routeScript + html;
}

export function postAiContext(
  apiUrl: string,
  data: unknown
): Promise<{ success: boolean; content?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(apiUrl + '/api/ai-context');
    const body = JSON.stringify(data);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res: http.IncomingMessage) => {
        let responseData = '';
        res.on('data', (chunk: Buffer) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(responseData));
          } catch {
            resolve({ success: false, error: 'Invalid JSON' });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
