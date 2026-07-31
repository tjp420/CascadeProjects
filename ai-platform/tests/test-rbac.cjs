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
const rreq = (m, p, b) => req('/api/rbac', m, p, b);

async function main() {
  let pass = 0, fail = 0;
  const ok = (cond, label) => { if (cond) { pass++; } else { fail++; console.log('   FAIL:', label); } };

  // 1. GET /roles
  const roles = await rreq('GET', '/roles');
  ok(roles.s === 200, 'GET /roles returns 200');
  ok(roles.d.roles?.length === 4, 'has 4 roles');
  ok(roles.d.roles?.some(r => r.id === 'admin'), 'has admin role');
  ok(roles.d.roles?.some(r => r.id === 'viewer'), 'has viewer role');

  // 2. GET /permissions
  const perms = await rreq('GET', '/permissions');
  ok(perms.s === 200, 'GET /permissions returns 200');

  // 3. GET /me
  const me = await rreq('GET', '/me');
  ok(me.s === 200, 'GET /me returns 200');
  ok(me.d.role === 'admin', 'dev user is admin');
  ok(me.d.permissions?.includes('admin:all'), 'admin has admin:all');

  // 4. POST /assignments
  const assigned = await rreq('POST', '/assignments', { userId: 'testuser@example.com', role: 'operator' });
  ok(assigned.s === 200, 'POST /assignments returns 200');
  ok(assigned.d.assignment?.role === 'operator', 'role saved');

  // 5. GET /assignments
  const assignments = await rreq('GET', '/assignments');
  ok(assignments.s === 200, 'GET /assignments returns 200');
  ok(assignments.d.assignments?.some(a => a.userId === 'testuser@example.com'), 'assignment persisted');

  // 6. GET /assignments/:userId
  const userA = await rreq('GET', '/assignments/testuser@example.com');
  ok(userA.s === 200, 'GET /assignments/:userId returns 200');
  ok(userA.d.resolved?.role === 'operator', 'resolved role is operator');

  // 7. POST /check
  const check = await rreq('POST', '/check', { permission: 'admin:all' });
  ok(check.s === 200, 'POST /check returns 200');
  ok(check.d.allowed === true, 'admin allowed admin:all');

  // 8. POST /assignments — invalid role
  const badRole = await rreq('POST', '/assignments', { userId: 'bad@test.com', role: 'superadmin' });
  ok(badRole.s === 400, 'invalid role returns 400');

  // 9. GET /stats
  const stats = await rreq('GET', '/stats');
  ok(stats.s === 200, 'GET /stats returns 200');
  ok(stats.d.stats?.totalAssignments >= 1, 'totalAssignments >= 1');

  // 10. DELETE /assignments/:userId
  const deleted = await rreq('DELETE', '/assignments/testuser@example.com');
  ok(deleted.s === 200, 'DELETE /assignments returns 200');

  // 11. Verify deletion
  const afterDelete = await rreq('GET', '/assignments/testuser@example.com');
  ok(afterDelete.d.assignment === null, 'assignment is null after delete');

  // 12. Verify admin permissions
  const adminRole = roles.d.roles?.find(r => r.id === 'admin');
  ok(adminRole?.permissions?.includes('read:all'), 'admin has read:all');
  ok(adminRole?.permissions?.includes('write:all'), 'admin has write:all');
  ok(adminRole?.permissions?.includes('delete:all'), 'admin has delete:all');

  // 13. Verify viewer restrictions
  const viewerRole = roles.d.roles?.find(r => r.id === 'viewer');
  ok(!viewerRole?.permissions?.includes('write:all'), 'viewer does NOT have write:all');
  ok(!viewerRole?.permissions?.includes('admin:all'), 'viewer does NOT have admin:all');

  console.log(`RBAC: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}
main().then(r => process.exit(r.fail > 0 ? 1 : 0)).catch(e => { console.error(e.message); process.exit(1); });
