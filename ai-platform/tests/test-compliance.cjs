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
const creq = (m, p, b) => req('/api/compliance', m, p, b);

async function main() {
  let pass = 0, fail = 0;
  const ok = (cond, label) => { if (cond) { pass++; } else { fail++; console.log('   FAIL:', label); } };

  // 1. GET /frameworks
  const fws = await creq('GET', '/frameworks');
  ok(fws.s === 200, 'GET /frameworks returns 200');
  ok(fws.d.frameworks?.length === 3, 'has 3 frameworks');
  ok(fws.d.frameworks?.some(f => f.id === 'eu_ai_act'), 'has eu_ai_act');
  ok(fws.d.frameworks?.some(f => f.id === 'soc2'), 'has soc2');
  ok(fws.d.frameworks?.some(f => f.id === 'owasp'), 'has owasp');

  // 2. Verify section counts
  const euAiAct = fws.d.frameworks?.find(f => f.id === 'eu_ai_act');
  ok(euAiAct?.sections?.length === 6, 'eu_ai_act has 6 sections');
  const soc2 = fws.d.frameworks?.find(f => f.id === 'soc2');
  ok(soc2?.sections?.length === 5, 'soc2 has 5 sections');
  const owasp = fws.d.frameworks?.find(f => f.id === 'owasp');
  ok(owasp?.sections?.length === 10, 'owasp has 10 sections');

  // 3. GET /reports (initial)
  const reportsEmpty = await creq('GET', '/reports');
  ok(reportsEmpty.s === 200, 'GET /reports returns 200');
  ok(Array.isArray(reportsEmpty.d.reports), 'returns reports array');

  // 4. POST /generate (all 3 frameworks, HTML)
  const generated = await creq('POST', '/generate', {
    frameworks: ['eu_ai_act', 'soc2', 'owasp'],
    format: 'html',
    title: 'CI Compliance Test',
  });
  ok(generated.s === 201, 'POST /generate returns 201');
  ok(generated.d.reportId, 'has reportId');
  ok(generated.d.overallScore >= 0 && generated.d.overallScore <= 100, 'overallScore in 0-100');
  ok(generated.d.assessments?.eu_ai_act, 'has eu_ai_act assessment');
  ok(generated.d.assessments?.soc2, 'has soc2 assessment');
  ok(generated.d.assessments?.owasp, 'has owasp assessment');

  // 5. Verify assessment structure
  ok(generated.d.assessments?.eu_ai_act?.findings?.length === 6, 'eu_ai_act has 6 findings');
  ok(generated.d.assessments?.soc2?.findings?.length === 5, 'soc2 has 5 findings');
  ok(generated.d.assessments?.owasp?.findings?.length === 10, 'owasp has 10 findings');

  // 6. GET /reports (verify persisted)
  const reportsAfter = await creq('GET', '/reports');
  ok(reportsAfter.d.reports?.length >= 1, 'has >= 1 report');
  ok(reportsAfter.d.reports?.[0]?.id === generated.d.reportId, 'first report matches');

  // 7. GET /reports/:id
  const reportById = await creq('GET', `/reports/${generated.d.reportId}`);
  ok(reportById.s === 200, 'GET /reports/:id returns 200');
  ok(reportById.d.report?.content?.includes('<!DOCTYPE html>'), 'content is HTML');

  // 8. GET /reports/:id/download
  const downloadResp = await new Promise((r) => {
    http.get(`http://localhost:3999/api/compliance/reports/${generated.d.reportId}/download`, (res) => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => r({ s: res.statusCode, h: res.headers, b }));
    });
  });
  ok(downloadResp.s === 200, 'download returns 200');
  ok(downloadResp.h['content-type']?.includes('text/html'), 'content-type is text/html');
  ok(downloadResp.h['content-disposition']?.includes('attachment'), 'has content-disposition');

  // 9. POST /generate — single framework, JSON
  const singleFw = await creq('POST', '/generate', { frameworks: ['soc2'], format: 'json' });
  ok(singleFw.s === 201, 'single framework returns 201');
  ok(singleFw.d.frameworks?.length === 1, 'has 1 framework');

  // 10. POST /generate — invalid framework
  const badFw = await creq('POST', '/generate', { frameworks: ['invalid'], format: 'html' });
  ok(badFw.s === 400, 'invalid framework returns 400');

  // 11. GET /reports/:id — not found
  const notFound = await creq('GET', '/reports/nonexistent');
  ok(notFound.s === 404, 'nonexistent report returns 404');

  // 12. GET /stats
  const stats = await creq('GET', '/stats');
  ok(stats.s === 200, 'GET /stats returns 200');
  ok(stats.d.stats?.total >= 2, 'total >= 2');

  // 13. POST /generate — default (no body)
  const defaultGen = await creq('POST', '/generate', {});
  ok(defaultGen.s === 201, 'default generate returns 201');
  ok(defaultGen.d.frameworks?.length === 3, 'defaults to all 3 frameworks');

  // 14. DELETE /reports/:id
  const deleted = await creq('DELETE', `/reports/${singleFw.d.reportId}`);
  ok(deleted.s === 200, 'DELETE returns 200');

  // 15. Verify deletion
  const afterDelete = await creq('GET', `/reports/${singleFw.d.reportId}`);
  ok(afterDelete.s === 404, 'deleted report returns 404');

  // Cleanup
  await creq('DELETE', `/reports/${generated.d.reportId}`);
  await creq('DELETE', `/reports/${defaultGen.d.reportId}`);

  console.log(`Compliance: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}
main().then(r => process.exit(r.fail > 0 ? 1 : 0)).catch(e => { console.error(e.message); process.exit(1); });
