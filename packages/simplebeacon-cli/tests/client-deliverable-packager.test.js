const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const packager = require('../src/reporters/client-deliverable-packager');

test('client-deliverable-packager writes files and _SUCCESS', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'minimal-smoke-scan.json'), 'utf8'));
  const model = {
    scan_id: fixture.results.simplebeacon.scan_summary.scan_id,
    target_project_path: fixture.projectPath,
    report_schema_version: '1.1',
    summary: {
      total_issues_evaluated: 1,
      blocking_count: 1,
      supply_chain_count: 0,
      informational_count: 0,
    },
    classified_findings: [
      {
        classification: 'blocking',
        policy_notes: 'Active Production Boundary Threat identified.',
        original_finding: fixture.results.simplebeacon.gate.blockingIssues[0],
      },
    ],
  };

  const outRoot = path.join(__dirname, 'packager-output');
  if (fs.existsSync(outRoot)) fs.rmSync(outRoot, { recursive: true, force: true });
  const ok = packager.writeClientDeliverableFolder(model, outRoot);
  assert.ok(ok, 'packager returned truthy success');
  const files = fs.readdirSync(path.join(outRoot, `scan_${model.scan_id}`));
  assert.ok(files.includes('EXECUTIVE-REPORT.md'));
  assert.ok(files.includes('executive-report.json'));
  assert.ok(files.includes('_SUCCESS'));
  // cleanup
  fs.rmSync(outRoot, { recursive: true, force: true });
});
