#!/usr/bin/env node
const { URL } = require('url');

const DEFAULT_DASH = process.env.DASHBOARD_URL || 'http://127.0.0.1:58000';
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:54358';
const TIMEOUT = 8000;

async function fetchJson(path) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(path, { signal: controller.signal });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }
    return { ok: res.ok, status: res.status, json, text };
  } catch (err) {
    return { ok: false, status: null, error: err.message };
  } finally { clearTimeout(id); }
}

function fail(msg) {
  console.error('❌', msg);
}
function pass(msg) {
  console.log('✅', msg);
}
function warn(msg) {
  console.warn('⚠️', msg);
}

async function run() {
  console.log(`Running dashboard health check against ${DEFAULT_DASH}`);
  let exitCode = 0;

  // 1) /api/simplebeacon/report
  const reportUrl = new URL('/api/simplebeacon/report', DEFAULT_DASH).toString();
  const r1 = await fetchJson(reportUrl);
  if (!r1.ok) {
    fail(`/api/simplebeacon/report returned status ${r1.status} (${r1.error || 'no response'})`);
    exitCode = 1;
  } else {
    if (r1.json && r1.json.success === true) {
      if (r1.json.message && r1.json.message.toLowerCase().includes('no report')) {
        warn('/api/simplebeacon/report reachable but serving fallback: no report available');
        exitCode = 1; // treat missing report as test failure
      } else {
        pass('/api/simplebeacon/report returned a valid report payload');
      }
    } else {
      warn('/api/simplebeacon/report returned 200 but payload is unexpected');
      exitCode = 1;
    }
  }

  // 2) /api/trust/verification
  const trustUrl = new URL('/api/trust/verification', DEFAULT_DASH).toString();
  const r2 = await fetchJson(trustUrl);
  if (!r2.ok) {
    fail(`/api/trust/verification returned status ${r2.status} (${r2.error || 'no response'})`);
    exitCode = 1;
  } else {
    const j = r2.json;
    if (j && (j.live || j.success)) {
      pass('/api/trust/verification returned expected trust payload');
    } else {
      warn('/api/trust/verification returned 200 but payload appears incomplete');
      exitCode = 1;
    }
  }

  // 3) /api/theme
  const themeUrl = new URL('/api/theme', DEFAULT_DASH).toString();
  const r3 = await fetchJson(themeUrl);
  if (!r3.ok) {
    fail(`/api/theme returned status ${r3.status} (${r3.error || 'no response'})`);
    exitCode = 1;
  } else if (r3.json && typeof r3.json.theme === 'string') {
    pass('/api/theme returned theme setting');
  } else {
    warn('/api/theme returned unexpected payload');
    exitCode = 1;
  }

  // 4) Probe API_PROXY_TARGET
  console.log(`Probing API proxy target ${API_PROXY_TARGET}`);
  const r4 = await fetchJson(API_PROXY_TARGET + '/');
  if (!r4.ok) {
    if (r4.status && r4.status >= 500) {
      fail(`API proxy target returned server error ${r4.status}`);
      exitCode = 1;
    } else {
      warn(`API proxy target returned non-OK status ${r4.status}`);
    }
  } else {
    pass('API proxy target reachable');
  }

  // 5) Check proxied path behavior via dashboard (/api/)
  const r5 = await fetchJson(new URL('/api/', DEFAULT_DASH).toString());
  if (!r5.ok) {
    if (r5.status && r5.status >= 500) {
      fail(`/api/ proxied path returned server error ${r5.status}`);
      exitCode = 1;
    } else {
      warn(`/api/ proxied path returned ${r5.status} (expected path-specific responses)`);
    }
  } else {
    pass('/api/ proxied path returned OK (backend-specific)');
  }

  if (exitCode === 0) console.log('\nAll checks passed. Dashboard API health is OK.');
  else console.log('\nOne or more checks failed or returned warnings (see above).');

  process.exit(exitCode);
}

run();
