#!/usr/bin/env node
/**
 * Full-auto Render deploy script
 * Requires: RENDER_API_KEY and RENDER_SERVICE_ID environment variables
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
};
function log(msg, color = C.reset) { console.log(`${color}${msg}${C.reset}`); }

const API_KEY = process.env.RENDER_API_KEY;
const SERVICE_ID = process.env.RENDER_SERVICE_ID;

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.render.com', port: 443, path, method,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function updateServiceSettings() {
  log('\n=== Updating Render Service Settings ===', C.cyan);

  if (!API_KEY || !SERVICE_ID) {
    log('Missing API credentials. Set these environment variables:', C.red);
    log('  set RENDER_API_KEY=rdk_xxxxxxxxxx', C.blue);
    log('  set RENDER_SERVICE_ID=srv-xxxxxxxxxx', C.blue);
    log('\nFind your service ID in Render dashboard URL:', C.blue);
    log('  https://dashboard.render.com/web/srv-XXXXXX', C.blue);
    return false;
  }

  try {
    // Update service: clear rootDir, fix build/start commands
    const update = await apiRequest('PATCH', `/v1/services/${SERVICE_ID}`, {
      serviceDetails: {
        rootDir: '',
        buildCommand: 'npm install',
        startCommand: 'node coming-soon/server.cjs',
      }
    });
    log('Service settings updated:', C.green);
    log(`  Root Dir: "${update.serviceDetails?.rootDir || '(blank)'}"`, C.blue);
    log(`  Build: ${update.serviceDetails?.buildCommand}`, C.blue);
    log(`  Start: ${update.serviceDetails?.startCommand}`, C.blue);

    // Trigger deploy
    const deploy = await apiRequest('POST', `/v1/services/${SERVICE_ID}/deploys`, {
      clearCache: true
    });
    log(`\nDeploy triggered! ID: ${deploy.id}`, C.green);
    log(`Status: ${deploy.status}`, C.blue);
    log(`URL: https://dashboard.render.com/web/${SERVICE_ID}/deploys/${deploy.id}`, C.blue);
    return true;
  } catch (e) {
    log(`API Error: ${e.message}`, C.red);
    return false;
  }
}

function commitAndPush() {
  log('\n=== Committing & Pushing ===', C.cyan);
  const REPO_ROOT = path.resolve(__dirname);
  try {
    execSync('git add -A', { cwd: REPO_ROOT });
    try { execSync('git commit -m "Auto-deploy update"', { cwd: REPO_ROOT }); } catch (e) {}
    execSync('git push origin main', { cwd: REPO_ROOT, stdio: 'inherit' });
    log('Pushed successfully', C.green);
  } catch (e) {
    log('Push failed', C.red);
  }
}

// Main
log('SimpleBeacon Full-Auto Deploy', C.cyan);
commitAndPush();
updateServiceSettings().then(success => {
  if (!success) {
    log('\nFallback: Open Render dashboard manually', C.yellow);
    log('https://dashboard.render.com/web-services', C.blue);
    log('\nRequired settings:', C.cyan);
    log('  Root Directory: (blank)', C.blue);
    log('  Build Command: npm install', C.blue);
    log('  Start Command: node coming-soon/server.cjs', C.blue);
  }
});
