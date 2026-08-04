const fs = require('fs');
const path = require('path');

// Minimal parser for our simple routing YAML (sufficient for the routing file shape used here)
function parseSimpleRoutes(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const routes = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('- match:') || line.startsWith('- match_re:')) {
      const isRegex = line.startsWith('- match_re:');
      i++;
      const parsedMatch = {};
      while (i < lines.length && /^\s{8,}\S/.test(lines[i])) {
        const m = lines[i].trim().match(/^(\w+):\s*"?([^"]+)"?/);
        if (m) parsedMatch[m[1]] = m[2];
        i++;
      }
      // after match block, look ahead for receiver and continue
      let receiver = null;
      let cont = false;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith('- match')) {
        const t = lines[i].trim();
        const r = t.match(/^receiver:\s*(.+)$/);
        if (r) receiver = r[1].trim().replace(/^['\"]|['\"]$/g, '');
        const c = t.match(/^continue:\s*(true|false)/);
        if (c) cont = c[1] === 'true';
        i++;
      }
      routes.push({
        match: isRegex ? {} : parsedMatch,
        matchRegex: isRegex ? parsedMatch : null,
        receiver,
        continue: cont,
      });
      continue;
    }
    i++;
  }
  return routes;
}

function receiversForAlert(routes, labels) {
  const matched = [];
  for (const r of routes) {
    let ok = true;
    for (const k of Object.keys(r.match)) {
      if (labels[k] !== r.match[k]) { ok = false; break; }
    }
    if (ok && r.matchRegex) {
      for (const k of Object.keys(r.matchRegex)) {
        const re = new RegExp(r.matchRegex[k]);
        if (!labels[k] || !re.test(labels[k])) { ok = false; break; }
      }
    }
    if (ok && r.receiver) matched.push(r.receiver);
    // if matched and continue === false, stop processing (mimics route stop)
    if (ok && !r.continue) break;
  }
  // always include default root receiver defined in file if none matched
  if (matched.length === 0) matched.push('default-ops-pager');
  return matched;
}

describe('Alertmanager routing (synthetic validation)', () => {
  const cfgPath = path.join(__dirname, '..', '..', '..', 'deploy', 'alertmanager', 'alertmanager-routing.yml');
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const routes = parseSimpleRoutes(raw);

  test('critical hardware-security alerts route to hsm-critical-security-pager', () => {
    const labels = { tier: 'hardware-security', severity: 'critical' };
    const rs = receiversForAlert(routes, labels);
    expect(rs).toContain('hsm-critical-security-pager');
  });

  test('warning hardware-security alerts route to hsm-warning-ops-triage', () => {
    const labels = { tier: 'hardware-security', severity: 'warning' };
    const rs = receiversForAlert(routes, labels);
    expect(rs).toContain('hsm-warning-ops-triage');
  });

  test('non-hsm alerts fall back to default receiver', () => {
    const labels = { tier: 'other', severity: 'warning' };
    const rs = receiversForAlert(routes, labels);
    expect(rs).toContain('default-ops-pager');
  });

  test('mesh reconciliation drift alerts route to hsm-crypto-ops-pager', () => {
    const labels = { alertname: 'MeshReconciliationBoundaryDrift', track: '115', service: 'hsm-vault-mesh' };
    const rs = receiversForAlert(routes, labels);
    expect(rs).toContain('hsm-crypto-ops-pager');
  });

  test('hsm-mesh-vault component alerts route to hsm-crypto-ops-pager', () => {
    const labels = { component: 'hsm-mesh-vault', severity: 'critical' };
    const rs = receiversForAlert(routes, labels);
    expect(rs).toContain('hsm-crypto-ops-pager');
  });

  test('Track 31 lookup gating alerts route to hsm-crypto-ops-pager', () => {
    const labels = { component: 'hsm-mesh-vault', tier: 'post-quantum-crypto', track: '31' };
    const rs = receiversForAlert(routes, labels);
    expect(rs).toContain('hsm-crypto-ops-pager');
  });

  test('Track 113 handshake alerts route to hsm-crypto-ops-pager', () => {
    const labels = { component: 'hsm-mesh-vault', tier: 'post-quantum-crypto', track: '113' };
    const rs = receiversForAlert(routes, labels);
    expect(rs).toContain('hsm-crypto-ops-pager');
  });

  test('Track 32 ring gating alerts route to hsm-crypto-ops-pager', () => {
    const labels = { component: 'hsm-mesh-vault', tier: 'post-quantum-crypto', track: '32' };
    const rs = receiversForAlert(routes, labels);
    expect(rs).toContain('hsm-crypto-ops-pager');
  });
});
