#!/usr/bin/env node
/**
 * parse_envoy_and_correlate.js
 *
 * Usage:
 * node tools/parse_envoy_and_correlate.js --envoy-log=path/to/access.log --input=.simplebeacon/filtered-org-compliance-attestation-strict-redacted-timestamps-fixed.json --window=60
 *
 * The script expects Envoy access logs in JSON-per-line format (see deploy/envoy/envoy.yaml json_format keys).
 * It finds access log entries where `path` === '/api/audit/compliance/report' and extracts `request_id`, `timestamp`/`start_time`, `upstream_host`, `downstream_remote_address`, and user-agent fields.
 * It then correlates those log entries to `compliance_report_generated` (`rep_*`) audit entries within ±window seconds.
 */

const fs = require('fs');
const readline = require('readline');
const argv = require('minimist')(process.argv.slice(2));

const envoyLog = argv['envoy-log'] || argv.e;
const input = argv.input || argv.i;
const windowSec = parseInt(argv.window || argv.w || '60', 10);
const dateFilter = argv.date || argv.d; // optional YYYY-MM-DD to restrict rep entries

if (!envoyLog || !input) {
  console.error('Usage: node tools/parse_envoy_and_correlate.js --envoy-log=LOGFILE --input=AUDIT_JSON [--window=60] [--date=YYYY-MM-DD]');
  process.exit(1);
}

function parseTime(v) {
  if (!v) return null;
  // try ISO parse
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString();
  // try numeric seconds or milliseconds
  const n = Number(v);
  if (!isNaN(n)) {
    // heuristics: if > 1e12 assume ms
    return new Date(n > 1e12 ? n : n * 1000).toISOString();
  }
  return null;
}

function addSeconds(iso, secs) {
  return new Date(new Date(iso).getTime() + secs * 1000).toISOString();
}

async function loadReps() {
  const raw = fs.readFileSync(input, 'utf8');
  const parsed = JSON.parse(raw);
  let entries = parsed.entries || parsed;
  if (!Array.isArray(entries) && typeof entries === 'object') entries = Object.values(entries);
  const reps = entries.filter(en => en.action === 'compliance_report_generated' && en.timestamp && en.entityId);
  if (dateFilter) {
    return reps.filter(r => r.timestamp && r.timestamp.startsWith(dateFilter));
  }
  return reps;
}

function tryExtractField(obj, candidates) {
  for (const c of candidates) {
    const parts = c.split('.');
    let cur = obj;
    let ok = true;
    for (const p of parts) {
      if (cur == null) { ok = false; break; }
      cur = cur[p];
    }
    if (ok && cur != null) return cur;
  }
  return undefined;
}

(async function main() {
  const reps = await loadReps();
  if (!reps || reps.length === 0) {
    console.error('No rep entries found in input');
    process.exit(2);
  }
  // normalize reps timestamps
  const normalizedReps = reps.map(r => ({ id: r.id, rep: r.entityId, timestamp: parseTime(r.timestamp) })).filter(r => r.timestamp);

  // build index by time (simple array)

  console.error(`Loaded ${normalizedReps.length} rep entries. Window: ±${windowSec}s`);

  // prepare input stream: support '-' for stdin
  let rl;
  if (envoyLog === '-') {
    rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  } else {
    // support comma-separated list? for now require a single existing file
    if (!fs.existsSync(envoyLog)) {
      console.error(`Envoy log file not found: ${envoyLog}`);
      console.error('Options:');
      console.error(' - Provide the correct path to the Envoy access log (JSON-per-line).');
      console.error(' - Or stream logs into stdin and pass --envoy-log=-');
      console.error('Example (docker): docker logs --since "2026-08-15T00:00:00" --until "2026-08-22T23:59:59" <container> 2>&1 | node tools/parse_envoy_and_correlate.js --envoy-log=- --input=...');
      process.exit(3);
    }
    rl = readline.createInterface({ input: fs.createReadStream(envoyLog), crlfDelay: Infinity });
  }

  const matches = [];

  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    const tline = line.trim();
    if (!tline) continue;
    let obj;
    try {
      obj = JSON.parse(tline);
    } catch (err) {
      // skip non-json
      continue;
    }
    const path = tryExtractField(obj, ['path', 'request_path', 'request.path', 'req.path']);
    if (path !== '/api/audit/compliance/report') continue;
    // extract timestamp candidates
    const tsRaw = tryExtractField(obj, ['timestamp', 'start_time', 'time', '@timestamp', 'start_time_us']);
    const ts = parseTime(tsRaw) || parseTime(tryExtractField(obj, ['start_time_local', 'time_local']));
    const request_id = tryExtractField(obj, ['request_id', 'req_id', 'request_id.uuid', 'request_id_value']);
    const upstream = tryExtractField(obj, ['upstream_host', 'upstream', 'upstream_host']);
    const remote = tryExtractField(obj, ['downstream_remote_address', 'downstream_remote_addr', 'remote_addr', 'remote_address', 'remote']);
    // user-agent may be under request headers map or top-level
    const ua = tryExtractField(obj, ['request_headers.user-agent', 'request_headers["user-agent"]', 'request_headers["User-Agent"]', 'user_agent', 'ua']);

    const entry = { line: lineNo, ts, request_id, upstream, remote, ua, raw: obj };

    // find reps within window
    const linked = normalizedReps.filter(r => {
      const d = Math.abs(new Date(r.timestamp).getTime() - new Date(ts).getTime());
      return !isNaN(d) && d <= windowSec * 1000;
    });

    matches.push({ entry, linked });
  }

  // print results
  if (matches.length === 0) {
    console.log('No Envoy access log entries for /api/audit/compliance/report found in', envoyLog);
  } else {
    console.log(`Found ${matches.length} access-log hits for /api/audit/compliance/report:`);
    for (const m of matches) {
      const e = m.entry;
      console.log('---');
      console.log(`time: ${e.ts || '(unknown)'}  request_id: ${e.request_id || '(none)'}  remote: ${e.remote || '(unknown)'}  ua: ${e.ua || '(unknown)'}  upstream: ${e.upstream || '(unknown)'}  line:${e.line}`);
      if (m.linked.length === 0) {
        console.log('  -> No rep_* generated within window');
      } else {
        for (const r of m.linked) {
          console.log(`  -> matches rep ${r.rep} (audit id=${r.id}) @ ${r.timestamp}`);
        }
      }
    }
  }

  // Also print reps that had no matching envoy entry (maybe generated internally)
  const repsWithMatch = new Set();
  for (const m of matches) for (const r of m.linked) repsWithMatch.add(r.rep);
  const unmatched = normalizedReps.filter(r => !repsWithMatch.has(r.rep));
  console.log('=== Summary ===');
  console.log(`Total reps: ${normalizedReps.length}`);
  console.log(`Matched via envoy logs: ${normalizedReps.length - unmatched.length}`);
  console.log(`Unmatched reps: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('Sample unmatched reps:');
    unmatched.slice(0, 20).forEach(u => console.log(` - ${u.rep} @ ${u.timestamp} id=${u.id}`));
  }

})();
