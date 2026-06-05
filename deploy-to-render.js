#!/usr/bin/env node
/**
 * SimpleBeacon Render Deployment Script
 * Validates setup, commits, pushes, and optionally triggers Render deploy via API
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname);
const COMING_SOON = path.join(REPO_ROOT, 'coming-soon');

// Colors for terminal output
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = C.reset) {
  console.log(`${color}${msg}${C.reset}`);
}

function run(cmd, cwd = REPO_ROOT) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (e) {
    return e.stderr || e.stdout || '';
  }
}

function validate() {
  log('\n=== Validating Setup ===', C.cyan);

  // 1. Check root package.json exists and has deps
  const rootPkgPath = path.join(REPO_ROOT, 'package.json');
  if (!fs.existsSync(rootPkgPath)) {
    log('FAIL: Root package.json not found', C.red);
    process.exit(1);
  }

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const requiredDeps = ['express', 'multer', 'tmp', 'jsonwebtoken', 'cors'];
  const missing = requiredDeps.filter(d => !rootPkg.dependencies?.[d]);

  if (missing.length > 0) {
    log(`FAIL: Root package.json missing deps: ${missing.join(', ')}`, C.red);
    log('Run: npm install from repo root after fixing package.json', C.yellow);
    process.exit(1);
  }
  log('PASS: Root package.json has all required dependencies', C.green);

  // 2. Check server.cjs exists
  const serverPath = path.join(COMING_SOON, 'server.cjs');
  if (!fs.existsSync(serverPath)) {
    log('FAIL: coming-soon/server.cjs not found', C.red);
    process.exit(1);
  }
  log('PASS: server.cjs exists', C.green);

  // 3. Check server.cjs doesn't have the broken Module.globalPaths hack
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  if (serverCode.includes('Module.globalPaths')) {
    log('FAIL: server.cjs still has broken Module.globalPaths hack', C.red);
    log('Fix: Remove the Module.globalPaths lines from coming-soon/server.cjs', C.yellow);
    process.exit(1);
  }
  log('PASS: server.cjs is clean (no broken module hack)', C.green);

  // 4. Check .gitignore excludes sensitive files
  const gitignorePath = path.join(COMING_SOON, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const requiredIgnores = ['.env', 'subscriptions.json', 'node_modules/'];
    const missingIgnores = requiredIgnores.filter(i => !gitignore.includes(i));
    if (missingIgnores.length === 0) {
      log('PASS: .gitignore properly excludes sensitive files', C.green);
    } else {
      log(`WARN: .gitignore missing: ${missingIgnores.join(', ')}`, C.yellow);
    }
  }

  // 5. Check ai-platform exists
  const aiPlatformPath = path.join(REPO_ROOT, 'ai-platform');
  if (!fs.existsSync(aiPlatformPath)) {
    log('FAIL: ai-platform/ directory not found', C.red);
    process.exit(1);
  }
  log('PASS: ai-platform/ backend directory exists', C.green);

  // 6. Check for uncommitted changes
  const status = run('git status --short');
  if (status) {
    log(`WARN: Uncommitted changes detected:\n${status}`, C.yellow);
  } else {
    log('PASS: No uncommitted changes', C.green);
  }

  log('\n=== Validation Complete ===', C.cyan);
  return true;
}

function commitAndPush() {
  log('\n=== Committing & Pushing ===', C.cyan);

  const status = run('git status --short');
  if (!status) {
    log('No changes to commit', C.yellow);
  } else {
    run('git add -A');
    run('git commit -m "Auto-deploy: Update for Render deployment"');
    log('Committed changes', C.green);
  }

  // Push to origin
  try {
    const pushOutput = execSync('git push origin main', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    log('Pushed to GitHub successfully', C.green);
    log(pushOutput, C.blue);
  } catch (e) {
    log(`Push failed: ${e.message}`, C.red);
    log('Make sure you have Git credentials configured', C.yellow);
    process.exit(1);
  }
}

function triggerRenderDeploy() {
  log('\n=== Render Deploy ===', C.cyan);

  // Check for Render API key
  const renderApiKey = process.env.RENDER_API_KEY;
  if (!renderApiKey) {
    log('No RENDER_API_KEY environment variable found', C.yellow);
    log('Skipping API deploy trigger. Render should auto-deploy from GitHub push.', C.yellow);
    log('\nTo enable API deploys, set RENDER_API_KEY:', C.cyan);
    log('  Windows: set RENDER_API_KEY=rdk_xxxxxxxxxx', C.blue);
    log('  Then run this script again', C.blue);
    return false;
  }

  // Get service ID from user or try to find it
  const serviceId = process.env.RENDER_SERVICE_ID;
  if (!serviceId) {
    log('No RENDER_SERVICE_ID found. Set it as:', C.yellow);
    log('  set RENDER_SERVICE_ID=srv-xxxxxxxxxx', C.blue);
    log('\nFind your service ID in Render dashboard → Settings', C.blue);
    return false;
  }

  log(`Triggering deploy for service ${serviceId}...`, C.blue);

  try {
    const curlCmd = `curl -s -X POST "https://api.render.com/v1/services/${serviceId}/deploys" \
      -H "Accept: application/json" \
      -H "Authorization: Bearer ${renderApiKey}"`;
    const result = execSync(curlCmd, { encoding: 'utf8', stdio: 'pipe' });
    const json = JSON.parse(result);
    if (json.id) {
      log(`Deploy triggered! ID: ${json.id}`, C.green);
      log(`Status: ${json.status}`, C.blue);
      return true;
    } else {
      log(`API response: ${result}`, C.yellow);
      return false;
    }
  } catch (e) {
    log(`API call failed: ${e.message}`, C.red);
    return false;
  }
}

function printNextSteps() {
  log('\n=== Next Steps ===', C.cyan);
  log('1. Go to Render Dashboard:', C.blue);
  log('   https://dashboard.render.com/web-services', C.blue);
  log('2. Click your "simplebeacon" service', C.blue);
  log('3. Settings should be:', C.blue);
  log('   - Root Directory: (blank)', C.blue);
  log('   - Build Command: npm install', C.blue);
  log('   - Start Command: node coming-soon/server.cjs', C.blue);
  log('4. If auto-deploy is ON, your push already triggered a deploy', C.green);
  log('5. If not, click "Manual Deploy" → "Deploy latest commit"', C.blue);
  log('\nYour live URL: https://simplebeacon.onrender.com', C.green);
}

// ===== MAIN =====
log('SimpleBeacon Render Deploy Script', C.cyan);
log('===================================', C.cyan);

validate();
commitAndPush();
triggerRenderDeploy();
printNextSteps();
