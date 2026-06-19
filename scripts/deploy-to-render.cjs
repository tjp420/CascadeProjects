#!/usr/bin/env node
'use strict';
/**
 * Deploy SimpleBeacon to Render
 * 
 * Prerequisites:
 * 1. Install Render CLI: npm install -g @render/cli
 * 2. Login: render login
 * 3. Set env vars in Render dashboard or via CLI
 * 
 * Usage:
 *   node scripts/deploy-to-render.cjs
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const RENDER_YAML = path.join(ROOT, 'render.yaml');

function checkFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing ${label}: ${filePath}`);
    process.exit(1);
  }
  console.log(`✅ ${label} found`);
}

function run(cmd, cwd = ROOT) {
  console.log(`\n▶ ${cmd}`);
  try {
    const output = execSync(cmd, { cwd, stdio: 'inherit' });
    return output;
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`);
    throw err;
  }
}

function main() {
  console.log('🚀 SimpleBeacon Render Deploy\n');

  // 1. Verify required files
  checkFile(RENDER_YAML, 'render.yaml');
  checkFile(path.join(ROOT, 'ai-platform', 'simplebeacon-server.cjs'), 'Server entry');
  checkFile(path.join(ROOT, '.env.example'), 'Env example');

  // 2. Verify TypeScript compilation
  console.log('\n📦 Verifying extension build...');
  try {
    execSync('npm run compile', { cwd: path.join(ROOT, 'vscode-extension'), stdio: 'pipe' });
    console.log('✅ Extension compiled');
  } catch {
    console.error('❌ Extension compilation failed');
    process.exit(1);
  }

  // 3. Check syntax of critical server files
  console.log('\n🔍 Checking server syntax...');
  const serverFiles = [
    'ai-platform/simplebeacon-server.cjs',
    'ai-platform/src/api/simplebeacon-billing-api.cjs',
    'coming-soon/routes/checkout.cjs',
    'coming-soon/services/email.cjs'
  ];
  for (const file of serverFiles) {
    try {
      execSync(`node -c ${path.join(ROOT, file)}`, { stdio: 'pipe' });
      console.log(`✅ ${file}`);
    } catch {
      console.error(`❌ Syntax error in ${file}`);
      process.exit(1);
    }
  }

  // 4. Verify env completeness
  console.log('\n🔐 Checking env.example completeness...');
  const envContent = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SIMPLEBEACON_LICENSE_SECRET',
    'RESEND_API_KEY',
    'PUBLIC_URL',
    'SIMPLEBEACON_APP_URL'
  ];
  const missing = requiredVars.filter(v => !envContent.includes(v));
  if (missing.length) {
    console.warn(`⚠️ Missing from .env.example: ${missing.join(', ')}`);
  } else {
    console.log('✅ All critical env vars documented');
  }

  // 5. Deploy via Render CLI
  console.log('\n🌐 Deploying to Render...');
  console.log('   (Ensure Render CLI is installed: npm install -g @render/cli)');
  console.log('   (Ensure you are logged in: render login)');
  
  try {
    run('render deploy --preview .', ROOT);
  } catch {
    console.log('\n⚠️ Render CLI deploy failed. Manual deploy steps:');
    console.log('   1. Push code to GitHub');
    console.log('   2. Go to https://dashboard.render.com');
    console.log('   3. Click "New +" → "Blueprint"');
    console.log('   4. Connect your GitHub repo');
    console.log('   5. Render will detect render.yaml and create the service');
    console.log('   6. Set sync: false env vars in the dashboard');
  }

  console.log('\n✅ Deploy script complete');
}

if (require.main === module) {
  main();
}

module.exports = { main };
