#!/usr/bin/env node

/**
 * Pre-Deploy Sequence Verification
 *
 * Runs BEFORE deployment to ensure all critical gates pass.
 * This script is the "undefined deploy gate" referenced in the roadmap.
 * It must pass before any production deployment proceeds.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const constants = require('../server/config/constants.cjs');
const projectRoot = path.resolve(__dirname, '..');

function resolveProjectPath(...segments) {
  return path.join(projectRoot, ...segments);
}

class PreDeployGate {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  log(message, type = 'info') {
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} ${message}`);
  }

  // Gate 1: Simplebeacon gate must pass
  checkSimplebeaconGate() {
    this.log('Checking Simplebeacon gate...');
    const reportPath = resolveProjectPath('.simplebeacon', 'report.json');

    if (!fs.existsSync(reportPath)) {
      this.log('Simplebeacon report not found. Run: npm run simplebeacon:report', 'error');
      this.results.failed.push('Simplebeacon gate: no report');
      return;
    }

    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const gatePass = report.gate?.pass || false;
      const blockingCount = report.gate?.blockingCount || 0;

      if (gatePass && blockingCount === 0) {
        this.log(`Simplebeacon gate PASSED (score: ${report.qualityScore || 'N/A'})`, 'success');
        this.results.passed.push('Simplebeacon gate passed');
      } else {
        this.log(`Simplebeacon gate FAILED (${blockingCount} blocking issues)`, 'error');
        this.results.failed.push(`Simplebeacon gate failed (${blockingCount} blocking)`);
      }
    } catch (err) {
      this.log(`Failed to parse Simplebeacon report: ${err.message}`, 'error');
      this.results.failed.push('Simplebeacon gate: report parse error');
    }
  }

  // Gate 2: No high/critical npm audit vulnerabilities
  checkNpmAudit() {
    this.log('Checking npm audit...');
    try {
      execSync('npm audit --audit-level=high', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      this.log('npm audit passed (no high/critical vulnerabilities)', 'success');
      this.results.passed.push('npm audit clean');
    } catch (error) {
      // npm audit exits non-zero when vulnerabilities found
      this.log('npm audit found high/critical vulnerabilities', 'error');
      this.results.failed.push('npm audit: vulnerabilities found');
    }
  }

  // Gate 3: Tests must pass
  checkTests() {
    this.log('Checking tests...');
    try {
      execSync('npm test -- --passWithNoTests', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: constants.TIMEOUT_2M
      });
      this.log('Tests passed', 'success');
      this.results.passed.push('Tests passing');
    } catch (error) {
      this.log('Tests failed', 'error');
      this.results.failed.push('Tests failing');
    }
  }

  // Gate 4: Required production files exist
  checkProductionFiles() {
    this.log('Checking production files...');
    const requiredFiles = [
      '.env.production',
      'docker-compose.phase2.yml',
      'scripts/deploy-simplebeacon.sh',
      'docs/v1-internal-runbook.md'
    ];

    for (const file of requiredFiles) {
      const filePath = resolveProjectPath(file);
      if (fs.existsSync(filePath)) {
        this.log(`Found: ${file}`, 'success');
        this.results.passed.push(`Production file: ${file}`);
      } else {
        this.log(`Missing: ${file}`, 'error');
        this.results.failed.push(`Missing production file: ${file}`);
      }
    }
  }

  // Gate 5: Lint must pass
  checkLint() {
    this.log('Checking lint...');
    try {
      execSync('npm run lint', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: constants.TIMEOUT_1M
      });
      this.log('Lint passed', 'success');
      this.results.passed.push('Lint clean');
    } catch (error) {
      this.log('Lint failed', 'error');
      this.results.failed.push('Lint errors');
    }
  }

  // Gate 6: Build must succeed
  checkBuild() {
    this.log('Checking build...');
    try {
      execSync('npm run build', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: constants.TIMEOUT_2M
      });

      if (fs.existsSync(resolveProjectPath('dist')) && fs.readdirSync(resolveProjectPath('dist')).length > 0) {
        this.log('Build succeeded with artifacts', 'success');
        this.results.passed.push('Build successful');
      } else {
        this.log('Build succeeded but no artifacts in dist/', 'warning');
        this.results.warnings.push('Build: no dist artifacts');
      }
    } catch (error) {
      this.log('Build failed', 'error');
      this.results.failed.push('Build failed');
    }
  }

  runAllChecks() {
    console.log('🚪 Pre-Deploy Gate Sequence\n');
    console.log('This gate must pass before ANY production deployment.\n');

    this.checkSimplebeaconGate();
    this.checkNpmAudit();
    this.checkTests();
    this.checkProductionFiles();
    this.checkLint();
    this.checkBuild();

    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 Pre-Deploy Gate Report');
    console.log('==========================\n');

    const totalChecks = this.results.passed.length + this.results.failed.length + this.results.warnings.length;
    const passRate = totalChecks > 0 ? (this.results.passed.length / totalChecks * 100).toFixed(1) : 0;

    console.log(`✅ Passed: ${this.results.passed.length}`);
    console.log(`❌ Failed: ${this.results.failed.length}`);
    console.log(`⚠️  Warnings: ${this.results.warnings.length}`);
    console.log(`📈 Pass Rate: ${passRate}%\n`);

    if (this.results.failed.length > 0) {
      console.log('🚨 DEPLOY BLOCKED — Fix these before deploying:');
      this.results.failed.forEach(issue => console.log(`   - ${issue}`));
      console.log('');
    }

    if (this.results.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.results.warnings.forEach(warning => console.log(`   - ${warning}`));
      console.log('');
    }

    if (this.results.failed.length === 0) {
      console.log('🎉 DEPLOY GATE PASSED');
      console.log('All critical checks passed. Proceed with deployment.');
      process.exit(0);
    } else {
      console.log('🚫 DEPLOY GATE FAILED');
      console.log('Address all critical issues before deploying.');
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const gate = new PreDeployGate();
  gate.runAllChecks();
}

module.exports = { PreDeployGate };
