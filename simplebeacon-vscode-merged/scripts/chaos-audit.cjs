/**
 * SimpleBeacon Real-World Chaos Fuzzing Suite
 * Clones massive public repositories and runs full 56-engine scans.
 *
 * Usage:
 *   node scripts/chaos-audit.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Heavy, multi-layered target repositories chosen to stress-test system boundaries
const targetRepos = [
  {
    name: 'calcom',
    url: 'https://github.com/calcom/cal.com.git',
    desc: 'Massive Next.js monorepo with high schema/config density.'
  },
  {
    name: 'open-webui',
    url: 'https://github.com/open-webui/open-webui.git',
    desc: 'Dense AI integration layout with heavy text logging tracks.'
  }
];

const workspaceChaosDir = path.join(__dirname, '..', '.simplebeacon-chaos');
if (!fs.existsSync(workspaceChaosDir)) {
  fs.mkdirSync(workspaceChaosDir, { recursive: true });
}

console.log('\x1b[34m[Chaos Audit] Spawning multi-engine security validation passes...\x1b[0m\n');

let passed = 0;
let failed = 0;

for (const repo of targetRepos) {
  const repoPath = path.join(workspaceChaosDir, repo.name);
  const outputReportPath = path.join(workspaceChaosDir, `${repo.name}-report.json`);

  try {
    // Clone repository locally utilizing shallow depths for execution speed
    if (!fs.existsSync(repoPath)) {
      console.log(`Cloning target footprint: ${repo.name}...`);
      execSync(`git clone --depth 1 "${repo.url}" "${repoPath}"`, { stdio: 'ignore' });
    }

    console.log(`\x1b[33mRunning Full 56-Engine Scan matrix against: ${repo.name}\x1b[0m`);

    // Execute the CLI engine runner directly
    execSync(`npx simplebeacon scan --full --gate --path "${repoPath}" --export "${outputReportPath}"`, { stdio: 'inherit' });

    // Validate structural contract integrity
    const report = JSON.parse(fs.readFileSync(outputReportPath, 'utf8'));

    if (!report.detectedIssues || !Array.isArray(report.detectedIssues)) {
      throw new Error('Schema contract mismatch: Nested detectedIssues array missing from output framework.');
    }

    const issuesFound = report.metrics?.totalIssues ?? 0;
    const finalScore = report.metrics?.qualityScore ?? 100;

    console.log(`\x1b[32m  Success: ${repo.name} finalized. Score: ${finalScore}%. Issues Found: ${issuesFound}\x1b[0m\n`);
    passed++;
  } catch (err) {
    console.error(`\x1b[31m  Engine Breakpoint encountered on ${repo.name}: ${err.message}\x1b[0m\n`);
    failed++;
  }
}

console.log(`\x1b[34m[Chaos Audit] Complete: ${passed} passed, ${failed} failed out of ${targetRepos.length} targets.\x1b[0m`);
process.exit(failed > 0 ? 1 : 0);
