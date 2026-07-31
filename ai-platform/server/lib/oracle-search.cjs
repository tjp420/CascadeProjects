/**
 * Lightweight Oracle search helper using SerpAPI and plain-html extraction.
 * Falls back to dev stub when SIMPLEBEACON_DEV_STUBS=true.
 */
'use strict';

const DEFAULT_MAX_RESULTS = 3;
const DEFAULT_DELAY_MS = 500;

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, status: res.status, text };
  }
  return { ok: res.ok, status: res.status, json };
}

function extractTextFromHtml(html) {
  // Strip scripts/styles and tags, then collapse whitespace.
  try {
    let s = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<!--([\s\S]*?)-->/g, '');
    s = s.replace(/<[^>]+>/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  } catch (e) {
    return '';
  }
}

async function fetchPageText(url, timeoutMs = 10000) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Simplebeacon-Oracle/1.0 (+https://simplebeacon.ai)' },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) {
      return { url, ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const text = extractTextFromHtml(html);
    return { url, ok: true, status: res.status, text: text.slice(0, 20000) };
  } catch (e) {
    return { url, ok: false, error: String(e) };
  }
}

/**
 * Perform a SerpAPI search and fetch top result pages.
 * options: { maxResults, delayBetweenFetch }
 */
module.exports = async function oracleSearch(query, options = {}) {
  if (!query || typeof query !== 'string') throw new Error('query required');
  const maxResults = Number.isFinite(Number(options.maxResults))
    ? Number(options.maxResults)
    : DEFAULT_MAX_RESULTS;
  const delayMs = Number.isFinite(Number(options.delayBetweenFetch))
    ? Math.max(0, Math.floor(Number(options.delayBetweenFetch) * 1000))
    : DEFAULT_DELAY_MS;

  // Dev stub: return canned response when enabled
  if (String(process.env.SIMPLEBEACON_DEV_STUBS) === 'true') {
    return [
      { url: 'https://example.com/mock', ok: true, text: `DEV STUB: results for query="${query}"` },
    ];
  }

  const serpKey = process.env.SERPAPI_KEY;
  if (!serpKey) {
    throw new Error('SERPAPI_KEY not configured in server environment');
  }

  const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(serpKey)}&num=${encodeURIComponent(maxResults)}`;
  const searchResp = await fetchJson(searchUrl, { method: 'GET' });
  if (!searchResp.ok || !searchResp.json) {
    throw new Error(`SerpAPI search failed: status=${searchResp.status}`);
  }

  const data = searchResp.json;
  const results = data.organic_results || data.orgic || data.organic || [];
  const links = (Array.isArray(results) ? results : [])
    .map((r) => r.link || r.url)
    .filter(Boolean)
    .slice(0, maxResults);

  const outputs = [];
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    // fetch page text
     
    const page = await fetchPageText(link, 10000);
    outputs.push(page);
    if (i < links.length - 1 && delayMs > 0) {
       
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return outputs;
};
