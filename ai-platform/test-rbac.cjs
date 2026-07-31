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
  const ok = (cond, label) => { if (cond) { pass++; console.log('   PASS:', label); } else { fail++; console.log('   FAIL:', label); } };

  console.log('=== RBAC — Role-Based Access Control Tests ===\n');

  // 1. GET /roles
  console.log('1. GET /roles...');
  const roles = await rreq('GET', '/roles');
  ok(roles.s === 200, 'returned 200');
  ok(roles.d.roles?.length === 4, 'has 4 roles');
  ok(roles.d.roles?.some(r => r.id === 'admin'), 'has admin role');
  ok(roles.d.roles?.some(r => r.id === 'auditor'), 'has auditor role');
  ok(roles.d.roles?.some(r => r.id === 'operator'), 'has operator role');
  ok(roles.d.roles?.some(r => r.id === 'viewer'), 'has viewer role');

  // 2. Verify admin permissions
  console.log('\n2. Verify admin permissions...');
  const adminRole = roles.d.roles?.find(r => r.id === 'admin');
  ok(adminRole?.permissions?.includes('admin:all'), 'admin has admin:all');
  ok(adminRole?.permissions?.includes('read:all'), 'admin has read:all');
  ok(adminRole?.permissions?.includes('write:all'), 'admin has write:all');
  ok(adminRole?.permissions?.includes('delete:all'), 'admin has delete:all');

  // 3. Verify viewer permissions (limited)
  console.log('\n3. Verify viewer permissions...');
  const viewerRole = roles.d.roles?.find(r => r.id === 'viewer');
  ok(viewerRole?.permissions?.includes('read:analytics'), 'viewer has read:analytics');
  ok(!viewerRole?.permissions?.includes('write:all'), 'viewer does NOT have write:all');
  ok(!viewerRole?.permissions?.includes('admin:all'), 'viewer does NOT have admin:all');

  // 4. GET /permissions
  console.log('\n4. GET /permissions...');
  const perms = await rreq('GET', '/permissions');
  ok(perms.s === 200, 'returned 200');
  ok(perms.d.permissions?.['read:all'] !== undefined, 'has read:all permission');
  ok(perms.d.permissions?.['admin:all'] !== undefined, 'has admin:all permission');

  // 5. GET /me (current user role)
  console.log('\n5. GET /me...');
  const me = await rreq('GET', '/me');
  ok(me.s === 200, 'returned 200');
  ok(me.d.role === 'admin', 'dev user is admin');
  ok(me.d.permissions?.includes('admin:all'), 'dev user has admin:all');
  ok(me.d.source === 'jwt' || me.d.source === 'assignment' || me.d.source === 'default', 'has valid source');

  // 6. GET /assignments (empty initially)
  console.log('\n6. GET /assignments (initial)...');
  const assignmentsEmpty = await rreq('GET', '/assignments');
  ok(assignmentsEmpty.s === 200, 'returned 200');
  ok(Array.isArray(assignmentsEmpty.d.assignments), 'returns assignments array');

  // 7. POST /assignments (assign operator role)
  console.log('\n7. POST /assignments — assign operator to user1...');
  const assigned = await rreq('POST', '/assignments', { userId: 'user1@test.com', role: 'operator' });
  ok(assigned.s === 200, 'returned 200');
  ok(assigned.d.assignment?.userId === 'user1@test.com', 'userId saved');
  ok(assigned.d.assignment?.role === 'operator', 'role saved');
  ok(assigned.d.assignment?.roleName === 'Operator', 'roleName saved');
  ok(assigned.d.assignment?.permissions?.includes('write:tickets'), 'has write:tickets permission');
  ok(assigned.d.assignment?.permissions?.includes('write:evals'), 'has write:evals permission');
  ok(assigned.d.assignment?.assignedBy === 'dev@localhost', 'assignedBy set');

  // 8. GET /assignments (verify persisted)
  console.log('\n8. GET /assignments (verify persisted)...');
  const assignmentsAfter = await rreq('GET', '/assignments');
  ok(assignmentsAfter.s === 200, 'returned 200');
  ok(assignmentsAfter.d.assignments?.length >= 1, 'has >= 1 assignment');
  ok(assignmentsAfter.d.assignments?.some(a => a.userId === 'user1@test.com'), 'user1 assignment persisted');

  // 9. GET /assignments/:userId
  console.log('\n9. GET /assignments/user1@test.com...');
  const userAssignment = await rreq('GET', '/assignments/user1@test.com');
  ok(userAssignment.s === 200, 'returned 200');
  ok(userAssignment.d.assignment?.role === 'operator', 'role is operator');
  ok(userAssignment.d.resolved?.role === 'operator', 'resolved role is operator');

  // 10. POST /assignments (assign auditor role to user2)
  console.log('\n10. POST /assignments — assign auditor to user2...');
  const auditor = await rreq('POST', '/assignments', { userId: 'user2@test.com', role: 'auditor' });
  ok(auditor.s === 200, 'returned 200');
  ok(auditor.d.assignment?.role === 'auditor', 'auditor role saved');
  ok(auditor.d.assignment?.permissions?.includes('read:all'), 'auditor has read:all');
  ok(!auditor.d.assignment?.permissions?.includes('write:all'), 'auditor does NOT have write:all');

  // 11. POST /assignments (assign viewer role to user3)
  console.log('\n11. POST /assignments — assign viewer to user3...');
  const viewer = await rreq('POST', '/assignments', { userId: 'user3@test.com', role: 'viewer' });
  ok(viewer.s === 200, 'returned 200');
  ok(viewer.d.assignment?.role === 'viewer', 'viewer role saved');

  // 12. GET /stats
  console.log('\n12. GET /stats...');
  const stats = await rreq('GET', '/stats');
  ok(stats.s === 200, 'returned 200');
  ok(stats.d.stats?.totalAssignments >= 3, 'totalAssignments >= 3');
  ok(stats.d.stats?.byRole?.operator >= 1, 'has >= 1 operator');
  ok(stats.d.stats?.byRole?.auditor >= 1, 'has >= 1 auditor');
  ok(stats.d.stats?.byRole?.viewer >= 1, 'has >= 1 viewer');

  // 13. POST /check (permission check — admin has admin:all)
  console.log('\n13. POST /check — admin has admin:all...');
  const checkAdmin = await rreq('POST', '/check', { permission: 'admin:all' });
  ok(checkAdmin.s === 200, 'returned 200');
  ok(checkAdmin.d.allowed === true, 'admin allowed admin:all');

  // 14. POST /check (permission check — admin has write:tickets)
  console.log('\n14. POST /check — admin has write:tickets...');
  const checkWrite = await rreq('POST', '/check', { permission: 'write:tickets' });
  ok(checkWrite.s === 200, 'returned 200');
  ok(checkWrite.d.allowed === true, 'admin allowed write:tickets (via admin:all)');

  // 15. POST /check — missing permission
  console.log('\n15. POST /check — missing permission...');
  const checkMissing = await rreq('POST', '/check', {});
  ok(checkMissing.s === 400, 'returned 400');

  // 16. POST /assignments — invalid role
  console.log('\n16. POST /assignments — invalid role...');
  const badRole = await rreq('POST', '/assignments', { userId: 'user4@test.com', role: 'superadmin' });
  ok(badRole.s === 400, 'returned 400');

  // 17. POST /assignments — missing userId
  console.log('\n17. POST /assignments — missing userId...');
  const noUser = await rreq('POST', '/assignments', { role: 'viewer' });
  ok(noUser.s === 400, 'returned 400');

  // 18. POST /assignments — missing role
  console.log('\n18. POST /assignments — missing role...');
  const noRole = await rreq('POST', '/assignments', { userId: 'user5@test.com' });
  ok(noRole.s === 400, 'returned 400');

  // 19. DELETE /assignments/:userId
  console.log('\n19. DELETE /assignments/user3@test.com...');
  const deleted = await rreq('DELETE', '/assignments/user3@test.com');
  ok(deleted.s === 200, 'returned 200');
  ok(deleted.d.deleted === 'user3@test.com', 'deleted correct user');

  // 20. GET /assignments/user3@test.com (should have no assignment, fall back)
  console.log('\n20. GET /assignments/user3@test.com (after delete)...');
  const afterDelete = await rreq('GET', '/assignments/user3@test.com');
  ok(afterDelete.s === 200, 'returned 200');
  ok(afterDelete.d.assignment === null, 'assignment is null');

  // 21. Verify org isolation
  console.log('\n21. Verify org isolation...');
  ok(assignmentsAfter.d.assignments?.every(a => a.orgId === 'dev-user-01'), 'all assignments org-scoped');

  // 22. Update existing assignment (change role)
  console.log('\n22. POST /assignments — update user1 from operator to admin...');
  const updated = await rreq('POST', '/assignments', { userId: 'user1@test.com', role: 'admin' });
  ok(updated.s === 200, 'returned 200');
  ok(updated.d.assignment?.role === 'admin', 'role updated to admin');
  ok(updated.d.assignment?.assignedAt !== updated.d.assignment?.updatedAt, 'assignedAt preserved, updatedAt changed');

  // 23. Verify operator permissions are different from admin
  console.log('\n23. Verify role permission differences...');
  const operatorRole = roles.d.roles?.find(r => r.id === 'operator');
  ok(operatorRole?.permissions?.includes('write:tickets'), 'operator has write:tickets');
  ok(!operatorRole?.permissions?.includes('admin:all'), 'operator does NOT have admin:all');
  ok(!operatorRole?.permissions?.includes('delete:all'), 'operator does NOT have delete:all');

  // 24. Verify auditor can read but not write
  console.log('\n24. Verify auditor read/write split...');
  const auditorRole = roles.d.roles?.find(r => r.id === 'auditor');
  ok(auditorRole?.permissions?.includes('read:all'), 'auditor has read:all');
  ok(auditorRole?.permissions?.includes('export:audit'), 'auditor has export:audit');
  ok(!auditorRole?.permissions?.includes('write:all'), 'auditor does NOT have write:all');
  ok(!auditorRole?.permissions?.includes('delete:all'), 'auditor does NOT have delete:all');

  // Cleanup
  await rreq('DELETE', '/assignments/user1@test.com');
  await rreq('DELETE', '/assignments/user2@test.com');

  console.log('\n=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
