// simplebeacon-ignore: debugArtifacts — diagnostic script uses console.log for test output
#!/usr/bin/env node
// Usage:
// HOST=https://simplebeacon.ai TOKEN=eyJ... node scripts/check-browser-error.js
// or
// HOST=http://localhost:58001 node scripts/check-browser-error.js

const HOST = process.env.HOST || 'http://localhost:58001';
const TOKEN = process.env.TOKEN || '';
const FETCH_INTERVAL_MS = Number(process.env.INTERVAL_MS) || 2000;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 60000;
const TEST_ID = `curl-test-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

function api(path) {
  return (HOST.replace(/\/$/, '') + '/api' + path);
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tryPostAuthenticated(payload) {
  try {
    const res = await fetch(api('/simplebeacon/report/browser-error'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
      body: JSON.stringify(payload),
      timeout: 15000
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function tryPostUnauthenticated(payload) {
  try {
    const res = await fetch(api('/simplebeacon/report/browser-error'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 15000
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function getEntries() {
  try {
    const res = await fetch(api('/simplebeacon/report/browser-errors'), {
      method: 'GET',
      headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}
    });
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.entries)) return parsed.entries;
      // Some endpoints might return { success:true, entries: [...] }
      // or raw array
      return [parsed];
    } catch (e) {
      return [{ raw: text }];
    }
  } catch (err) {
    return null;
  }
}

(async function main() {
  console.log('HOST:', HOST);
  console.log('Using TOKEN:', TOKEN ? 'yes' : 'no');
  const payload = { source: 'script-check', testId: TEST_ID, error: 'integration test', filePath: '/tmp/check-curl.txt', notes: 'auto-check' };

  console.log('Attempting authenticated POST (if TOKEN provided)...');
  let postResult = null;
  if (TOKEN) {
    postResult = await tryPostAuthenticated(payload);
    console.log('Authenticated POST result:', postResult);
  }

  if (!postResult || !postResult.ok) {
    console.log('Authenticated POST failed or not attempted — trying unauthenticated POST as fallback...');
    const fallback = await tryPostUnauthenticated(payload);
    console.log('Unauthenticated POST result:', fallback);
    if (!fallback.ok) {
      console.warn('Both POST attempts failed (or returned non-OK). Proceeding to poll GET to see if entry appears anyway.');
    }
  }

  console.log('Polling GET /simplebeacon/report/browser-errors for up to', TIMEOUT_MS, 'ms...');
  const deadline = Date.now() + TIMEOUT_MS;
  let found = false;
  let lastEntriesSample = null;
  while (Date.now() < deadline) {
    const entries = await getEntries();
    if (entries === null) {
      console.log('GET failed; retrying...');
      await wait(FETCH_INTERVAL_MS);
      continue;
    }
    lastEntriesSample = entries.slice(0,5);
    // entries may be array of objects
    for (const e of entries) {
      try {
        const tj = typeof e === 'string' ? JSON.parse(e) : e;
        if (tj && (tj.testId === TEST_ID || tj.source === 'script-check' || tj.testId === TEST_ID)) {
          console.log('Found matching entry:', tj);
          found = true;
          break;
        }
      } catch { continue; }
    }
    if (found) break;
    await wait(FETCH_INTERVAL_MS);
  }

  if (!found) {
    console.error('Timed out waiting for the new entry. Last sample of entries (0..4):');
    console.log(JSON.stringify(lastEntriesSample, null, 2));
    process.exitCode = 2;
    return;
  }
  console.log('Success: new browser-error record found.');
  process.exitCode = 0;
})();
