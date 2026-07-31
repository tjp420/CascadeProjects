'use strict';

const http = require('http');

function req(base, method, p, body) {
  return new Promise((r, j) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { hostname: 'localhost', port: 3999, path: base + p, method, headers: { 'Content-Type': 'application/json' } };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const hr = http.request(opts, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { r({ s: res.statusCode, d: JSON.parse(b) }); } catch { r({ s: res.statusCode, d: b }); } }); });
    hr.on('error', j); if (data) hr.write(data); hr.end();
  });
}
const areq = (m, p, b) => req('/api/alerts', m, p, b);

async function main() {
  let pass = 0, fail = 0;
  const ok = (cond, label) => { if (cond) { pass++; } else { fail++; console.log('   FAIL:', label); } };

  // 1. GET /rules (empty initially)
  const rules1 = await areq('GET', '/rules');
  ok(rules1.s === 200, 'GET /rules returns 200');

  // 2. POST /rules — create rule
  const created = await areq('POST', '/rules', { id: 'test-rule-1', name: 'Test Critical Alert', eventType: 'critical_finding', destinationType: 'webhook', webhookUrl: 'http://localhost:9999/hook', enabled: true });
  ok(created.s === 200, 'POST /rules returns 200');
  ok(created.d.rule?.id === 'test-rule-1', 'rule id saved');

  // 3. GET /rules/:id
  const rule = await areq('GET', '/rules/test-rule-1');
  ok(rule.s === 200, 'GET /rules/:id returns 200');
  ok(rule.d.rule?.eventType === 'critical_finding', 'eventType saved');

  // 4. GET /incidents
  const incidents = await areq('GET', '/incidents');
  ok(incidents.s === 200, 'GET /incidents returns 200');

  // 5. POST /test — test dispatch (webhook may fail, that's OK)
  const testResult = await areq('POST', '/test', { ruleId: 'test-rule-1' });
  ok(testResult.s === 200 || testResult.s === 500, 'POST /test returns response (webhook delivery may fail)');

  // 6. GET /stats
  const stats = await areq('GET', '/stats');
  ok(stats.s === 200, 'GET /stats returns 200');

  // 7. DELETE /rules/:id
  const deleted = await areq('DELETE', '/rules/test-rule-1');
  ok(deleted.s === 200, 'DELETE /rules/:id returns 200');

  // 8. Verify deletion
  const afterDelete = await areq('GET', '/rules/test-rule-1');
  ok(afterDelete.s === 404, 'GET deleted rule returns 404');

  console.log(`Alerts: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}
main().then(r => process.exit(r.fail > 0 ? 1 : 0)).catch(e => { console.error(e.message); process.exit(1); });
